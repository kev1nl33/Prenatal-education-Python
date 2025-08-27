import os
import json
import time
import random
import urllib.request
import urllib.error
import ssl
import base64
import hashlib
import hmac
from datetime import datetime, timezone
from urllib.parse import quote, urlparse
from typing import Dict, Any, List, Optional
from .base import SpeechSynthesizer


class ProductionSpeechAdapter(SpeechSynthesizer):
    """生产环境语音合成适配器（火山引擎TTS）"""
    
    def __init__(self):
        # 从环境变量读取配置
        self.app_id = os.environ.get('TTS_APP_ID', '')
        self.access_token = os.environ.get('TTS_ACCESS_TOKEN', '')
        self.api_url = os.environ.get('TTS_API_URL', 'https://openspeech.bytedance.com/api/v1/tts')
        # 声音复刻API端点（2.0）
        self.voice_clone_api_url = os.environ.get('VOICE_CLONE_API_URL', 'https://openspeech.bytedance.com/api/v1/tts')
        # 兼容旧配置，自动推导 upload/status 端点
        _base = self.voice_clone_api_url
        if _base.endswith('/api/v1/tts'):
            _base = _base[: -len('/api/v1/tts')]
        _base = _base.rstrip('/')
        self.voice_clone_upload_url = os.environ.get(
            'VOICE_CLONE_UPLOAD_URL', f"{_base}/api/v1/mega_tts/audio/upload"
        )
        self.voice_clone_status_url = os.environ.get(
            'VOICE_CLONE_STATUS_URL', f"{_base}/api/v1/mega_tts/status"
        )

        # 火山引擎SDK签名认证配置（优先使用）
        self.access_key_id = os.environ.get('VOLC_ACCESS_KEY_ID', '').strip()
        self.secret_access_key = os.environ.get('VOLC_SECRET_ACCESS_KEY', '').strip()
        self.use_signature_auth = bool(self.access_key_id and self.secret_access_key and 
                                     self.access_key_id != 'your_access_key_id_here' and
                                     self.secret_access_key != 'your_secret_access_key_here')
        
        try:
            self.sample_rate = int(os.environ.get('TTS_SAMPLE_RATE', '24000'))
        except ValueError:
            self.sample_rate = 24000
        
        # 使用APP ID和Access Token认证
        self.use_app_token_auth = bool(self.app_id and self.access_token)
        
        if self.use_app_token_auth:
            print("[PROD_ADAPTER INIT] Using TTS v1 with APP ID and Access Token authentication")
            print(f"[PROD_ADAPTER INIT] APP ID: {self.app_id}")
            print(f"[PROD_ADAPTER INIT] Access Token: {self.access_token[:8]}***")
        elif self.use_signature_auth:
            print("[PROD_ADAPTER INIT] Using TTS v1 with AK/SK signature authentication")
            print(f"[PROD_ADAPTER INIT] Access Key ID: {self.access_key_id[:8]}***")
        else:
            raise ValueError("Either TTS_APP_ID+TTS_ACCESS_TOKEN or VOLC_ACCESS_KEY_ID+VOLC_SECRET_ACCESS_KEY must be set")

        # 价格配置
        self.price_per_1k_char = float(os.environ.get('TTS_PRICE_PER_1K_CHAR', '0.02'))
        self.high_quality_multiplier = float(os.environ.get('TTS_HIGH_QUALITY_MULTIPLIER', '2.0'))
        
        # 重试配置
        self.max_retries = int(os.environ.get('TTS_MAX_RETRIES', '2'))
        self.timeout = int(os.environ.get('TTS_TIMEOUT', '60'))  # 增加到60秒
        
        # 检查必需的APP ID和Access Token配置
        if not self.app_id or not self.access_token:
            raise ValueError("TTS_APP_ID and TTS_ACCESS_TOKEN must be set in environment variables")

    def _build_ssl_context(self):
        """构建SSL上下文"""
        try:
            import certifi
            return ssl.create_default_context(cafile=certifi.where())
        except Exception:
            try:
                return ssl._create_unverified_context()
            except Exception:
                return None

    def _pcm_to_wav(self, pcm_data: bytes, sample_rate: int = 24000, channels: int = 1, bits_per_sample: int = 16) -> bytes:
        """将PCM数据转换为WAV格式
        
        Args:
            pcm_data: 原始PCM音频数据
            sample_rate: 采样率，默认24000Hz
            channels: 声道数，默认1（单声道）
            bits_per_sample: 位深度，默认16位
            
        Returns:
            WAV格式的音频数据
        """
        import struct
        
        # 计算各种参数
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = len(pcm_data)
        file_size = 36 + data_size
        
        # 构建WAV文件头
        wav_header = struct.pack('<4sI4s4sIHHIIHH4sI',
            b'RIFF',           # ChunkID
            file_size,        # ChunkSize
            b'WAVE',          # Format
            b'fmt ',          # Subchunk1ID
            16,               # Subchunk1Size (PCM)
            1,                # AudioFormat (PCM)
            channels,         # NumChannels
            sample_rate,      # SampleRate
            byte_rate,        # ByteRate
            block_align,      # BlockAlign
            bits_per_sample,  # BitsPerSample
            b'data',          # Subchunk2ID
            data_size         # Subchunk2Size
        )
        
        # 组合头部和数据
        return wav_header + pcm_data
    
    def _validate_audio_data(self, audio_data: bytes, expected_format: Optional[str] = None) -> Dict[str, Any]:
        """验证音频数据的完整性和格式
        
        Args:
            audio_data: 音频数据
            expected_format: 期望的音频格式
            
        Returns:
            包含验证结果的字典
        """
        if not audio_data or len(audio_data) < 44:  # WAV最小头部大小
            return {
                'valid': False,
                'error': f'音频数据太小: {len(audio_data) if audio_data else 0} bytes',
                'format': 'unknown',
                'size': len(audio_data) if audio_data else 0
            }
        
        # 检测音频格式
        detected_format = 'unknown'
        if len(audio_data) >= 12:
            # WAV格式检测
            if (audio_data[0:4] == b'RIFF' and 
                audio_data[8:12] == b'WAVE'):
                detected_format = 'wav'
            # MP3格式检测
            elif (audio_data[0] == 0xFF and (audio_data[1] & 0xE0) == 0xE0) or \
                 (audio_data[0:3] == b'ID3'):
                detected_format = 'mp3'
            # OGG格式检测
            elif audio_data[0:4] == b'OggS':
                detected_format = 'ogg'
        
        return {
            'valid': True,
            'format': detected_format,
            'size': len(audio_data),
            'expected_format': expected_format,
            'format_match': detected_format == expected_format if expected_format else True
        }

    def _get_voice_config(self, voice_type: str, quality: str) -> Dict[str, Any]:
        """获取音色配置"""
        # 音色映射 - 使用当前账户有权限的音色
        voice_mapping = {
            "default": "zh_female_xinlingjitang_moon_bigtts",
            "female": "zh_female_xinlingjitang_moon_bigtts",
            "male": "zh_female_xinlingjitang_moon_bigtts",  # 暂时使用女声，因为男声无权限
            "child": "zh_female_xinlingjitang_moon_bigtts",  # 暂时使用基础女声
            "elderly": "zh_female_xinlingjitang_moon_bigtts"  # 暂时使用基础女声
        }
        
        # 质量配置 - 根据官方文档优化音频格式
        # 官方文档建议：在流式场景下使用 pcm 格式，避免 wav 多次返回 header 的问题
        quality_config = {
            "draft": {
                "encoding": "wav",  # 尝试使用 WAV 格式
                "speed_ratio": 1.0,
                "volume_ratio": 1.0,
                "pitch_ratio": 1.0
            },
            "high": {
                "encoding": "wav",  # 高质量也使用 WAV
                "speed_ratio": 1.0,
                "volume_ratio": 1.0,
                "pitch_ratio": 1.0
            }
        }
        
        config = quality_config.get(quality, quality_config["draft"]).copy()
        config["voice_type"] = voice_mapping.get(voice_type, voice_mapping["default"])
        
        return config

    def _get_cluster_for_voice(self, voice_type: str) -> str:
        """根据声音类型获取正确的cluster配置"""
        # 复刻声音ID通常以 S_ 开头
        if voice_type and voice_type.startswith('S_'):
            return "volcano_icl"
        # 普通TTS使用volcano_tts
        return "volcano_tts"

    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> bytes:
        """合成语音"""
        print(f"[PROD_ADAPTER DEBUG] synthesize() called with text='{text[:20]}...', voice_type={voice_type}")
        print(f"[PROD_ADAPTER DEBUG] use_app_token_auth={self.use_app_token_auth}, use_signature_auth={self.use_signature_auth}")
        
        if not self.validate_text(text):
            raise ValueError("Invalid text input")
        
        # 提取emotion参数
        emotion = kwargs.get('emotion', 'neutral')
        
        # 判断是否为复刻声音（仅当以 S_ 开头时）
        is_voice_clone = bool(voice_type and voice_type.startswith('S_'))
        
        # 验证复刻声音ID
        if is_voice_clone:
            if not self._validate_voice_clone_id(voice_type):
                raise ValueError(f"Invalid voice clone ID format: {voice_type}. Voice clone IDs should start with 'S_' and be 5-50 characters long.")
            print(f"[PROD_ADAPTER DEBUG] Validated voice clone ID: {voice_type}")
        
        # 获取音色配置（用于编码、速率等）；voice_type 映射只在使用预设别名时生效
        voice_config = self._get_voice_config(voice_type, quality)
        
        # 根据声音类型选择正确的cluster
        cluster = self._get_cluster_for_voice(voice_type)
        
        # 如果 voice_type 是我们支持的别名（如 default/female/male/child/elderly），使用映射，否则尊重用户传入的具体 speaker
        predefined_aliases = {"default", "female", "male", "child", "elderly"}
        actual_voice_type = voice_config["voice_type"] if voice_type in predefined_aliases else voice_type
        
        print(f"[PROD_ADAPTER DEBUG] Using speaker: {actual_voice_type}, emotion: {emotion}, cluster: {cluster}, is_voice_clone: {is_voice_clone}")
        
        # v1 构建请求负载 - 按照官方文档格式
        payload = {
            "app": {
                "appid": self.app_id,
                "token": self.access_token,
                "cluster": cluster  # 动态选择cluster
            },
            "user": {
                "uid": "prenatal_education_user"
            },
            "audio": {
                "voice_type": actual_voice_type,
                "encoding": voice_config["encoding"],
                "speed_ratio": voice_config["speed_ratio"],
                "volume_ratio": voice_config["volume_ratio"],
                "pitch_ratio": voice_config["pitch_ratio"]
            },
            "request": {
                "reqid": f"prenatal_{int(time.time() * 1000)}",
                "text": text,
                "text_type": "plain",
                "operation": "submit"
            }
        }
        
        # 如果是多情感语音且指定了emotion，添加emotion参数
        if emotion and emotion != 'neutral' and ('emo' in actual_voice_type or is_voice_clone):
            payload["audio"]["emotion"] = emotion
            print(f"[PROD_ADAPTER DEBUG] Added emotion parameter: {emotion}")
        
        # TTS 请求不需要声音复刻的 Resource-Id 头部
        return self._make_request_with_retry(payload, is_voice_clone=False)
    
    def _make_request_with_retry(self, payload: Dict[str, Any], is_voice_clone: bool = False) -> bytes:
        """带重试的请求
        注意：is_voice_clone=True 仅用于声音复刻相关接口需要的特殊头部，不用于TTS合成。
        """
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                # 构建请求
                req_data = json.dumps(payload).encode("utf-8")
                
                # 构建请求头
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer;{self.access_token}"
                }
                
                # 仅在调用声音复刻相关接口时设置 Resource-Id
                if is_voice_clone:
                    headers["Resource-Id"] = "volc.megatts.voiceclone"
                    print("[PROD_ADAPTER DEBUG] Added Resource-Id header for voice clone")
                
                req = urllib.request.Request(
                    self.api_url,
                    data=req_data,
                    headers=headers
                )
                
                # Debug: 请求信息
                print(f"[PROD_ADAPTER DEBUG] API URL: {self.api_url}")
                print(f"[PROD_ADAPTER DEBUG] Request payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
                print(f"[PROD_ADAPTER DEBUG] Request headers: {dict(req.headers)}")

                
                # 发送请求
                ctx = self._build_ssl_context()
                with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as response:
                    response_data = response.read()
                    
                    # Debug: 响应信息
                    print(f"[PROD_ADAPTER DEBUG] Response status: {response.getcode()}")
                    print(f"[PROD_ADAPTER DEBUG] Response headers: {dict(response.headers)}")
                    print(f"[PROD_ADAPTER DEBUG] Response size: {len(response_data)} bytes")
                    
                    # 尝试解析JSON响应
                    try:
                        json_response = json.loads(response_data.decode("utf-8"))
                        print(f"[PROD_ADAPTER DEBUG] Full JSON response: {json.dumps(json_response, indent=2, ensure_ascii=False)}")
                        
                        # 检查响应是否成功
                        if "code" in json_response:
                            code = json_response["code"]
                            if code == 0:
                                # 成功，继续在下面的通用解析逻辑中提取音频
                                pass
                            elif code == 3000 and json_response.get("operation") == "submit":
                                # 提交已接受，进入 query 轮询直到合成完成或超时
                                reqid = json_response.get("reqid") or payload.get("request", {}).get("reqid")
                                if not reqid:
                                    raise Exception("Volcengine API returned 3000 but no reqid to query")
                                deadline = time.time() + self.timeout
                                poll_count = 0
                                while time.time() < deadline:
                                    poll_count += 1
                                    query_payload = {
                                        "app": payload.get("app", {}),
                                        "user": payload.get("user", {}),
                                        "audio": payload.get("audio", {}),
                                        "request": {
                                            "reqid": reqid,
                                            "operation": "query",
                                            # query 操作也需要包含 text 字段，否则会返回 "Do not support empty input!"
                                            "text": payload.get("request", {}).get("text", ""),
                                            "text_type": payload.get("request", {}).get("text_type", "plain")
                                        }
                                    }
                                    print(f"[PROD_ADAPTER DEBUG] Query payload: {json.dumps(query_payload, indent=2, ensure_ascii=False)}")
                                    q_req_data = json.dumps(query_payload).encode("utf-8")
                                    q_req = urllib.request.Request(
                                        self.api_url,
                                        data=q_req_data,
                                        headers={
                                            "Content-Type": "application/json",
                                            "Authorization": f"Bearer;{self.access_token}"
                                        }
                                    )
                                    print("[PROD_ADAPTER DEBUG] Query request headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ***'}")
                                    try:
                                        remaining = max(1, int(deadline - time.time()))
                                        with urllib.request.urlopen(q_req, timeout=remaining, context=ctx) as q_resp:
                                            q_data = q_resp.read()
                                            try:
                                                q_json = json.loads(q_data.decode("utf-8"))
                                                print(f"[PROD_ADAPTER DEBUG] Query JSON response: {json.dumps(q_json, indent=2, ensure_ascii=False)}")
                                                q_code = q_json.get("code")
                                                
                                                # 首先检查是否有音频数据，无论 code 是什么
                                                audio_base64 = None
                                                if "data" in q_json and isinstance(q_json["data"], str):
                                                    audio_base64 = q_json["data"]
                                                elif "data" in q_json and isinstance(q_json["data"], dict):
                                                    if "audio" in q_json["data"] and isinstance(q_json["data"]["audio"], str):
                                                        audio_base64 = q_json["data"]["audio"]
                                                    elif "audio" in q_json["data"] and isinstance(q_json["data"]["audio"], dict):
                                                        if "bytes" in q_json["data"]["audio"] and isinstance(q_json["data"]["audio"]["bytes"], str):
                                                            audio_base64 = q_json["data"]["audio"]["bytes"]
                                                elif "audio" in q_json and isinstance(q_json["audio"], str):
                                                    audio_base64 = q_json["audio"]
                                                
                                                # 如果有音频数据，直接返回（无论 code 是 0 还是 3000）
                                                if audio_base64:
                                                    print(f"[PROD_ADAPTER DEBUG] Found audio data in query response with code {q_code}")
                                                    return base64.b64decode(audio_base64)
                                                
                                                # 如果没有音频数据，检查是否是成功状态但缺少数据
                                                if q_code == 0:
                                                    print(f"[PROD_ADAPTER DEBUG] No audio data in successful query response; available fields: {list(q_json.keys())}")
                                                    raise Exception("No audio data found in API response")
                                                
                                                # 将一批处理中状态统一视为继续轮询（但排除已有音频数据的情况）
                                                in_progress = False
                                                if isinstance(q_code, int):
                                                    if q_code == 3000 or q_code == 3001 or (3000 <= q_code < 3200):
                                                        in_progress = True
                                                if in_progress or str(q_json.get("message", "")).lower() in ("processing", "pending"):
                                                    time.sleep(1.2)
                                                    continue
                                                else:
                                                    err = q_json.get("message", "Unknown error")
                                                    raise Exception(f"Volcengine API error ({q_code}): {err}")
                                            except json.JSONDecodeError as qe:
                                                print(f"[PROD_ADAPTER DEBUG] JSON decode error on query: {qe}")
                                                print(f"[PROD_ADAPTER DEBUG] Raw query response (first 500 chars): {q_data[:500]}")
                                                # 如果不是JSON，可能是直接的音频数据
                                                if len(q_data) > 100:
                                                    print("[PROD_ADAPTER DEBUG] Treating query response as raw audio data")
                                                    return q_data
                                                else:
                                                    raise Exception(f"Invalid JSON response on query: {qe}")
                                    except urllib.error.HTTPError as he:
                                        error_body = he.read().decode('utf-8') if he.fp else str(he)
                                        print(f"[PROD_ADAPTER DEBUG] Query HTTPError {he.code}: {error_body}")
                                        if he.code in [429, 500, 502, 503, 504] and time.time() < deadline:
                                            time.sleep(1.5)
                                            continue
                                        elif he.code == 404 and time.time() < deadline:
                                            # 任务可能尚未就绪，稍后继续轮询
                                            time.sleep(1.0)
                                            continue
                                        elif he.code == 401:
                                            raise Exception("Authentication failed: Invalid access token")
                                        elif he.code == 403:
                                            raise Exception("Access forbidden: Check your permissions")
                                        else:
                                            raise Exception(f"TTS service error ({he.code}): {error_body}")
                                    except urllib.error.URLError as ue:
                                        print(f"[PROD_ADAPTER DEBUG] Query URLError: {ue}")
                                        if ("timeout" in str(ue).lower() or "timed out" in str(ue).lower()) and time.time() < deadline:
                                            time.sleep(1.2)
                                            continue
                                        elif time.time() < deadline:
                                            time.sleep(1.0)
                                            continue
                                        else:
                                            raise Exception("Request timeout: TTS synthesis took too long")
                                # 超时
                                raise Exception("Request timeout: TTS synthesis took too long")
                            else:
                                error_msg = json_response.get("message", "Unknown error")
                                print(f"[PROD_ADAPTER DEBUG] API returned error code {code}: {error_msg}")
                                raise Exception(f"Volcengine API error ({code}): {error_msg}")
                        
                        # 查找音频数据 - 支持多种可能的响应格式
                        audio_base64 = None
                        
                        # 格式1: data字段直接包含base64字符串
                        if "data" in json_response and isinstance(json_response["data"], str):
                            audio_base64 = json_response["data"]
                            print("[PROD_ADAPTER DEBUG] Found audio in data field (string)")
                        
                        # 格式2: data.audio字段
                        elif "data" in json_response and isinstance(json_response["data"], dict):
                            if "audio" in json_response["data"]:
                                audio_base64 = json_response["data"]["audio"]
                                print("[PROD_ADAPTER DEBUG] Found audio in data.audio field")
                            elif json_response["data"]:
                                # data字典中的第一个值可能是音频
                                first_value = next(iter(json_response["data"].values()), None)
                                if isinstance(first_value, str) and len(first_value) > 100:  # 假设音频base64至少100字符
                                    audio_base64 = first_value
                                    print("[PROD_ADAPTER DEBUG] Found audio as first value in data dict")
                        
                        # 格式3: 直接在audio字段
                        elif "audio" in json_response:
                            audio_base64 = json_response["audio"]
                            print("[PROD_ADAPTER DEBUG] Found audio in audio field")
                        
                        # 格式4: result字段（某些API版本）
                        elif "result" in json_response:
                            result = json_response["result"]
                            if isinstance(result, str):
                                audio_base64 = result
                                print("[PROD_ADAPTER DEBUG] Found audio in result field")
                            elif isinstance(result, dict) and "audio" in result:
                                audio_base64 = result["audio"]
                                print("[PROD_ADAPTER DEBUG] Found audio in result.audio field")
                        
                        # 如果找到了音频数据，解码并返回
                        if audio_base64:
                            try:
                                audio_data = base64.b64decode(audio_base64)
                                print(f"[PROD_ADAPTER DEBUG] Successfully decoded audio data size: {len(audio_data)} bytes")
                                
                                # 验证音频数据完整性
                                validation = self._validate_audio_data(audio_data)
                                if not validation['valid']:
                                    print(f"[PROD_ADAPTER DEBUG] Audio validation failed: {validation['error']}")
                                    raise Exception(f"Invalid audio data: {validation['error']}")
                                
                                print(f"[PROD_ADAPTER DEBUG] Audio validation: format={validation['format']}, size={validation['size']} bytes")
                                
                                # 如果是PCM数据，转换为WAV格式以确保浏览器兼容性
                                # 注：这里暂时假设默认为PCM格式需要转换
                                if True:  # voice_config["encoding"] == "pcm":
                                    print("[PROD_ADAPTER DEBUG] Converting PCM to WAV format for browser compatibility")
                                    audio_data = self._pcm_to_wav(audio_data, sample_rate=self.sample_rate)
                                    print(f"[PROD_ADAPTER DEBUG] WAV conversion completed, new size: {len(audio_data)} bytes")
                                    
                                    # 再次验证转换后的WAV数据
                                    wav_validation = self._validate_audio_data(audio_data, 'wav')
                                    if wav_validation['valid'] and wav_validation['format'] == 'wav':
                                        print("[PROD_ADAPTER DEBUG] WAV format validation successful")
                                    else:
                                        print(f"[PROD_ADAPTER DEBUG] WAV validation warning: {wav_validation}")
                                
                                return audio_data
                            except Exception as decode_error:
                                print(f"[PROD_ADAPTER DEBUG] Failed to decode base64 audio: {decode_error}")
                                raise Exception(f"Failed to decode audio data: {decode_error}")
                        else:
                            print("[PROD_ADAPTER DEBUG] No audio data found in any expected field")
                            print(f"[PROD_ADAPTER DEBUG] Available fields: {list(json_response.keys())}")
                            raise Exception("No audio data found in API response")
                            
                    except json.JSONDecodeError as json_error:
                        print(f"[PROD_ADAPTER DEBUG] JSON decode error: {json_error}")
                        print(f"[PROD_ADAPTER DEBUG] Raw response (first 500 chars): {response_data[:500]}")
                        
                        # 如果不是JSON，可能是直接的音频数据（不太可能但要处理）
                        if len(response_data) > 100:  # 假设音频至少100字节
                            print("[PROD_ADAPTER DEBUG] Treating as raw audio data")
                            return response_data
                        else:
                            raise Exception(f"Invalid JSON response: {json_error}")
                        
            except urllib.error.HTTPError as e:
                last_exception = e
                error_body = e.read().decode('utf-8') if e.fp else str(e)
                
                # 添加详细的错误日志
                print(f"[PROD_ADAPTER ERROR] HTTP {e.code} on attempt {attempt + 1}: {error_body}")
                if is_voice_clone:
                    print(f"[PROD_ADAPTER ERROR] Voice clone request failed with HTTP {e.code}")
                
                # 根据错误码决定是否重试
                if e.code in [429, 500, 502, 503, 504] and attempt < self.max_retries:
                    # 指数退避 + 抖动
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    print(f"[PROD_ADAPTER DEBUG] Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    continue
                else:
                    # 不重试的错误或已达最大重试次数
                    if e.code == 401:
                        if is_voice_clone:
                            raise Exception("Voice clone authentication failed: Invalid access token or missing Resource-Id header")
                        else:
                            raise Exception("Authentication failed: Invalid access token")
                    elif e.code == 403:
                        if is_voice_clone:
                            raise Exception("Voice clone access forbidden: Check your voice clone permissions and Resource-Id")
                        else:
                            raise Exception("Access forbidden: Check your permissions")
                    elif e.code == 429:
                        raise Exception("Rate limit exceeded: Please try again later")
                    elif e.code in [400, 422]:
                        if is_voice_clone:
                            raise Exception(f"Invalid voice clone request: {error_body}. Please check voice ID format and parameters.")
                        else:
                            raise Exception(f"Invalid request: {error_body}")
                    elif e.code == 500:
                        if is_voice_clone:
                            raise Exception(f"Voice clone server error: The voice ID may be invalid, expired, or not properly trained. Error details: {error_body}")
                        else:
                            raise Exception(f"TTS service error ({e.code}): {error_body}")
                    else:
                        if is_voice_clone:
                            raise Exception(f"Voice clone service error ({e.code}): {error_body}")
                        else:
                            raise Exception(f"TTS service error ({e.code}): {error_body}")
                        
            except urllib.error.URLError as e:
                last_exception = e
                # URLError 通常是网络连接问题或超时
                if "timeout" in str(e).lower() or "timed out" in str(e).lower():
                    if attempt < self.max_retries:
                        delay = (2 ** attempt) + random.uniform(0, 1)
                        print(f"[PROD_ADAPTER DEBUG] Request timeout on attempt {attempt + 1}, retrying in {delay:.1f}s...")
                        time.sleep(delay)
                        continue
                    else:
                        # 明确标识为超时错误，便于上层映射
                        raise Exception("Request timeout: TTS synthesis took too long")
                else:
                    if attempt < self.max_retries:
                        delay = (2 ** attempt) + random.uniform(0, 1)
                        print(f"[PROD_ADAPTER DEBUG] Network error on attempt {attempt + 1}: {str(e)}, retrying in {delay:.1f}s...")
                        time.sleep(delay)
                        continue
                    else:
                        raise Exception(f"Network error: {str(e)}")
                        
            except Exception as e:
                last_exception = e
                # 检查是否是超时异常
                if "timeout" in str(e).lower() or "timed out" in str(e).lower():
                    if attempt < self.max_retries:
                        delay = (2 ** attempt) + random.uniform(0, 1)
                        print(f"[PROD_ADAPTER DEBUG] General timeout on attempt {attempt + 1}, retrying in {delay:.1f}s...")
                        time.sleep(delay)
                        continue
                    else:
                        raise Exception("Request timeout: TTS synthesis took too long")
                elif attempt < self.max_retries:
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    print(f"[PROD_ADAPTER DEBUG] General error on attempt {attempt + 1}: {str(e)}, retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(f"TTS request failed: {str(e)}")
        
        # 如果所有重试都失败了
        raise Exception(f"TTS request failed after {self.max_retries + 1} attempts: {str(last_exception)}")

    def _make_request_v1_x_api_key(self, payload: Dict[str, Any], resource_id: Optional[str] = None) -> bytes:
        """使用 v1 TTS 接口（x-api-key 认证）发起请求，支持 submit->query 轮询与音频解析。"""
        last_exception = None
        for attempt in range(self.max_retries + 1):
            try:
                req_data = json.dumps(payload).encode("utf-8")
                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": self.access_token
                }
                if resource_id:
                    headers["X-Api-Resource-Id"] = resource_id
                req = urllib.request.Request(self.api_url, data=req_data, headers=headers)
                print(f"[PROD_ADAPTER V1X] API URL: {self.api_url}")
                if resource_id:
                    print("[PROD_ADAPTER V1X] Headers: {'Content-Type': 'application/json', 'x-api-key': '***', 'X-Api-Resource-Id': '***'}")
                else:
                    print("[PROD_ADAPTER V1X] Headers: {'Content-Type': 'application/json', 'x-api-key': '***'}")
                print(f"[PROD_ADAPTER V1X] Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")

                ctx = self._build_ssl_context()
                with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as resp:
                    resp_bytes = resp.read()
                    try:
                        j = json.loads(resp_bytes.decode('utf-8'))
                        print(f"[PROD_ADAPTER V1X] JSON: {json.dumps(j, indent=2, ensure_ascii=False)}")
                        code = j.get("code")
                        if code == 3000 and j.get("operation") == "submit":
                            # 进入轮询
                            reqid = j.get("reqid") or payload.get("request", {}).get("reqid")
                            if not reqid:
                                raise Exception("API returned 3000 but no reqid present")
                            deadline = time.time() + self.timeout
                            while time.time() < deadline:
                                query_payload = {
                                    "app": payload.get("app", {}),
                                    "user": payload.get("user", {}),
                                    "audio": payload.get("audio", {}),
                                    "request": {
                                        "reqid": reqid,
                                        "operation": "query",
                                        "text": payload.get("request", {}).get("text", ""),
                                        "text_type": payload.get("request", {}).get("text_type", "plain"),
                                        "enable_subtitle": payload.get("request", {}).get("enable_subtitle", False)
                                    }
                                }
                                q_headers = {
                                    "Content-Type": "application/json",
                                    "x-api-key": self.access_token
                                }
                                if resource_id:
                                    q_headers["X-Api-Resource-Id"] = resource_id
                                q_req = urllib.request.Request(
                                    self.api_url,
                                    data=json.dumps(query_payload).encode("utf-8"),
                                    headers=q_headers
                                )
                                with urllib.request.urlopen(q_req, timeout=max(1, int(deadline - time.time())), context=ctx) as q_resp:
                                    q_data = q_resp.read()
                                    try:
                                        q_json = json.loads(q_data.decode('utf-8'))
                                        # 优先解析音频
                                        audio_b64 = None
                                        if isinstance(q_json.get('data'), str):
                                            audio_b64 = q_json['data']
                                        elif isinstance(q_json.get('data'), dict):
                                            d = q_json['data']
                                            if isinstance(d.get('audio'), str):
                                                audio_b64 = d['audio']
                                            elif isinstance(d.get('audio'), dict) and isinstance(d['audio'].get('bytes'), str):
                                                audio_b64 = d['audio']['bytes']
                                        if not audio_b64 and isinstance(q_json.get('audio'), str):
                                            audio_b64 = q_json['audio']
                                        if audio_b64:
                                            audio_data = base64.b64decode(audio_b64)
                                            print(f"[PROD_ADAPTER V1X] Decoded audio size: {len(audio_data)} bytes")
                                            
                                            # 验证和转换音频数据
                                            validation = self._validate_audio_data(audio_data)
                                            if validation['valid']:
                                                print(f"[PROD_ADAPTER V1X] Audio validation: format={validation['format']}, size={validation['size']} bytes")
                                                
                                                # 如果是PCM数据，转换为WAV格式
                                                # 注：这里暂时假设默认为PCM格式需要转换
                                                if True:  # v1_payload["audio"]["encoding"] == "pcm":
                                                    print("[PROD_ADAPTER V1X] Converting PCM to WAV format")
                                                    audio_data = self._pcm_to_wav(audio_data, sample_rate=self.sample_rate)
                                                    print(f"[PROD_ADAPTER V1X] WAV conversion completed, new size: {len(audio_data)} bytes")
                                            
                                            return audio_data
                                        # 处理中则继续
                                        q_code = q_json.get('code')
                                        if isinstance(q_code, int) and (q_code == 3000 or 3000 <= q_code < 3200):
                                            time.sleep(1.0)
                                            continue
                                        # 失败
                                        raise Exception(f"V1 x-api-key query error ({q_code}): {q_json.get('message', 'Unknown')}")
                                    except json.JSONDecodeError:
                                        if len(q_data) > 100:
                                            return q_data
                                        raise Exception("Invalid JSON on v1 x-api-key query")
                            raise Exception("Request timeout: TTS synthesis took too long")
                        # 非 3000，尝试直接解析音频
                        audio_b64 = None
                        if isinstance(j.get('data'), str):
                            audio_b64 = j['data']
                        elif isinstance(j.get('data'), dict):
                            d = j.get('data')
                            if isinstance(d.get('audio'), str):
                                audio_b64 = d['audio']
                            elif isinstance(d.get('audio'), dict) and isinstance(d['audio'].get('bytes'), str):
                                audio_b64 = d['audio']['bytes']
                        if not audio_b64 and isinstance(j.get('audio'), str):
                            audio_b64 = j['audio']
                        if audio_b64:
                            return base64.b64decode(audio_b64)
                        # 非JSON或无音频，尝试原始音频
                        if len(resp_bytes) > 100:
                            return resp_bytes
                        raise Exception("No audio data in v1 x-api-key response")
                    except json.JSONDecodeError:
                        if len(resp_bytes) > 100:
                            return resp_bytes
                        raise Exception("Invalid response from v1 x-api-key API")
            except urllib.error.HTTPError as e:
                last_exception = e
                body = e.read().decode('utf-8') if e.fp else str(e)
                print(f"[PROD_ADAPTER V1X] HTTP {e.code}: {body}")
                if e.code in [429, 500, 502, 503, 504] and attempt < self.max_retries:
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
                    continue
                elif e.code == 401:
                    raise Exception("Invalid API key or unauthorized for v1 API")
                elif e.code == 403:
                    raise Exception("Forbidden: check permissions for v1 API")
                else:
                    raise Exception(f"TTS v1 (x-api-key) service error ({e.code}): {body}")
            except urllib.error.URLError as e:
                last_exception = e
                if ("timeout" in str(e).lower() or "timed out" in str(e).lower()) and attempt < self.max_retries:
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
                    continue
                elif attempt < self.max_retries:
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
                    continue
                else:
                    raise Exception(f"Network error calling v1 x-api-key API: {e}")
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries:
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
                    continue
                else:
                    raise
        raise Exception(f"TTS v1 (x-api-key) request failed after {self.max_retries + 1} attempts: {last_exception}")


    
    def _validate_voice_clone_id(self, voice_id: str) -> bool:
        """验证复刻声音ID格式"""
        if not voice_id:
            return False
        # 复刻声音ID通常以S_开头
        if not voice_id.startswith('S_'):
            return False
        # 检查ID长度和格式
        if len(voice_id) < 5 or len(voice_id) > 50:
            return False
        return True
    
    
    def estimate_cost(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> float:
        """估算费用"""
        if not text:
            return 0.0
        
        # 按字符数计费
        char_count = len(text)
        base_cost = (char_count / 1000.0) * self.price_per_1k_char
        
        # 高质量音频加价
        if quality == "high":
            base_cost *= self.high_quality_multiplier
        
        # 不同音色价格差异（简化处理）
        voice_multiplier = {
            "premium": 1.5,
            "standard": 1.0,
            "basic": 0.8
        }.get(voice_type, 1.0)
        
        return round(base_cost * voice_multiplier, 4)
    
    def get_provider_name(self) -> str:
        """获取提供商名称"""
        return "volcengine"
    
    def voice_clone(self, speaker_id: str, audio_data: bytes, audio_format: str = "wav", 
                   language: str = "zh", model_type: int = 1, **kwargs) -> Dict[str, Any]:
        """声音复刻（2.0 上传训练接口）"""
        try:
            # 语言映射到文档中的枚举值
            lang_map = {"zh": 0, "cn": 0, "en": 1, "ja": 2, "es": 3, "id": 4, "pt": 5, "de": 6, "fr": 7}
            if isinstance(language, int):
                language_val = language
            else:
                language_val = lang_map.get(str(language).lower(), 0)
            
            # extra_params 需要为 json 字符串
            extra_params = kwargs.get("extra_params") or {}
            if isinstance(extra_params, str):
                extra_params_str = extra_params
            else:
                extra_params_str = json.dumps(extra_params, ensure_ascii=False)
            
            audio_item: Dict[str, Any] = {
                "audio_bytes": base64.b64encode(audio_data).decode('utf-8'),
                "audio_format": audio_format
            }
            if kwargs.get("text"):
                audio_item["text"] = str(kwargs.get("text"))
            
            # 构建请求payload - 声音复刻2.0
            payload = {
                "appid": self.app_id,
                "speaker_id": speaker_id,
                "audios": [audio_item],
                "source": 2,
                "language": language_val,
                "model_type": model_type,
                "extra_params": extra_params_str
            }
            
            print(f"[VOICE_CLONE DEBUG] Voice clone (upload) payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
            
            # 发送请求
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.voice_clone_upload_url,
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer;{self.access_token}",
                    "Resource-Id": "volc.megatts.voiceclone"  # 声音复刻专用Resource-Id
                }
            )
            
            ctx = self._build_ssl_context()
            with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as response:
                response_data = response.read()
                json_response = json.loads(response_data.decode("utf-8"))
                
                print(f"[VOICE_CLONE DEBUG] Voice clone (upload) response: {json.dumps(json_response, indent=2, ensure_ascii=False)}")
                
                base_resp = json_response.get("BaseResp") or {}
                status_code = base_resp.get("StatusCode")
                if status_code == 0 or json_response.get("code") == 0:
                    return {
                        "success": True,
                        "speaker_id": speaker_id,
                        "status": "submitted",
                        "message": base_resp.get("StatusMessage", "")
                    }
                else:
                    error_msg = base_resp.get("StatusMessage") or json_response.get("message", "Unknown error")
                    return {
                        "success": False,
                        "error": f"Voice clone upload failed: {error_msg}",
                        "code": status_code or json_response.get("code")
                    }
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else str(e)
            print(f"[VOICE_CLONE ERROR] HTTP {e.code}: {error_body}")
            if e.code == 400:
                return {
                    "success": False,
                    "error": f"Bad Request (400): Invalid parameters or format. Details: {error_body}"
                }
            elif e.code == 401:
                return {
                    "success": False,
                    "error": "Authentication failed: Invalid access token"
                }
            elif e.code == 403:
                return {
                    "success": False,
                    "error": "Access forbidden: Check your permissions"
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {e.code}: {error_body}"
                }
        except Exception as e:
            print(f"[VOICE_CLONE ERROR] {str(e)}")
            return {
                "success": False,
                "error": f"Voice clone request failed: {str(e)}"
            }
    
    def get_voice_clone_status(self, speaker_id: str, **kwargs) -> Dict[str, Any]:
        """查询声音复刻状态（2.0 status接口）"""
        try:
            # 构建查询请求payload（2.0 文档规范）
            payload = {
                "appid": self.app_id,
                "speaker_id": speaker_id
            }
            
            print(f"[VOICE_CLONE DEBUG] Status query payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
            
            # 发送请求
            req_data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.voice_clone_status_url,
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer;{self.access_token}",
                    "Resource-Id": "volc.megatts.voiceclone"  # 声音复刻专用Resource-Id
                }
            )
            
            ctx = self._build_ssl_context()
            with urllib.request.urlopen(req, timeout=self.timeout, context=ctx) as response:
                response_data = response.read()
                json_response = json.loads(response_data.decode("utf-8"))
                
                print(f"[VOICE_CLONE DEBUG] Status response: {json.dumps(json_response, indent=2, ensure_ascii=False)}")
                
                base_resp = json_response.get("BaseResp") or {}
                code = base_resp.get("StatusCode")
                if code == 0:
                    status_val = json_response.get("status")
                    status_map = {0: "not_found", 1: "training", 2: "success", 3: "failed", 4: "active"}
                    status_str = status_map.get(status_val, "unknown")
                    progress = 100 if status_val in (2, 4) else 50 if status_val == 1 else 0
                    return {
                        "success": True,
                        "speaker_id": speaker_id,
                        "status": status_str,
                        "progress": progress,
                        "message": base_resp.get("StatusMessage", "")
                    }
                else:
                    error_msg = base_resp.get("StatusMessage", "Unknown error")
                    print(f"[VOICE_CLONE ERROR] Status query API returned error code {code}: {error_msg}")
                    return {
                        "success": False,
                        "error": f"Status query failed: {error_msg}",
                        "code": code
                    }
                    
        except urllib.error.HTTPError as e:
            error_body = e.read().decode('utf-8') if e.fp else str(e)
            print(f"[VOICE_CLONE ERROR] Status query HTTP {e.code}: {error_body}")
            if e.code == 400:
                return {
                    "success": False,
                    "error": f"Bad Request (400): Invalid parameters or format. Details: {error_body}"
                }
            elif e.code == 401:
                return {
                    "success": False,
                    "error": "Authentication failed: Invalid access token"
                }
            elif e.code == 403:
                return {
                    "success": False,
                    "error": "Access forbidden: Check your permissions"
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {e.code}: {error_body}"
                }
        except Exception as e:
            print(f"[VOICE_CLONE ERROR] {str(e)}")
            return {
                "success": False,
                "error": f"Status query failed: {str(e)}"
            }
    
    def list_cloned_voices(self, **kwargs) -> List[Dict[str, Any]]:
        """获取已复刻的声音列表"""
        try:
            # 火山引擎API可能没有直接的列表接口，这里返回模拟数据
            # 实际实现中可能需要维护一个本地的声音列表或使用其他API
            return [
                {
                    "speaker_id": "demo_speaker_1",
                    "name": "演示声音1",
                    "status": "completed",
                    "created_at": "2024-01-01T00:00:00Z",
                    "language": "zh",
                    "model_type": 1
                },
                {
                    "speaker_id": "demo_speaker_2",
                    "name": "演示声音2",
                    "status": "training",
                    "created_at": "2024-01-02T00:00:00Z",
                    "language": "zh",
                    "model_type": 2
                }
            ]
            
        except Exception as e:
            print(f"[VOICE_CLONE ERROR] {str(e)}")
            return []

    def _generate_signature(self, method: str, url: str, headers: Dict[str, str], body: str = '') -> str:
        """生成火山引擎标准签名"""
        # 解析URL
        parsed_url = urlparse(url)
        path = parsed_url.path or '/'
        query = parsed_url.query
        
        # 规范化查询参数
        if query:
            query_params = []
            for param in query.split('&'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    query_params.append(f"{quote(key, safe='')}{quote(value, safe='')}")
                else:
                    query_params.append(quote(param, safe=''))
            canonical_query = '&'.join(query_params)
        else:
            canonical_query = ''
        
        # 规范化头部
        canonical_headers = []
        signed_headers = []
        for key in sorted(headers.keys()):
            if key.lower().startswith('x-') or key.lower() in ['host', 'content-type', 'date']:
                canonical_headers.append(f"{key.lower()}:{headers[key].strip()}")
                signed_headers.append(key.lower())
        
        canonical_headers_str = '\n'.join(canonical_headers)
        signed_headers_str = ';'.join(signed_headers)
        
        # 计算body的SHA256哈希
        body_hash = hashlib.sha256(body.encode('utf-8')).hexdigest()
        
        # 构建规范化请求
        canonical_request = '\n'.join([
            method.upper(),
            path,
            canonical_query,
            canonical_headers_str,
            '',
            signed_headers_str,
            body_hash
        ])
        
        # 计算规范化请求的哈希
        canonical_request_hash = hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        
        # 构建待签名字符串
        timestamp = headers.get('X-Date', '')
        credential_scope = f"{timestamp[:8]}/volc/request"
        string_to_sign = '\n'.join([
            'HMAC-SHA256',
            timestamp,
            credential_scope,
            canonical_request_hash
        ])
        
        # 计算签名
        def sign(key: bytes, msg: str) -> bytes:
            return hmac.new(key, msg.encode('utf-8'), hashlib.sha256).digest()
        
        date_key = sign(f"volc{self.secret_access_key}".encode('utf-8'), timestamp[:8])
        region_key = sign(date_key, "volc")
        service_key = sign(region_key, "request")
        signing_key = service_key
        
        signature = hmac.new(signing_key, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
        
        # 构建Authorization头部
        authorization = f"HMAC-SHA256 Credential={self.access_key_id}/{credential_scope}, SignedHeaders={signed_headers_str}, Signature={signature}"
        
        return authorization
    
    def _build_signature_headers(self, method: str, url: str, body: str = '') -> Dict[str, str]:
        """构建包含签名的请求头部（支持APP ID+Access Token或AK/SK签名鉴权）
        
        Args:
            method: HTTP方法
            url: 请求URL
            body: 请求体
            
        Returns:
            包含签名的头部字典
        """
        if self.use_app_token_auth:
            # 使用APP ID和Access Token认证
            headers = {
                'Content-Type': 'application/json',
                'X-Api-Resource-Id': 'volc.service_type.10029',  # 资源ID
                'X-Api-App-Key': self.app_id,                    # 必填：APP ID
                'Authorization': f'Bearer;{self.access_token}',  # 使用Access Token（火山引擎格式：Bearer;token）
            }
            # 兼容可能的头字段变体
            headers['X-Api-AppKey'] = self.app_id
            
            # 调试日志：显示APP ID和Access Token认证状态
            print(f"[PROD_ADAPTER_DEBUG] APP ID configured: {bool(self.app_id)}, value: {self.app_id}")
            print(f"[PROD_ADAPTER_DEBUG] Access Token configured: {bool(self.access_token)}, value: {self.access_token[:8]}*** (length: {len(self.access_token)})")
            print(f"[PROD_ADAPTER_DEBUG] has_XApiAppKey={bool(headers.get('X-Api-App-Key'))}, has_XApiAppKeyAlias={bool(headers.get('X-Api-AppKey'))}")
            
            return headers
        
        elif self.use_signature_auth:
            # 使用AK/SK签名认证
            # 生成时间戳
            now = datetime.now(timezone.utc)
            timestamp = now.strftime('%Y%m%dT%H%M%SZ')
            
            # 解析URL获取host
            parsed_url = urlparse(url)
            host = parsed_url.netloc
            
            # 计算请求体的SHA256哈希
            content_sha256 = hashlib.sha256(body.encode('utf-8')).hexdigest()
            
            # 构建基础头部（AK/SK签名鉴权）
            headers = {
                'Content-Type': 'application/json',
                'X-Date': timestamp,
                'X-Api-Resource-Id': 'volc.service_type.10029',  # 资源ID
                'X-Content-Sha256': content_sha256,
                'Host': host
            }
            
            # 调试日志：显示AK/SK认证状态
            print(f"[PROD_ADAPTER_DEBUG] Access Key configured: {bool(self.access_key_id)}, value: {self.access_key_id[:8]}*** (length: {len(self.access_key_id)})")
            
            # 生成火山引擎标准签名
            authorization = self._generate_signature(method, url, headers, body)
            headers['Authorization'] = authorization
            
            # 移除Host头部（不需要在实际请求中发送）
            del headers['Host']
            
            return headers
        
        else:
            raise ValueError("No valid authentication method configured")