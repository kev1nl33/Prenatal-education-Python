import json
import os
import ssl
import urllib.request
import base64
import uuid
import time
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
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Req-Id, X-Mode, X-Dry-Run",
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


def _verify_auth(headers):
    """验证访问令牌"""
    auth_token = os.environ.get('AUTH_TOKEN', '')
    if not auth_token:
        return True  # 如果未设置AUTH_TOKEN，则允许访问
    
    request_token = headers.get('X-Auth-Token', '')
    return request_token == auth_token


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
            
            # 中间件：验证访问令牌
            if not _verify_auth(self.headers):
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(401)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "UNAUTHORIZED",
                    "message": "Invalid or missing authentication token",
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
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
            
            # 提取参数
            text = data.get("text", "").strip()
            voice_type = data.get("voice_type", "zh_female_qingxin")
            quality = data.get("quality", "draft")  # draft 或 high
            dry_run_param = data.get("dry_run", False)
            
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
                # 环境检测和配置验证
                current_mode = get_current_mode()
                
                # 生产环境配置检查
                if current_mode == 'prod':
                    missing_vars = []
                    if not os.environ.get('TTS_APP_ID'):
                        missing_vars.append('TTS_APP_ID')
                    if not os.environ.get('TTS_ACCESS_TOKEN'):
                        missing_vars.append('TTS_ACCESS_TOKEN')
                    
                    if missing_vars:
                        raise ValueError(f"生产环境缺少必要的环境变量: {', '.join(missing_vars)}。请在Vercel项目设置中配置这些环境变量。")
                
                speech_service = get_speech_service()
                
                # 检查模式并添加警告
                if current_mode in ['local', 'sandbox']:
                    print(f"WARNING: TTS service running in {current_mode} mode. Audio may be placeholder/silent.")
                    if current_mode == 'local':
                        print("INFO: Local mode generates placeholder audio files. Set MODE=prod for real TTS.")
                    elif current_mode == 'sandbox':
                        print("INFO: Sandbox mode generates test audio. Set MODE=prod for real TTS.")
                elif current_mode == 'prod':
                    print("INFO: Production mode with real TTS service.")
                        
            except ValueError as e:
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(500)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                # 提供更友好的错误信息
                error_message = str(e)
                suggestion = ""
                
                if "TTS_APP_ID" in error_message or "TTS_ACCESS_TOKEN" in error_message:
                    if current_mode == 'prod':
                        error_message = "生产环境TTS配置错误：缺少必要的API密钥。请在Vercel项目设置中配置TTS_APP_ID和TTS_ACCESS_TOKEN环境变量。"
                        suggestion = "解决方案：1. 登录Vercel控制台 2. 进入项目设置 3. 在Environment Variables中添加TTS_APP_ID和TTS_ACCESS_TOKEN 4. 重新部署项目"
                    else:
                        error_message = "TTS服务配置错误：缺少必要的API密钥。请检查环境变量配置或切换到本地模式。"
                        suggestion = "建议：在本地开发环境中，请确保.env文件中设置了MODE=local"
                elif "Unsupported mode" in error_message:
                    error_message = "不支持的运行模式。请检查MODE环境变量设置。"
                    suggestion = "建议：设置MODE=local（本地开发）或MODE=prod（生产环境）"
                
                response = {
                    "ok": False,
                    "errorCode": "SERVICE_CONFIG_ERROR",
                    "message": error_message,
                    "requestId": request_id,
                    "suggestion": suggestion,
                    "mode": current_mode,
                    "environment": "production" if current_mode == 'prod' else "development"
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
            
            # 检查缓存
            cache = get_tts_cache()
            params = {"quality": quality}
            cached_audio = cache.get(text, voice_type, params)
            
            if cached_audio:
                from_cache = True
                audio_base64 = base64.b64encode(cached_audio).decode('utf-8')
                
                # 记录缓存命中
                latency = time.time() - start_time
                cost_book.commit(cost=0.0, latency=latency, from_cache=True)
                
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
                    "cost": 0.0,
                    "fromCache": True,
                    "requestId": request_id,
                    "provider": speech_service.get_provider_name(),
                    "latency": round(latency, 3),
                    "mode": current_mode,
                    "warning": "Audio may be placeholder/silent" if current_mode in ['local', 'sandbox'] else None
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 调用语音合成服务
            try:
                audio_data = speech_service.synthesize(text)
                
                # 缓存结果
                cache.set(text, audio_data, voice_type, params)
                
                # 记录调用
                latency = time.time() - start_time
                cost_book.commit(cost=cost_estimated, latency=latency, from_cache=False)
                
                # 返回成功响应
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
                
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
                    "cost": cost_estimated,
                    "fromCache": False,
                    "requestId": request_id,
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
                
                # 错误分类
                error_code = "SYNTHESIS_ERROR"
                error_message = str(synthesis_error)
                status_code = 500
                
                if "401" in error_message or "Unauthorized" in error_message:
                    error_code = "AUTHENTICATION_ERROR"
                    error_message = "Invalid API credentials. Please check your TTS configuration."
                    status_code = 401
                elif "403" in error_message or "Forbidden" in error_message:
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