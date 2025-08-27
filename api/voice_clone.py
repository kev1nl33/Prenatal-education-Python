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

# 导入统一服务架构
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
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
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
            # 解析查询参数
            from urllib.parse import urlparse, parse_qs
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            action = query_params.get('action', ['info'])[0]
            speaker_id = query_params.get('speaker_id', [''])[0]
            
            request_id = str(uuid.uuid4())[:8]
            start_time = time.time()
            mode = get_current_mode()
            
            cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
            
            if action == 'status':
                # 查询声音复刻状态
                if not speaker_id:
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PARAMETER",
                        "message": "speaker_id parameter is required for status check",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                try:
                    speech_service = get_speech_service()
                    task_id = query_params.get('task_id', [''])[0]
                    status_result = speech_service.get_voice_clone_status(
                        speaker_id=speaker_id,
                        task_id=task_id if task_id else None
                    )
                    
                    latency = time.time() - start_time
                    
                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": True,
                        "errorCode": None,
                        "message": status_result.get("message", "Status retrieved successfully"),
                        "speakerId": speaker_id,
                        "status": status_result.get("status", "unknown"),
                        "progress": status_result.get("progress", 0),
                        "success": status_result.get("success", True),
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3)
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
                except Exception as status_error:
                    self.send_response(500)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": False,
                        "errorCode": "STATUS_ERROR",
                        "message": f"Failed to get voice clone status: {str(status_error)}",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
            elif action == 'list':
                # 列出可用的复刻声音
                try:
                    speech_service = get_speech_service()
                    voices_list = speech_service.list_cloned_voices()
                    
                    latency = time.time() - start_time
                    
                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": True,
                        "errorCode": None,
                        "message": "Voice list retrieved successfully",
                        "voices": voices_list,
                        "count": len(voices_list),
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3)
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
                except Exception as list_error:
                    self.send_response(500)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": False,
                        "errorCode": "LIST_ERROR",
                        "message": f"Failed to list cloned voices: {str(list_error)}",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
            else:
                # 默认信息页面
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "message": "Voice Clone API is running",
                    "methods": ["POST", "GET"],
                    "endpoints": {
                        "POST /": "Upload audio and create voice clone",
                        "GET /?action=status&speaker_id=xxx": "Check voice training status",
                        "GET /?action=list": "List available cloned voices"
                    },
                    "description": "Voice cloning service based on Volcengine Voice Clone API 2.0",
                    "requestId": request_id,
                    "mode": mode
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
                    "message": "Voice cloning service temporarily disabled by admin",
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
            action = data.get("action", "upload")  # upload, status, list
            speaker_id = data.get("speaker_id", "").strip()
            audio_data = data.get("audio_data", "")  # base64编码的音频数据
            audio_format = data.get("audio_format", "wav")  # 音频格式
            language = data.get("language", "zh")  # 语言
            model_type = data.get("model_type", 1)  # 1=ICL, 2=DiT标准版, 3=DiT还原版
            dry_run_param = data.get("dry_run", False)
            
            # 检查是否为干跑模式
            is_dry_run_mode = is_dry_run() or dry_run_param
            
            # 根据action处理不同请求
            if action == "upload":
                # 音频上传和声音复刻
                if not audio_data:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PARAMETER",
                        "message": "audio_data parameter is required for voice cloning",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                # 生成speaker_id如果未提供
                if not speaker_id:
                    speaker_id = f"speaker_{int(time.time() * 1000)}"
                
                try:
                    # 验证音频数据是否为有效的base64
                    audio_bytes = base64.b64decode(audio_data)
                    if len(audio_bytes) < 1000:  # 音频数据太小
                        raise ValueError("Audio data seems too small")
                except Exception as e:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_AUDIO_DATA",
                        "message": f"Invalid audio data format: {str(e)}",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                # 获取语音服务实例
                try:
                    speech_service = get_speech_service()
                    current_mode = get_current_mode()
                    
                    print(f"[VOICE_CLONE DEBUG] Current mode: {current_mode}")
                    print(f"[VOICE_CLONE DEBUG] Speaker ID: {speaker_id}")
                    print(f"[VOICE_CLONE DEBUG] Audio format: {audio_format}")
                    print(f"[VOICE_CLONE DEBUG] Language: {language}")
                    print(f"[VOICE_CLONE DEBUG] Model type: {model_type}")
                    print(f"[VOICE_CLONE DEBUG] Audio size: {len(audio_bytes)} bytes")
                    
                except ValueError as e:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(500)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    error_message = str(e)
                    if "TTS_APP_ID" in error_message or "TTS_ACCESS_TOKEN" in error_message:
                        error_message = "Voice cloning service configuration error: missing required API keys"
                    
                    response = {
                        "ok": False,
                        "errorCode": "SERVICE_CONFIG_ERROR",
                        "message": error_message,
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                # 费用估算
                try:
                    cost_estimated = 0.1  # 声音复刻基础费用
                except Exception as e:
                    print(f"Warning: Failed to estimate cost: {e}")
                    cost_estimated = 0.1
                
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
                        "message": f"Daily cost limit of {daily_limit} exceeded",
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
                        "speakerId": speaker_id,
                        "status": "training",
                        "cost": cost_estimated,
                        "fromCache": False,
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3),
                        "dryRun": True
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                # 实际进行声音复刻
                try:
                    result = speech_service.voice_clone(
                        speaker_id=speaker_id,
                        audio_data=audio_bytes,
                        audio_format=audio_format,
                        language=language,
                        model_type=model_type
                    )
                    
                    # 记录调用
                    latency = time.time() - start_time
                    cost_book.commit(cost=cost_estimated, latency=latency, from_cache=False)
                    
                    # 返回成功响应
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
                        "message": result.get("message", "Voice cloning initiated successfully"),
                        "speakerId": result.get("speaker_id", speaker_id),
                        "taskId": result.get("task_id"),
                        "status": result.get("status", "training"),
                        "success": result.get("success", True),
                        "cost": cost_estimated,
                        "fromCache": False,
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3),
                        "mode": current_mode
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
                except Exception as clone_error:
                    # 记录错误
                    latency = time.time() - start_time
                    cost_book.commit(cost=0.0, latency=latency, from_cache=False, error=True)
                    
                    # 错误分类
                    error_code = "VOICE_CLONE_ERROR"
                    error_message = str(clone_error)
                    status_code = 500
                    
                    if "401" in error_message or "Unauthorized" in error_message:
                        error_code = "AUTHENTICATION_ERROR"
                        error_message = "Invalid API credentials for voice cloning"
                        status_code = 401
                    elif "403" in error_message or "Forbidden" in error_message:
                        error_code = "PERMISSION_ERROR"
                        error_message = "Access denied for voice cloning service"
                        status_code = 403
                    elif "429" in error_message or "rate limit" in error_message.lower():
                        error_code = "RATE_LIMIT_ERROR"
                        error_message = "Rate limit exceeded for voice cloning"
                        status_code = 429
                    elif "timeout" in error_message.lower():
                        error_code = "TIMEOUT_ERROR"
                        error_message = "Voice cloning request timeout"
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
                    
            elif action == "status":
                # 查询声音复刻状态
                if not speaker_id:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PARAMETER",
                        "message": "speaker_id parameter is required for status check",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return
                
                try:
                    speech_service = get_speech_service()
                    
                    # 查询状态
                    task_id = data.get("task_id")  # 可选的任务ID
                    status_result = speech_service.get_voice_clone_status(
                        speaker_id=speaker_id,
                        task_id=task_id
                    )
                    
                    latency = time.time() - start_time
                    
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": True,
                        "errorCode": None,
                        "message": status_result.get("message", "Status retrieved successfully"),
                        "speakerId": speaker_id,
                        "status": status_result.get("status", "unknown"),
                        "progress": status_result.get("progress", 0),
                        "success": status_result.get("success", True),
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3)
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
                except Exception as status_error:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(500)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": False,
                        "errorCode": "STATUS_ERROR",
                        "message": f"Failed to get voice clone status: {str(status_error)}",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
            elif action == "list":
                # 列出可用的复刻声音
                try:
                    speech_service = get_speech_service()
                    
                    # 获取列表
                    voices_list = speech_service.list_cloned_voices()
                    
                    latency = time.time() - start_time
                    
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": True,
                        "errorCode": None,
                        "message": "Voice list retrieved successfully",
                        "voices": voices_list,
                        "count": len(voices_list),
                        "requestId": request_id,
                        "provider": speech_service.get_provider_name(),
                        "latency": round(latency, 3)
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
                except Exception as list_error:
                    cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                    self.send_response(500)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    
                    response = {
                        "ok": False,
                        "errorCode": "LIST_ERROR",
                        "message": f"Failed to list cloned voices: {str(list_error)}",
                        "requestId": request_id
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    
            else:
                # 不支持的action
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "INVALID_ACTION",
                    "message": f"Unsupported action: {action}. Supported actions: upload, status, list",
                    "requestId": request_id
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