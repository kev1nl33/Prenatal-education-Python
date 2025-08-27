#!/usr/bin/env python3
import os
import sys
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import importlib.util

# 加载环境变量
def load_env():
    env_path = '.env'
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key.strip()] = value.strip()

# 在启动时加载环境变量
load_env()

# 鉴权中间件
def verify_auth_token(handler):
    """验证请求的X-Auth-Token"""
    auth_token = handler.headers.get('X-Auth-Token')
    
    # 从环境变量获取允许的令牌列表
    allowed_tokens = os.environ.get('ALLOWED_TOKENS', '')
    if not allowed_tokens:
        print('[AUTH] No ALLOWED_TOKENS configured')
        return False
    
    # 解析逗号分隔的令牌列表
    token_list = [token.strip() for token in allowed_tokens.split(',') if token.strip()]
    
    if not auth_token:
        print('[AUTH] Missing X-Auth-Token header')
        return False
    
    if auth_token not in token_list:
        print(f'[AUTH] Invalid token: {auth_token[:10]}...')
        return False
    
    print('[AUTH] Token validation successful')
    return True

def send_auth_error(handler):
    """发送401鉴权错误响应"""
    try:
        handler.send_response(401)
        handler.send_header('Content-Type', 'application/json')
        handler.send_header('Access-Control-Allow-Origin', '*')
        handler.end_headers()
        error_response = {
            "error_code": "MISSING_OR_INVALID_TOKEN",
            "how_to_fix": "请联系管理员申请有效的访问令牌"
        }
        handler.wfile.write(json.dumps(error_response, ensure_ascii=False).encode('utf-8'))
    except (BrokenPipeError, ConnectionResetError):
        print("Client disconnected before auth error response could be sent")

class APIHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        # 对所有API请求进行鉴权验证
        if parsed_path.path.startswith('/api/'):
            if not verify_auth_token(self):
                send_auth_error(self)
                return
        
        if parsed_path.path == '/api/ark':
            print('[SERVER] Routing to /api/ark')
            # 直接调用 ark.py 中 handler 的 do_POST，传入当前 self，避免重复实例化 BaseHTTPRequestHandler
            try:
                spec = importlib.util.spec_from_file_location("ark", "api/ark.py")
                ark_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ark_module)
                # 调用未绑定方法，复用当前请求上下文
                ark_module.handler.do_POST(self)
                return
            except Exception as e:
                print(f"Error handling /api/ark: {e}")
                import traceback
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    error_response = {"error": f"Internal server error: {str(e)}"}
                    self.wfile.write(json.dumps(error_response).encode('utf-8'))
                except (BrokenPipeError, ConnectionResetError):
                    # 客户端已断开连接，忽略错误
                    print("Client disconnected before response could be sent")
                return
                
        elif parsed_path.path == '/api/tts':
            # 直接调用 tts.py 中 handler 的 do_POST，传入当前 self
            try:
                spec = importlib.util.spec_from_file_location("tts", "api/tts.py")
                tts_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(tts_module)
                tts_module.handler.do_POST(self)
                return
            except Exception as e:
                print(f"Error handling /api/tts: {e}")
                import traceback
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    error_response = {"error": f"Internal server error: {str(e)}"}
                    self.wfile.write(json.dumps(error_response).encode('utf-8'))
                except (BrokenPipeError, ConnectionResetError):
                    # 客户端已断开连接，忽略错误
                    print("Client disconnected before response could be sent")
                return
                
        elif parsed_path.path == '/api/voice_clone':
            # 直接调用 voice_clone.py 中 handler 的 do_POST，传入当前 self
            try:
                spec = importlib.util.spec_from_file_location("voice_clone", "api/voice_clone.py")
                voice_clone_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(voice_clone_module)
                voice_clone_module.handler.do_POST(self)
                return
            except Exception as e:
                print(f"Error handling /api/voice_clone: {e}")
                import traceback
                traceback.print_exc()
                try:
                    self.send_response(500)
                    self.send_header('Content-Type', 'application/json')
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    error_response = {"error": f"Internal server error: {str(e)}"}
                    self.wfile.write(json.dumps(error_response).encode('utf-8'))
                except (BrokenPipeError, ConnectionResetError):
                    # 客户端已断开连接，忽略错误
                    print("Client disconnected before response could be sent")
                return
        else:
            self.send_error(404, "API endpoint not found")
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path.startswith('/api/'):
            # 对所有API请求进行鉴权验证
            if not verify_auth_token(self):
                send_auth_error(self)
                return
            
            # 特殊处理voice_clone API的GET请求
            if parsed_path.path == '/api/voice_clone':
                try:
                    spec = importlib.util.spec_from_file_location("voice_clone", "api/voice_clone.py")
                    voice_clone_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(voice_clone_module)
                    voice_clone_module.handler.do_GET(self)
                    return
                except Exception as e:
                    print(f"Error handling GET /api/voice_clone: {e}")
                    import traceback
                    traceback.print_exc()
                    try:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.end_headers()
                        error_response = {"error": f"Internal server error: {str(e)}"}
                        self.wfile.write(json.dumps(error_response).encode('utf-8'))
                    except (BrokenPipeError, ConnectionResetError):
                        print("Client disconnected before response could be sent")
                    return
            else:
                print(f"[SERVER] GET {parsed_path.path} -> 405")
                # 其他API端点不支持GET请求
                self.send_response(405)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Allow', 'POST, OPTIONS')
                self.end_headers()
                error_response = {"error": "Method not allowed. Use POST for API requests."}
                self.wfile.write(json.dumps(error_response).encode('utf-8'))
                return
        else:
            # 处理静态文件请求
            # 如果访问根路径，重定向到 index.html
            if parsed_path.path == '/' or parsed_path.path == '':
                self.path = 'public/index.html'
            elif not parsed_path.path.startswith('/public/'):
                # 其他路径也重定向到 public 目录
                self.path = 'public' + parsed_path.path
            else:
                # 如果已经是/public/开头，去掉开头的斜杠
                self.path = parsed_path.path[1:]
            
            super().do_GET()
    
    def do_OPTIONS(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path.startswith('/api/'):
            # 处理CORS预检请求
            try:
                if parsed_path.path == '/api/ark':
                    spec = importlib.util.spec_from_file_location("ark", "api/ark.py")
                    ark_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(ark_module)
                    # 直接调用模块中的 do_OPTIONS，复用当前 self
                    ark_module.handler.do_OPTIONS(self)
                    return
                elif parsed_path.path == '/api/tts':
                    spec = importlib.util.spec_from_file_location("tts", "api/tts.py")
                    tts_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(tts_module)
                    tts_module.handler.do_OPTIONS(self)
                    return
                elif parsed_path.path == '/api/voice_clone':
                    spec = importlib.util.spec_from_file_location("voice_clone", "api/voice_clone.py")
                    voice_clone_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(voice_clone_module)
                    voice_clone_module.handler.do_OPTIONS(self)
                    return
            except Exception as e:
                print(f"Error handling OPTIONS: {e}")
                self.send_error(500, f"Internal server error: {e}")
                return
        else:
            # 对于非API请求，使用默认的OPTIONS处理
            super().do_OPTIONS()

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIHandler)
    print(f"Starting server on port {port}...")
    print(f"Server running at http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

# Export handler for Vercel Python Runtime
handler = APIHandler
if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number, using default 8000")
    
    run_server(port)