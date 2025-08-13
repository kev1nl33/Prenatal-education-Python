import json
import os
import ssl
import urllib.request
from urllib.error import HTTPError
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs


def _build_ssl_ctx():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        try:
            return ssl._create_unverified_context()
        except Exception:
            return None


def _get_cors_headers():
    allowed_origin = os.environ.get('ALLOWED_ORIGIN')
    if not allowed_origin:
        raise ValueError('ALLOWED_ORIGIN environment variable is required')
    
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }


def _verify_auth(headers):
    auth_token = os.environ.get('AUTH_TOKEN')
    if not auth_token:
        raise ValueError('AUTH_TOKEN environment variable is required')
    
    request_token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    if request_token != auth_token:
        return False
    return True


class handler(BaseHTTPRequestHandler):
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
        try:
            cors_headers = _get_cors_headers()
            
            # 验证访问令牌
            if not _verify_auth(self.headers):
                self.send_response(401)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Unauthorized"}, ensure_ascii=False).encode('utf-8'))
                return
            
            # 获取环境变量中的API密钥
            ark_api_key = os.environ.get('ARK_API_KEY')
            if not ark_api_key:
                self.send_response(500)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "ARK_API_KEY not configured"}, ensure_ascii=False).encode('utf-8'))
                return
            
            # 解析请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            raw = raw_data.decode("utf-8") if raw_data else ""
            data = json.loads(raw) if raw else {}
            
            prompt = data.get("prompt", "")
            model = data.get("model") or os.environ.get('ARK_MODEL', 'kimi-k2-250711')
            
            if not prompt:
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "prompt is required"}, ensure_ascii=False).encode('utf-8'))
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
                        # 解析火山方舟API的响应并返回JSON格式
                        try:
                            ark_response = json.loads(response_data.decode("utf-8"))
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps(ark_response, ensure_ascii=False).encode('utf-8'))
                        except json.JSONDecodeError:
                            # 如果响应不是JSON格式，直接返回文本
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps({"content": response_data.decode("utf-8")}, ensure_ascii=False).encode('utf-8'))
                else:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        response_data = response.read()
                        self.send_response(200)
                        for key, value in cors_headers.items():
                            self.send_header(key, value)
                        self.end_headers()
                        self.wfile.write(response_data)
            except HTTPError as e:
                err_body = e.read()
                # 尝试解析错误响应为JSON，如果失败则包装为JSON格式
                try:
                    error_response = json.loads(err_body.decode("utf-8"))
                    self.send_response(e.code)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode('utf-8'))
                except json.JSONDecodeError:
                    self.send_response(e.code)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": err_body.decode("utf-8")}, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            try:
                cors_headers = _get_cors_headers()
            except:
                cors_headers = {"Content-Type": "application/json"}
            
            self.send_response(500)
            for key, value in cors_headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))