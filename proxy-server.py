#!/usr/bin/env python3
"""
轻量级代理服务器，用于解决前端访问火山引擎API的CORS跨域问题
运行方式：python3 proxy-server.py
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.parse
from urllib.error import HTTPError
import sys
import threading
import time

class CORSProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        """处理预检请求"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def do_POST(self):
        """处理POST请求，转发到相应的API"""
        if self.path == '/api/ark/chat':
            self.proxy_ark_api()
        elif self.path == '/api/tts':
            self.proxy_tts_api()
        else:
            self.serve_static_files()

    def do_GET(self):
        """处理GET请求，提供静态文件服务"""
        self.serve_static_files()

    def serve_static_files(self):
        """提供静态文件服务"""
        super().do_GET()

    def send_cors_headers(self):
        """发送CORS头"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def proxy_ark_api(self):
        """代理火山方舟文本生成API"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            req = urllib.request.Request(
                'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                data=json.dumps(request_data['body']).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': request_data['headers']['Authorization']
                }
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as response:
                    response_data = response.read()
                    self.send_response(200)
                    self.send_cors_headers()
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(response_data)
            except HTTPError as e:
                err_body = e.read()
                self.log_message('Ark upstream error %s', e.code)
                self.send_response(e.code)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body)
        except Exception as e:
            self.send_error_response(f"Ark API错误: {str(e)}", status=500)

    def proxy_tts_api(self):
        """代理火山引擎TTS API"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            # Log request for debugging
            self.log_message('TTS Request data: %s', json.dumps(request_data, ensure_ascii=False))
            
            req = urllib.request.Request(
                'https://openspeech.bytedance.com/api/v1/tts',
                data=json.dumps(request_data['body']).encode('utf-8'),
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': request_data['headers']['Authorization']
                }
            )
            
            # Prepare SSL context (prefer system CA via certifi; fallback to unverified for local debug)
            try:
                import ssl
                try:
                    import certifi
                    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
                except Exception:
                    ssl_ctx = ssl._create_unverified_context()
            except Exception:
                ssl_ctx = None
            
            try:
                if ssl_ctx is not None:
                    with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as response:
                        response_data = response.read()
                else:
                    with urllib.request.urlopen(req, timeout=30) as response:
                        response_data = response.read()
                self.send_response(200)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)
            except HTTPError as e:
                err_body = e.read()
                self.log_message('TTS upstream error %s: %s', e.code, err_body.decode('utf-8', errors='ignore'))
                self.send_response(e.code)
                self.send_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(err_body)
        except Exception as e:
            self.log_message('TTS proxy exception: %s', str(e))
            self.send_error_response(f"TTS API错误: {str(e)}", status=500)

    def send_error_response(self, error_msg, status=500):
        """发送错误响应"""
        self.send_response(status)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        error_data = json.dumps({"error": error_msg}).encode('utf-8')
        self.wfile.write(error_data)

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def start_server(port=8012):
    """启动代理服务器"""
    handler = CORSProxyHandler
    
    try:
        with socketserver.TCPServer(("", port), handler) as httpd:
            print(f"🚀 代理服务器启动成功!")
            print(f"📍 本地地址: http://localhost:{port}/")
            print(f"🔧 API代理路径:")
            print(f"   - 文本生成: http://localhost:{port}/api/ark/chat")
            print(f"   - 语音合成: http://localhost:{port}/api/tts")
            print(f"💡 按 Ctrl+C 停止服务器")
            print("-" * 50)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 服务器已停止")
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"❌ 端口 {port} 已被占用，请尝试其他端口")
            start_server(port + 1)
        else:
            print(f"❌ 启动服务器失败: {e}")

if __name__ == "__main__":
    port = 8012
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ 端口号必须是数字")
            sys.exit(1)
    
    start_server(port)