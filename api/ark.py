import json
import os
import ssl
import urllib.request
from urllib.error import HTTPError
from urllib.parse import parse_qs
from http.server import BaseHTTPRequestHandler


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
    # 移除AUTH_TOKEN验证，允许直接访问
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
            
            # 解析请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            raw = raw_data.decode("utf-8") if raw_data else ""
            data = json.loads(raw) if raw else {}
            
            # 获取环境变量中的API密钥
            ark_api_key = os.environ.get('ARK_API_KEY')
            if not ark_api_key or ark_api_key in ['your_ark_api_key_here', 'sk-your-real-api-key-here']:
                # 测试模式：返回快速模拟响应
                prompt = data.get("prompt", "")
                story_content = f"亲爱的宝宝，这是为你准备的胎教故事：{prompt[:50]}...在一个温暖的春天，小动物们在森林里快乐地生活着。它们互相帮助，分享快乐，就像妈妈对你的爱一样温暖。"
                
                mock_response = {
                    "choices": [{
                        "message": {
                            "content": story_content
                        }
                    }]
                }
                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps(mock_response, ensure_ascii=False).encode('utf-8'))
                return
            
            prompt = data.get("prompt", "")
            model = data.get("model") or os.environ.get('ARK_MODEL', 'kimi-k2-250711')
            
            if not prompt:
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "prompt is required"}, ensure_ascii=False).encode('utf-8'))
                return
            
            # 构建火山方舟请求 - 优化参数以减少响应时间
            ark_payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "你是胎教助手，请简洁回应。"},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 500,  # 减少token数量以加快响应
                "temperature": 0.3   # 降低随机性以加快生成
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
            
            # 发送请求 - 严格限制超时时间以适应 Vercel 限制
            ctx = _build_ssl_ctx()
            try:
                timeout = 5  # 减少到5秒以确保在Vercel限制内完成
                if ctx is not None:
                    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
                        response_data = response.read()
                        try:
                            ark_response = json.loads(response_data.decode("utf-8"))
                            # 简化响应处理 - 直接返回或包装
                            if 'choices' in ark_response:
                                final_response = ark_response
                            else:
                                final_response = {
                                    "choices": [{
                                        "message": {
                                            "content": str(ark_response)
                                        }
                                    }]
                                }
                        except json.JSONDecodeError:
                            # 如果响应不是JSON，包装为标准格式
                            final_response = {
                                "choices": [{
                                    "message": {
                                        "content": response_data.decode("utf-8")
                                    }
                                }]
                            }
                        
                        self.send_response(200)
                        for key, value in cors_headers.items():
                            self.send_header(key, value)
                        self.end_headers()
                        self.wfile.write(json.dumps(final_response, ensure_ascii=False).encode('utf-8'))
                else:
                    with urllib.request.urlopen(req, timeout=timeout) as response:
                        response_data = response.read()
                        try:
                            ark_response = json.loads(response_data.decode("utf-8"))
                            # 简化响应处理
                            if 'choices' in ark_response:
                                final_response = ark_response
                            else:
                                final_response = {
                                    "choices": [{
                                        "message": {
                                            "content": str(ark_response)
                                        }
                                    }]
                                }
                        except json.JSONDecodeError:
                            # 如果响应不是JSON，包装为标准格式
                            final_response = {
                                "choices": [{
                                    "message": {
                                        "content": response_data.decode("utf-8")
                                    }
                                }]
                            }
                        
                        self.send_response(200)
                        for key, value in cors_headers.items():
                            self.send_header(key, value)
                        self.end_headers()
                        self.wfile.write(json.dumps(final_response, ensure_ascii=False).encode('utf-8'))
            except (HTTPError, Exception) as e:
                # 简化错误处理 - 快速返回错误响应
                error_msg = str(e)
                if hasattr(e, 'code'):
                    status_code = e.code
                else:
                    status_code = 500
                    
                self.send_response(status_code)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                self.wfile.write(json.dumps({"error": error_msg}, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            # 最终异常处理 - 确保总是返回响应
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))