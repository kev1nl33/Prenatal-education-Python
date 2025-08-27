import json
import os
import ssl
import urllib.request
import base64
import uuid
import time
import hashlib
from urllib.error import HTTPError
from urllib.parse import parse_qs
from http.server import BaseHTTPRequestHandler

# 导入新的语音服务架构
import sys
from pathlib import Path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services import (
    get_speech_service, 
    get_current_mode, 
    is_dry_run, 
    is_kill_switch_enabled,
    get_daily_cost_limit
)
from services.costbook import get_cost_book
from services.cache import get_tts_cache


def _build_ssl_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            return ssl._create_unverified_context()
        except Exception:
            return None


def _get_cors_headers(request_id=None, from_cache=False, cost_estimated=0.0, mode=None):
    allowed_origin = os.environ.get('ALLOWED_ORIGIN', '*')
    
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Req-Id, X-Mode, X-Dry-Run, X-Api-Resource-Id",
    }
    
    # 添加自定义响应头
    if request_id:
        headers["X-Req-Id"] = request_id
    if from_cache is not None:
        headers["X-From-Cache"] = "true" if from_cache else "false"
    if cost_estimated is not None:
        headers["X-Cost-Estimated"] = str(cost_estimated)
    if mode:
        headers["X-Mode"] = mode
    
    return headers


# 鉴权逻辑已移至server.py中统一处理，此函数保留用于兼容性
def _verify_auth(headers):
    """验证访问令牌 - 已在server.py中处理"""
    return True  # 鉴权已在上层处理


