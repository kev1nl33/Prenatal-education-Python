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
    allowed_origin = os.environ.get('ALLOWED_ORIGIN', '*')
    
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }


def _verify_auth(headers):
    # 优先从环境变量读取AUTH_TOKEN，如果没有则从请求头读取
    auth_token = os.environ.get('AUTH_TOKEN')
    request_token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
    
    if not auth_token and not request_token:
        raise ValueError('AUTH_TOKEN environment variable is required')
    
    # 如果环境变量中有AUTH_TOKEN，则验证请求头中的token
    if auth_token:
        if request_token != auth_token:
            return False
    # 如果环境变量中没有AUTH_TOKEN，则直接使用请求头中的token（允许前端配置）
    elif not request_token:
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
            
            # 获取环境变量中的TTS访问令牌
            tts_access_token = os.environ.get('TTS_ACCESS_TOKEN')
            if not tts_access_token:
                self.send_response(500)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "TTS_ACCESS_TOKEN not configured"}, ensure_ascii=False).encode('utf-8'))
                return
            
            # 解析请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            raw = raw_data.decode("utf-8") if raw_data else ""
            data = json.loads(raw) if raw else {}
            
            text = data.get("text", "")
            if not text:
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "text is required"}, ensure_ascii=False).encode('utf-8'))
                return
            
            # 构建TTS请求payload，使用传入的参数
            tts_payload = {
                "app": {
                    "appid": data.get("appid", os.environ.get('TTS_APP_ID', '')),
                    "token": tts_access_token,
                    "cluster": data.get("cluster", "volcano_tts")
                },
                "user": {
                    "uid": data.get("uid", "test_user_001")
                },
                "audio": {
                    "voice_type": data.get("voice_type", "zh_female_xinlingjitang_moon_bigtts"),
                    "encoding": data.get("encoding", "mp3"),
                    "speed_ratio": data.get("speed_ratio", 1.0),
                    "volume_ratio": data.get("volume_ratio", 1.0),
                    "pitch_ratio": data.get("pitch_ratio", 1.0)
                },
                "request": {
                    "reqid": data.get("reqid", str(int(__import__('time').time() * 1000))),
                    "text": text,
                    "text_type": data.get("text_type", "plain"),
                    "operation": data.get("operation", "query"),
                    "with_frontend": data.get("with_frontend", 1),
                    "frontend_type": data.get("frontend_type", "unitTson")
                }
            }
            
            req_data = json.dumps(tts_payload).encode("utf-8")
            req = urllib.request.Request(
                "https://openspeech.bytedance.com/api/v1/tts",
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer;{tts_access_token}"
                }
            )
            
            # 发送请求
            ctx = _build_ssl_ctx()
            try:
                if ctx is not None:
                    with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                        response_data = response.read()
                        # 解析TTS API的响应并返回JSON格式
                        try:
                            tts_response = json.loads(response_data.decode("utf-8"))
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps(tts_response, ensure_ascii=False).encode('utf-8'))
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
                        # 解析TTS API的响应并返回JSON格式
                        try:
                            tts_response = json.loads(response_data.decode("utf-8"))
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps(tts_response, ensure_ascii=False).encode('utf-8'))
                        except json.JSONDecodeError:
                            # 如果响应不是JSON格式，直接返回文本
                            self.send_response(200)
                            for key, value in cors_headers.items():
                                self.send_header(key, value)
                            self.end_headers()
                            self.wfile.write(json.dumps({"content": response_data.decode("utf-8")}, ensure_ascii=False).encode('utf-8'))
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