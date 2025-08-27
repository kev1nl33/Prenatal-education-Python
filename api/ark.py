import json
import os
import ssl
import urllib.request
import uuid
import time
from urllib.error import HTTPError
from urllib.parse import parse_qs
from http.server import BaseHTTPRequestHandler

# 导入统一语音服务架构
from services import (
    get_speech_service, get_current_mode, is_dry_run, 
    is_kill_switch_enabled, get_daily_cost_limit
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


def _get_cors_headers(request_id=None, from_cache=None, cost_estimated=None, mode=None):
    allowed_origin = os.environ.get('ALLOWED_ORIGIN', '*')
    
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token, X-Mode, X-Dry-Run, X-Max-Daily-Cost, X-Api-Resource-Id",
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
    if not auth_token or auth_token in ['your_auth_token_here']:
        return True  # 如果未配置认证令牌，则允许访问
    
    request_token = headers.get('X-Auth-Token', '')
    return request_token == auth_token


def _check_origin(headers):
    """检查请求来源"""
    allowed_origins = os.environ.get('ALLOWED_ORIGIN', '*')
    if allowed_origins == '*':
        return True
    
    origin = headers.get('Origin', '')
    if not origin:
        return True  # 允许没有 Origin 头的请求（如直接 API 调用）
    
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
                "message": "ARK API is running",
                "methods": ["POST"],
                "description": "Send POST request with 'prompt' parameter to generate content"
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
            prompt = data.get("prompt", "").strip()
            model = data.get("model") or os.environ.get('ARK_MODEL', 'doubao-seed-1-6-flash-250715')
            dry_run_param = data.get("dry_run", False)
            
            # 检查是否为干跑模式
            is_dry_run_mode = is_dry_run() or dry_run_param
            
            # 参数验证
            if not prompt:
                cors_headers = _get_cors_headers(request_id=request_id, mode=mode)
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "INVALID_PARAMETER",
                    "message": "Prompt parameter is required and cannot be empty",
                    "requestId": request_id
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 获取环境变量中的API密钥
            ark_api_key = os.environ.get('ARK_API_KEY')
            
            # 如果是干跑模式或测试模式，返回模拟响应
            if is_dry_run_mode or not ark_api_key or ark_api_key in ['your_ark_api_key_here', 'sk-your-real-api-key-here']:
                latency = time.time() - start_time
                
                mock_response = {
                    "ok": True,
                    "errorCode": None,
                    "message": "Success" if not is_dry_run_mode else "Dry run completed successfully",
                    "choices": [{
                        "message": {
                            "content": "这是一个测试胎教故事。从前有一只小兔子，它喜欢在月光下跳舞..."
                        }
                    }],
                    "cost": 0.0,
                    "fromCache": False,
                    "requestId": request_id,
                    "provider": "mock",
                    "latency": round(latency, 3)
                }
                
                if is_dry_run_mode:
                    mock_response["dryRun"] = True
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=0.0, 
                    mode=mode
                )
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps(mock_response, ensure_ascii=False).encode('utf-8'))
                return
            
            # 构建火山方舟请求
            ark_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是一个专业的胎教内容创作助手，擅长生成温馨、积极、有益的胎教内容。"},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 2000,
                "temperature": 0.7
            }
            
            req_data = json.dumps(ark_payload).encode("utf-8")
            req = urllib.request.Request(
                "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {ark_api_key}"
                }
            )
            
            # 发送请求
            ctx = _build_ssl_ctx()
            try:
                if ctx is not None:
                    with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                        response_data = response.read()
                        latency = time.time() - start_time
                        
                        # 解析火山方舟API的响应并返回JSON格式
                        try:
                            ark_response = json.loads(response_data.decode("utf-8"))
                            
                            # 包装成统一响应格式
                            if 'choices' in ark_response and len(ark_response['choices']) > 0:
                                wrapped_response = {
                                    "ok": True,
                                    "errorCode": None,
                                    "message": "Success",
                                    "choices": ark_response['choices'],
                                    "cost": 0.0,  # ARK API 暂时不计费
                                    "fromCache": False,
                                    "requestId": request_id,
                                    "provider": "volcengine_ark",
                                    "latency": round(latency, 3)
                                }
                            else:
                                # 如果响应格式不符合预期，包装成标准格式
                                wrapped_response = {
                                    "ok": True,
                                    "errorCode": None,
                                    "message": "Success",
                                    "choices": [{
                                        "message": {
                                            "content": str(ark_response)
                                        }
                                    }],
                                    "cost": 0.0,
                                    "fromCache": False,
                                    "requestId": request_id,
                                    "provider": "volcengine_ark",
                                    "latency": round(latency, 3)
                                }
                            
                            cors_headers = _get_cors_headers(
                                request_id=request_id, 
                                cost_estimated=0.0, 
                                mode=mode
                            )
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps(wrapped_response, ensure_ascii=False).encode('utf-8'))
                            
                        except json.JSONDecodeError:
                            # 如果响应不是JSON格式，包装成标准格式
                            wrapped_response = {
                                "ok": True,
                                "errorCode": None,
                                "message": "Success",
                                "choices": [{
                                    "message": {
                                        "content": response_data.decode("utf-8")
                                    }
                                }],
                                "cost": 0.0,
                                "fromCache": False,
                                "requestId": request_id,
                                "provider": "volcengine_ark",
                                "latency": round(latency, 3)
                            }
                            
                            cors_headers = _get_cors_headers(
                                request_id=request_id, 
                                cost_estimated=0.0, 
                                mode=mode
                            )
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps(wrapped_response, ensure_ascii=False).encode('utf-8'))
                else:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        response_data = response.read()
                        latency = time.time() - start_time
                        
                        # 简化处理，直接返回原始响应
                        self.send_response(200)
                        cors_headers = _get_cors_headers(
                            request_id=request_id, 
                            cost_estimated=0.0, 
                            mode=mode
                        )
                        for key, value in cors_headers.items():
                            self.send_header(key, value)
                        self.end_headers()
                        self.wfile.write(response_data)
                        
            except HTTPError as e:
                latency = time.time() - start_time
                err_body = e.read()
                
                # 错误分类
                error_code = "ARK_API_ERROR"
                error_message = "ARK API request failed"
                status_code = e.code
                
                if e.code == 401:
                    error_code = "AUTHENTICATION_ERROR"
                    error_message = "Invalid API credentials. Please check your ARK API key."
                elif e.code == 403:
                    error_code = "PERMISSION_ERROR"
                    error_message = "Access denied. Please check your API permissions."
                elif e.code == 429:
                    error_code = "RATE_LIMIT_ERROR"
                    error_message = "Rate limit exceeded. Please try again later."
                elif e.code >= 500:
                    error_code = "SERVER_ERROR"
                    error_message = "ARK API server error. Please try again later."
                
                # 尝试解析错误响应
                try:
                    error_detail = json.loads(err_body.decode("utf-8"))
                    if isinstance(error_detail, dict) and 'error' in error_detail:
                        error_message = error_detail['error'].get('message', error_message)
                except:
                    pass
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=0.0, 
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
                    "cost": 0.0,
                    "fromCache": False,
                    "requestId": request_id,
                    "provider": "volcengine_ark",
                    "latency": round(latency, 3)
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            try:
                latency = time.time() - start_time
                
                # 错误分类
                error_code = "INTERNAL_ERROR"
                error_message = "Internal server error"
                
                if "timeout" in str(e).lower():
                    error_code = "TIMEOUT_ERROR"
                    error_message = "Request timeout. Please try again."
                elif "connection" in str(e).lower():
                    error_code = "CONNECTION_ERROR"
                    error_message = "Connection error. Please check your network."
                
                cors_headers = _get_cors_headers(
                    request_id=request_id, 
                    cost_estimated=0.0, 
                    mode=mode
                )
                self.send_response(500)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                
                response = {
                    "ok": False,
                    "errorCode": error_code,
                    "message": error_message,
                    "cost": 0.0,
                    "fromCache": False,
                    "requestId": request_id,
                    "provider": "volcengine_ark",
                    "latency": round(latency, 3)
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            except:
                pass