def _check_origin(headers):
    """检查请求来源"""
    allowed_origins = os.environ.get('ALLOWED_ORIGIN', '*')
    if allowed_origins == '*':
        return True
    
    origin = headers.get('Origin', '')
    if not origin:
        return True  # 允许无Origin的请求（如Postman）
    
    allowed_list = [o.strip() for o in allowed_origins.split(',')]
    return origin in allowed_list


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            cors_headers = _get_cors_headers()
            self.send_response(200)
            for key, value in cors_headers.items():
                self.send_header(key, value)
            self.end_headers()
            response = {
                "message": "TTS API is running",
                "methods": ["POST"],
                "description": "Send POST request with 'text' parameter to generate speech"
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))
    
    def do_OPTIONS(self):
        try:
            cors_headers = _get_cors_headers()
            self.send_response(204)
            for key, value in cors_headers.items():
                self.send_header(key, value)
            self.end_headers()
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))
    
    def do_POST(self):
        # 生成请求ID
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # 初始化响应变量
        from_cache = False
        cost_estimated = 0.0
        mode = get_current_mode()
        
        try:
            # 中间件：检查紧急停止开关
            if is_kill_switch_enabled():
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(503)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "SERVICE_DISABLED",
                    "message": "Temporarily disabled by admin",
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 鉴权验证已在server.py中统一处理，此处无需重复验证
            
            # 中间件：检查请求来源
            if not _check_origin(self.headers):
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(403)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "FORBIDDEN_ORIGIN",
                    "message": "Request origin not allowed",
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 解析请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            raw = raw_data.decode("utf-8") if raw_data else ""
            data = json.loads(raw) if raw else {}
            
            # 提取参数 - 所有配置从环境变量读取，不再依赖前端传递
            text = data.get("text", "").strip()
            voice_type = data.get("voice_type") or os.environ.get('TTS_DEFAULT_VOICE', "zh_female_qingxin")
            emotion = data.get("emotion") or os.environ.get('TTS_DEFAULT_EMOTION', "neutral")  # happy 或 neutral
            quality = data.get("quality") or os.environ.get('TTS_DEFAULT_QUALITY', "draft")  # draft 或 high
            # 支持从请求头读取干跑标记（X-Dry-Run）以及从请求体读取 dry_run 字段
            dry_run_header_raw = self.headers.get('X-Dry-Run', '')
            dry_run_from_header = str(dry_run_header_raw).lower() in ("true", "1", "yes", "y")
            dry_run_param = bool(data.get("dry_run", False)) or dry_run_from_header
            # Resource ID 从环境变量读取
            resource_id = os.environ.get('TTS_RESOURCE_ID', 'volc.service_type.10029')
            
            # 生成 session_id（hash8）用于可观测性
            session_id = hashlib.sha256(f"{request_id}_{time.time()}".encode()).hexdigest()[:8]
            resource_id_hash = hashlib.sha256(resource_id.encode()).hexdigest()[:8] if resource_id else "none"
            
            # 增强可观测性日志
            print(f"[TTS INFO] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} text_length={len(text)} voice_type={voice_type} emotion={emotion} quality={quality}")
            print(f"[TTS DEBUG] Dry-run detected: {'yes' if dry_run_param else 'no'} (header={dry_run_header_raw})")
            
            # 检查是否为干跑模式
            is_dry_run_mode = is_dry_run() or dry_run_param
            
            # 参数验证
            if not text:
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "INVALID_PARAMETER",
                    "message": "Text parameter is required and cannot be empty",
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 获取语音服务实例
            try:
                speech_service = get_speech_service()
                
                # 检查模式并添加调试信息
                current_mode = get_current_mode()
                tts_api_key = os.environ.get('TTS_API_KEY', '')
                tts_resource_id = os.environ.get('TTS_RESOURCE_ID', '')
                print(f"[TTS DEBUG] TTS_API_KEY configured: {'yes' if tts_api_key and tts_api_key != 'your_tts_api_key_here' else 'no'}")
                if tts_resource_id:
                    print(f"[TTS DEBUG] TTS_RESOURCE_ID: {tts_resource_id}")
                vercel_env = os.environ.get('VERCEL_ENV', 'none')
                mode_env = os.environ.get('MODE', 'none')
                
                print(f"[TTS DEBUG] Current mode: {current_mode}")
                print(f"[TTS DEBUG] MODE env var: {mode_env}")
                print(f"[TTS DEBUG] VERCEL_ENV: {vercel_env}")
                print(f"[TTS DEBUG] TTS_API_KEY configured: {'yes' if tts_api_key and tts_api_key != 'your_tts_api_key_here' else 'no'}")
                print(f"[TTS DEBUG] Provider: {speech_service.get_provider_name()}")
                
                if current_mode in ['local', 'sandbox']:
                    print(f"WARNING: TTS service running in {current_mode} mode. Audio may be placeholder/silent.")
                    if current_mode == 'local':
                        print("INFO: Local mode generates placeholder audio files. Set MODE=prod for real TTS.")
                    elif current_mode == 'sandbox':
                        print("INFO: Sandbox mode generates test audio. Set MODE=prod for real TTS.")
                else:
                    print(f"INFO: TTS service running in production mode with {speech_service.get_provider_name()} provider.")
                        
            except ValueError as e:
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(500)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                # 提供更友好的错误信息
                error_message = str(e)
                if "TTS_API_KEY" in error_message:
                    error_message = "TTS服务配置错误：缺少必要的API密钥（TTS_API_KEY）。请检查环境变量配置或切换到本地模式。"
                elif "Unsupported mode" in error_message:
                    error_message = "不支持的运行模式。请检查MODE环境变量设置。"
                
                response = {
                    "ok": False,
                    "errorCode": "SERVICE_CONFIG_ERROR",
                    "message": error_message,
                    "requestId": request_id,
                    "suggestion": "建议：在本地开发环境中，请确保.env文件中设置了MODE=local"
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 费用估算
            try:
                cost_estimated = speech_service.estimate_cost(text)
            except Exception as e:
                print(f"Warning: Failed to estimate cost: {e}")
                cost_estimated = 0.0
            
            # 检查每日费用限制
            cost_book = get_cost_book()
            daily_limit = get_daily_cost_limit()
            
            if not is_dry_run_mode and cost_book.will_exceed_today(daily_limit):
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=cost_estimated, 
                    mode=mode
                )
                self.send_response(429)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "DAILY_LIMIT_EXCEEDED",
                    "message": f"Daily cost limit of {daily_limit} exceeded. Please try again tomorrow.",
                    "cost": cost_estimated,
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 如果是干跑模式，只返回估算信息
            if is_dry_run_mode:
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=cost_estimated, 
                    mode=mode
                )
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                latency = time.time() - start_time
                response = {
                    "ok": True,
                    "errorCode": None,
                    "message": "Dry run completed successfully",
                    "cost": cost_estimated,
                    "fromCache": False,
                    "requestId": request_id,
                    "provider": speech_service.get_provider_name(),
                    "latency": round(latency, 3),
                    "dryRun": True
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 检查缓存（包含 resource_id）
            cache = get_tts_cache()
            params = {"quality": quality, "emotion": emotion, "resource_id": resource_id}
            cached_audio = cache.get(text, voice_type, params)
            
            if cached_audio:
                from_cache = True
                audio_base64 = base64.b64encode(cached_audio).decode('utf-8')
                
                # 检测缓存音频格式
                audio_format = "wav"  # 默认为WAV
                if len(cached_audio) >= 12:
                    if cached_audio[0:4] == b'RIFF' and cached_audio[8:12] == b'WAVE':
                        audio_format = "wav"
                    elif (cached_audio[0] == 0xFF and (cached_audio[1] & 0xE0) == 0xE0) or cached_audio[0:3] == b'ID3':
                        audio_format = "mp3"
                    elif cached_audio[0:4] == b'OggS':
                        audio_format = "ogg"
                
                # 记录缓存命中
                latency = time.time() - start_time
                cost_book.commit(cost=0.0, latency=latency, from_cache=True)
                
                # 可观测性日志：缓存命中
                print(f"[TTS INFO] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} cache_hit=true latency={latency:.3f}s retry_count=0")
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    from_cache=True, 
                    cost_estimated=0.0, 
                    mode=mode
                )
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                response = {
                    "ok": True,
                    "errorCode": None,
                    "message": "Success",
                    "data": audio_base64,
                    "encoding": audio_format,  # 添加音频格式信息
                    "cost": 0.0,
                    "fromCache": True,
                    "requestId": request_id,
                    "sessionId": session_id,
                    "provider": speech_service.get_provider_name(),
                    "latency": round(latency, 3),
                    "mode": current_mode,
                    "warning": "Audio may be placeholder/silent" if current_mode in ['local', 'sandbox'] else None
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 调用语音合成服务
            try:
                print(f"[TTS DEBUG] Calling synthesize with: voice_type={voice_type}, emotion={emotion}, quality={quality}")
                audio_data = speech_service.synthesize(text, voice_type=voice_type, emotion=emotion, quality=quality, resource_id=resource_id)
                
                # 缓存结果（包含 resource_id）
                cache.set(text, audio_data, voice_type, params)
                
                # 记录调用
                latency = time.time() - start_time
                cost_book.commit(cost=cost_estimated, latency=latency, from_cache=False)
                
                # 可观测性日志：合成成功
                print(f"[TTS INFO] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} cache_hit=false latency={latency:.3f}s retry_count=0 cost={cost_estimated:.4f}")
                
                # 返回成功响应
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                
                # 检测音频格式
                audio_format = "wav"  # 默认为WAV，因为PCM已转换为WAV
                if len(audio_data) >= 12:
                    if audio_data[0:4] == b'RIFF' and audio_data[8:12] == b'WAVE':
                        audio_format = "wav"
                    elif (audio_data[0] == 0xFF and (audio_data[1] & 0xE0) == 0xE0) or audio_data[0:3] == b'ID3':
                        audio_format = "mp3"
                    elif audio_data[0:4] == b'OggS':
                        audio_format = "ogg"
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    from_cache=False, 
                    cost_estimated=cost_estimated, 
                    mode=mode
                )
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                response = {
                    "ok": True,
                    "errorCode": None,
                    "message": "Success",
                    "data": audio_base64,
                    "encoding": audio_format,  # 添加音频格式信息
                    "cost": cost_estimated,
                    "fromCache": False,
                    "requestId": request_id,
                    "sessionId": session_id,
                    "provider": speech_service.get_provider_name(),
                    "latency": round(latency, 3),
                    "mode": current_mode,
                    "warning": "Audio may be placeholder/silent" if current_mode in ['local', 'sandbox'] else None
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                
            except Exception as synthesis_error:
                # 记录错误
                latency = time.time() - start_time
                cost_book.commit(cost=0.0, latency=latency, from_cache=False, error=True)
                
                # 错误分类与映射
                error_code = "SYNTHESIS_ERROR"
                error_message = str(synthesis_error)
                status_code = 500
                
                # 检查是否需要降级处理
                fallback_enabled = os.environ.get('TTS_FALLBACK_ON_RESOURCE_ERROR', 'false').lower() == 'true'
                
                # 解析prod_adapter返回的HTTP状态码（格式：HTTP_XXX: message）
                if error_message.startswith("HTTP_"):
                    try:
                        # 提取状态码：HTTP_400: message -> 400
                        status_part = error_message.split(":")[0]  # HTTP_400
                        extracted_status = int(status_part.split("_")[1])  # 400
                        status_code = extracted_status
                        # 提取原始错误消息
                        original_message = error_message[len(status_part)+2:]  # 去掉 "HTTP_400: "
                        print(f"[TTS_PASSTHROUGH] Extracted status_code={status_code}, original_message={original_message[:100]}")
                        
                        # 根据状态码设置错误代码
                        if status_code == 400:
                            error_code = "BAD_REQUEST"
                        elif status_code == 401:
                            error_code = "AUTHENTICATION_ERROR"
                        elif status_code == 403:
                            error_code = "PERMISSION_ERROR"
                        elif status_code == 404:
                            error_code = "RESOURCE_NOT_FOUND"
                        elif status_code == 429:
                            error_code = "RATE_LIMIT_ERROR"
                        elif 500 <= status_code < 600:
                            error_code = "SERVER_ERROR"
                        else:
                            error_code = "UPSTREAM_ERROR"
                        
                        error_message = original_message
                    except (ValueError, IndexError) as parse_error:
                        print(f"[TTS_PASSTHROUGH] Failed to parse status code from: {error_message[:100]}, error: {parse_error}")
                        # 解析失败，使用默认逻辑
                        pass
                
                # 原有的错误分类逻辑（作为fallback）
                if "401" in error_message or "Unauthorized" in error_message:
                    error_code = "AUTHENTICATION_ERROR"
                    error_message = "Invalid API credentials. Please check your TTS configuration."
                    status_code = 401
                elif "403" in error_message or "Forbidden" in error_message:
                    # 更具体地提示 v1 权限问题（资源未授权）
                    if "requested resource not granted" in error_message.lower() or "resource not found" in error_message.lower():
                        error_code = "RESOURCE_NOT_FOUND"
                        error_message = "访问受限：请求的语音资源未被授权或不存在。请检查 X-Api-Resource-Id 头或 TTS_RESOURCE_ID 配置，或为该账户开通对应权限。"
                        status_code = 404
                        
                        # 如果启用了降级，尝试使用默认音色重试
                        if fallback_enabled and resource_id:
                            print(f"[TTS WARN] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} fallback=true reason=resource_not_found")
                            try:
                                # 移除 resource_id 重试
                                fallback_audio = speech_service.synthesize(text, voice_type=voice_type, emotion=emotion, quality=quality)
                                
                                # 缓存降级结果（不包含 resource_id）
                                fallback_params = {"quality": quality, "emotion": emotion, "resource_id": ""}
                                cache.set(text, fallback_audio, voice_type, fallback_params)
                                
                                # 记录降级成功
                                fallback_latency = time.time() - start_time
                                cost_book.commit(cost=cost_estimated, latency=fallback_latency, from_cache=False)
                                print(f"[TTS INFO] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} cache_hit=false latency={fallback_latency:.3f}s retry_count=1 fallback=success")
                                
                                # 返回降级成功响应
                                audio_base64 = base64.b64encode(fallback_audio).decode('utf-8')
                                audio_format = "wav"
                                if len(fallback_audio) >= 12:
                                    if fallback_audio[0:4] == b'RIFF' and fallback_audio[8:12] == b'WAVE':
                                        audio_format = "wav"
                                    elif (fallback_audio[0] == 0xFF and (fallback_audio[1] & 0xE0) == 0xE0) or fallback_audio[0:3] == b'ID3':
                                        audio_format = "mp3"
                                
                                cors_headers = _get_cors_headers(
                                    request_id=request_id, 
                                    from_cache=False, 
                                    cost_estimated=cost_estimated, 
                                    mode=mode
                                )
                                self.send_response(200)
                                for key, value in cors_headers.items():
                                    self.send_header(key, value)
                                self.end_headers()
                                
                                response = {
                                    "ok": True,
                                    "errorCode": None,
                                    "message": "Success (fallback to default voice)",
                                    "data": audio_base64,
                                    "encoding": audio_format,
                                    "cost": cost_estimated,
                                    "fromCache": False,
                                    "requestId": request_id,
                                    "sessionId": session_id,
                                    "provider": speech_service.get_provider_name(),
                                    "latency": round(fallback_latency, 3),
                                    "mode": current_mode,
                                    "fallback": True,
                                    "warning": "Fallback to default voice due to resource access issue"
                                }
                                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                                return
                            except Exception as fallback_error:
                                print(f"[TTS ERROR] request_id={request_id} session_id={session_id} fallback=failed error={str(fallback_error)}")
                                # 降级失败，继续原错误处理流程
                    else:
                        error_code = "PERMISSION_ERROR"
                        error_message = "Access denied. Please check your API permissions."
                        status_code = 403
                elif "429" in error_message or "rate limit" in error_message.lower():
                    error_code = "RATE_LIMIT_ERROR"
                    error_message = "Rate limit exceeded. Please try again later."
                    status_code = 429
                elif "timeout" in error_message.lower():
                    error_code = "TIMEOUT_ERROR"
                    error_message = "Request timeout. Please try again."
                    status_code = 408
                # v1 复刻音色未训练：code 3050 或包含提示语
                elif "speaker_id has not been trained" in error_message.lower() or "v1 x-api-key query error (3050)" in error_message.lower() or '"code":3050' in error_message:
                    error_code = "VOICE_CLONE_NOT_READY"
                    error_message = "复刻音色尚未训练完成，请先完成训练或等待训练完成后再试。"
                    status_code = 409
                elif "quota" in error_message.lower() or "insufficient" in error_message.lower():
                    error_code = "QUOTA_EXCEEDED"
                    error_message = "Quota exceeded or insufficient balance. Please check your account."
                    status_code = 402
                
                # 可观测性日志：错误记录
                print(f"[TTS ERROR] request_id={request_id} session_id={session_id} resource_id_hash={resource_id_hash} error_code={error_code} latency={latency:.3f}s retry_count=0 error_message={error_message[:100]}")
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=cost_estimated, 
                    mode=mode
                )
                self.send_response(status_code)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                response = {
                    "ok": False,
                    "errorCode": error_code,
                    "message": error_message,
                    "cost": cost_estimated,
                    "fromCache": False,
                    "requestId": request_id,
                    "sessionId": session_id,
                    "provider": speech_service.get_provider_name(),
                    "latency": round(latency, 3)
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                
        except Exception as e:
            # 全局错误处理
            latency = time.time() - start_time
            
            try:
                cost_book = get_cost_book()
                cost_book.commit(cost=0.0, latency=latency, from_cache=False, error=True)
            except:
                pass
            
            try:
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
            except:
                cors_headers = {"Content-Type": "application/json"}
            
            self.send_response(500)
            for key, value in cors_headers.items():
                self.send_header(key, value)
            self.end_headers()
            
            response = {
                "ok": False,
                "errorCode": "INTERNAL_ERROR",
                "message": f"Internal server error: {str(e)}",
                "cost": cost_estimated,
                "fromCache": from_cache,
                "requestId": request_id,
                "latency": round(latency, 3)
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))