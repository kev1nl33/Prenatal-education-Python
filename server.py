#!/usr/bin/env python3
import os
import sys
import json
from http.server import HTTPServer, SimpleHTTPRequestHandler
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

class APIHandler(SimpleHTTPRequestHandler):
    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/ark':
            # 导入并使用ark.py中的handler
            try:
                spec = importlib.util.spec_from_file_location("ark", "api/ark.py")
                ark_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(ark_module)
                
                # 直接调用handler类的do_POST方法
                handler_instance = ark_module.handler(self.request, self.client_address, self.server)
                # 复制当前请求的所有属性
                handler_instance.rfile = self.rfile
                handler_instance.wfile = self.wfile
                handler_instance.headers = self.headers
                handler_instance.path = self.path
                handler_instance.command = self.command
                handler_instance.request_version = self.request_version
                handler_instance.requestline = getattr(self, 'requestline', f'{self.command} {self.path} {self.request_version}')
                handler_instance.client_address = self.client_address
                handler_instance.server = self.server
                handler_instance.do_POST()
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
            # 导入并使用tts.py中的handler
            try:
                spec = importlib.util.spec_from_file_location("tts", "api/tts.py")
                tts_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(tts_module)
                
                # 直接调用handler类的do_POST方法
                handler_instance = tts_module.handler(self.request, self.client_address, self.server)
                # 复制当前请求的所有属性
                handler_instance.rfile = self.rfile
                handler_instance.wfile = self.wfile
                handler_instance.headers = self.headers
                handler_instance.path = self.path
                handler_instance.command = self.command
                handler_instance.request_version = self.request_version
                handler_instance.requestline = getattr(self, 'requestline', f'{self.command} {self.path} {self.request_version}')
                handler_instance.client_address = self.client_address
                handler_instance.server = self.server
                handler_instance.do_POST()
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
        else:
            self.send_error(404, "API endpoint not found")
    
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path.startswith('/api/'):
            # API端点不支持GET请求
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
                    
                    handler_instance = ark_module.handler(self.request, self.client_address, self.server)
                    handler_instance.rfile = self.rfile
                    handler_instance.wfile = self.wfile
                    handler_instance.headers = self.headers
                    handler_instance.path = self.path
                    handler_instance.command = self.command
                    handler_instance.request_version = self.request_version
                    handler_instance.requestline = getattr(self, 'requestline', f'{self.command} {self.path} {self.request_version}')
                    handler_instance.client_address = self.client_address
                    handler_instance.server = self.server
                    handler_instance.do_OPTIONS()
                    return
                elif parsed_path.path == '/api/tts':
                    spec = importlib.util.spec_from_file_location("tts", "api/tts.py")
                    tts_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(tts_module)
                    
                    handler_instance = tts_module.handler(self.request, self.client_address, self.server)
                    handler_instance.rfile = self.rfile
                    handler_instance.wfile = self.wfile
                    handler_instance.headers = self.headers
                    handler_instance.path = self.path
                    handler_instance.command = self.command
                    handler_instance.request_version = self.request_version
                    handler_instance.requestline = getattr(self, 'requestline', f'{self.command} {self.path} {self.request_version}')
                    handler_instance.client_address = self.client_address
                    handler_instance.server = self.server
                    handler_instance.do_OPTIONS()
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

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("Invalid port number, using default 8000")
    
    run_server(port)