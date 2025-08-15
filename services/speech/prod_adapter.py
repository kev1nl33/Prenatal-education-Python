import os
import json
import time
import random
import urllib.request
import urllib.error
import ssl
import base64
from typing import Dict, Any
from .base import SpeechSynthesizer


class ProductionSpeechAdapter(SpeechSynthesizer):
    """生产环境语音合成适配器（火山引擎TTS）"""
    
    def __init__(self):
        # 从环境变量读取配置
        self.app_id = os.environ.get('TTS_APP_ID', '')
        self.access_token = os.environ.get('TTS_ACCESS_TOKEN', '')
        self.api_url = os.environ.get('TTS_API_URL', 'https://openspeech.bytedance.com/api/v1/tts')
        
        # 价格配置
        self.price_per_1k_char = float(os.environ.get('TTS_PRICE_PER_1K_CHAR', '0.02'))
        self.high_quality_multiplier = float(os.environ.get('TTS_HIGH_QUALITY_MULTIPLIER', '2.0'))
        
        # 重试配置
        self.max_retries = int(os.environ.get('TTS_MAX_RETRIES', '2'))
        self.timeout = int(os.environ.get('TTS_TIMEOUT', '60'))  # 增加到60秒
        
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
    
    def _get_voice_config(self, voice_type: str, quality: str) -> Dict[str, Any]:
        """获取音色配置"""
        # 音色映射 - 使用官方文档中的正确格式
        voice_mapping = {
            "default": "zh_female_xinlingjitang_moon_bigtts",
            "female": "zh_female_xinlingjitang_moon_bigtts",
            "male": "zh_male_jingqiangdaxiaosheng_moon_bigtts",
            "child": "zh_female_qingxin",
            "elderly": "zh_male_chunhou"
        }
        
        # 质量配置
        quality_config = {
            "draft": {
                "encoding": "mp3",
                "speed_ratio": 1.0,
                "volume_ratio": 1.0,
                "pitch_ratio": 1.0
            },
            "high": {
                "encoding": "wav",
                "speed_ratio": 1.0,
                "volume_ratio": 1.0,
                "pitch_ratio": 1.0
            }
        }
        
        config = quality_config.get(quality, quality_config["draft"]).copy()
        config["voice_type"] = voice_mapping.get(voice_type, voice_mapping["default"])
        
        return config
    
    def _make_request_with_retry(self, payload: Dict[str, Any]) -> bytes:
        """带重试的请求"""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                # 构建请求
                req_data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(
                    self.api_url,
                    data=req_data,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer;{self.access_token}"
                    }
                )
                
                # Debug: 请求信息
                print(f"[PROD_ADAPTER DEBUG] API URL: {self.api_url}")
                print(f"[PROD_ADAPTER DEBUG] Request payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")
                print(f"[PROD_ADAPTER DEBUG] Request headers: {dict(req.headers)}")
                print(f"[PROD_ADAPTER DEBUG] App ID: {self.app_id}")
                print(f"[PROD_ADAPTER DEBUG] Access token (first 10 chars): {self.access_token[:10]}...")
                
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
                            if json_response["code"] != 0:
                                error_msg = json_response.get("message", "Unknown error")
                                print(f"[PROD_ADAPTER DEBUG] API returned error code {json_response['code']}: {error_msg}")
                                raise Exception(f"Volcengine API error ({json_response['code']}): {error_msg}")
                        
                        # 查找音频数据 - 支持多种可能的响应格式
                        audio_base64 = None
                        
                        # 格式1: data字段直接包含base64字符串
                        if "data" in json_response and isinstance(json_response["data"], str):
                            audio_base64 = json_response["data"]
                            print(f"[PROD_ADAPTER DEBUG] Found audio in data field (string)")
                        
                        # 格式2: data.audio字段
                        elif "data" in json_response and isinstance(json_response["data"], dict):
                            if "audio" in json_response["data"]:
                                audio_base64 = json_response["data"]["audio"]
                                print(f"[PROD_ADAPTER DEBUG] Found audio in data.audio field")
                            elif json_response["data"]:
                                # data字典中的第一个值可能是音频
                                first_value = next(iter(json_response["data"].values()), None)
                                if isinstance(first_value, str) and len(first_value) > 100:  # 假设音频base64至少100字符
                                    audio_base64 = first_value
                                    print(f"[PROD_ADAPTER DEBUG] Found audio as first value in data dict")
                        
                        # 格式3: 直接在audio字段
                        elif "audio" in json_response:
                            audio_base64 = json_response["audio"]
                            print(f"[PROD_ADAPTER DEBUG] Found audio in audio field")
                        
                        # 格式4: result字段（某些API版本）
                        elif "result" in json_response:
                            result = json_response["result"]
                            if isinstance(result, str):
                                audio_base64 = result
                                print(f"[PROD_ADAPTER DEBUG] Found audio in result field")
                            elif isinstance(result, dict) and "audio" in result:
                                audio_base64 = result["audio"]
                                print(f"[PROD_ADAPTER DEBUG] Found audio in result.audio field")
                        
                        # 如果找到了音频数据，解码并返回
                        if audio_base64:
                            try:
                                audio_data = base64.b64decode(audio_base64)
                                print(f"[PROD_ADAPTER DEBUG] Successfully decoded audio data size: {len(audio_data)} bytes")
                                
                                # 简单验证：音频数据应该至少有一定大小
                                if len(audio_data) < 100:
                                    print(f"[PROD_ADAPTER DEBUG] Warning: Audio data seems too small ({len(audio_data)} bytes)")
                                
                                return audio_data
                            except Exception as decode_error:
                                print(f"[PROD_ADAPTER DEBUG] Failed to decode base64 audio: {decode_error}")
                                raise Exception(f"Failed to decode audio data: {decode_error}")
                        else:
                            print(f"[PROD_ADAPTER DEBUG] No audio data found in any expected field")
                            print(f"[PROD_ADAPTER DEBUG] Available fields: {list(json_response.keys())}")
                            raise Exception("No audio data found in API response")
                            
                    except json.JSONDecodeError as json_error:
                        print(f"[PROD_ADAPTER DEBUG] JSON decode error: {json_error}")
                        print(f"[PROD_ADAPTER DEBUG] Raw response (first 500 chars): {response_data[:500]}")
                        
                        # 如果不是JSON，可能是直接的音频数据（不太可能但要处理）
                        if len(response_data) > 100:  # 假设音频至少100字节
                            print(f"[PROD_ADAPTER DEBUG] Treating as raw audio data")
                            return response_data
                        else:
                            raise Exception(f"Invalid JSON response: {json_error}")
                        
            except urllib.error.HTTPError as e:
                last_exception = e
                error_body = e.read().decode('utf-8') if e.fp else str(e)
                
                # 根据错误码决定是否重试
                if e.code in [429, 500, 502, 503, 504] and attempt < self.max_retries:
                    # 指数退避 + 抖动
                    delay = (2 ** attempt) + random.uniform(0, 1)
                    time.sleep(delay)
                    continue
                else:
                    # 不重试的错误或已达最大重试次数
                    if e.code == 401:
                        raise Exception("Authentication failed: Invalid access token")
                    elif e.code == 403:
                        raise Exception("Access forbidden: Check your permissions")
                    elif e.code == 429:
                        raise Exception("Rate limit exceeded: Please try again later")
                    elif e.code in [400, 422]:
                        raise Exception(f"Invalid request: {error_body}")
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
    
    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> bytes:
        """合成语音"""
        if not self.validate_text(text):
            raise ValueError("Invalid text input")
        
        # 获取音色配置
        voice_config = self._get_voice_config(voice_type, quality)
        
        # 构建请求负载 - 按照官方文档格式
        payload = {
            "app": {
                "appid": self.app_id,
                "token": self.access_token,
                "cluster": "volcano_tts"
            },
            "user": {
                "uid": "prenatal_education_user"
            },
            "audio": {
                "voice_type": voice_config["voice_type"],
                "encoding": voice_config["encoding"],
                "speed_ratio": voice_config["speed_ratio"],
                "volume_ratio": voice_config["volume_ratio"],
                "pitch_ratio": voice_config["pitch_ratio"]
            },
            "request": {
                "reqid": f"prenatal_{int(time.time() * 1000)}",
                "text": text,
                "text_type": "plain",
                "operation": "submit",
                "enable_subtitle": False
            }
        }
        
        return self._make_request_with_retry(payload)
    
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