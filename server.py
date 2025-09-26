#!/usr/bin/env python3
import os
import sys
import json
import logging
import traceback
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse
from dotenv import load_dotenv

# 在启动时加载 .env 文件
load_dotenv()

# --- 日志服务初始化 ---
# 必须在其他模块导入之前调用，以确保日志配置在应用启动时立即生效
try:
    from services.logger_setup import setup_logging
    setup_logging()
except ImportError as e:
    # 如果日志模块导入失败，使用标准输出并退出
    print(f"CRITICAL: Failed to import or set up logging service: {e}", file=sys.stderr)
    sys.exit(1)


# --- API 模块导入 ---
# 在启动时导入所有API模块，以提高性能和可维护性
try:
    from api import ark, tts, voice_clone, health, debug
except ImportError as e:
    logging.critical(f"无法导入API模块. {e}", exc_info=True)
    sys.exit(1)

# --- 主应用 ---

class APIRouterHandler(SimpleHTTPRequestHandler):
    """
    一个请求处理器，负责路由API调用和提供静态文件服务。
    - /api/ 下的路由会被分派到特定的处理器。
    - 其他路由则提供 /public 目录下的静态文件。
    """

    # --- API 路由配置 ---
    # 一个简单的路由字典，将URL路径映射到它们的处理器类。
    API_ROUTES = {
        '/api/ark': ark.handler,
        '/api/generate': ark.handler,
        '/api/tts': tts.handler,
        '/api/voice_clone': voice_clone.handler,
        '/api/health': health.handler, # 新增的健康检查路由
    }

    def _send_json_response(self, status_code, data, headers=None):
        """发送标准JSON响应的辅助函数。"""
        try:
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            if headers:
                for key, value in headers.items():
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
        except (BrokenPipeError, ConnectionResetError):
            logging.warning("客户端在响应发送前断开了连接。")

    def _dispatch_api_request(self):
        """
        所有 /api/ 请求的中央分派器。
        """
        parsed_path = urlparse(self.path)
        handler_class = self.API_ROUTES.get(parsed_path.path)

        if not handler_class:
            self._send_json_response(404, {"error": "API endpoint not found"})
            return

        try:
            method_name = f'do_{self.command}'
            handler_method = getattr(handler_class, method_name, None)

            if handler_method:
                logging.info(f'Routing {self.command} {self.path} -> {parsed_path.path}')
                handler_method(self)
            else:
                self._send_json_response(405, {"error": f"Method {self.command} not allowed"})
        except Exception as e:
            logging.error(f"处理 {self.path} 时出错: {e}", exc_info=True)
            self._send_json_response(500, {"error": f"Internal server error: {str(e)}"})

    def _serve_static_file(self):
        """提供 'public' 目录下的静态文件服务。"""
        path = urlparse(self.path).path
        if path in ('/', ''):
            self.path = 'public/index.html'
        elif not path.startswith('/public/'):
            self.path = f'public{path}'
        
        # SimpleHTTPRequestHandler 需要路径不以斜杠开头
        if self.path.startswith('/'):
            self.path = self.path[1:]

        super().do_GET()

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._dispatch_api_request()
        else:
            self._serve_static_file()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._dispatch_api_request()
        else:
            self._send_json_response(405, {"error": "Method not allowed for static resources"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Auth-Token, X-Api-Resource-Id')
        self.end_headers()

def run_server(port=8000):
    """启动本地开发服务器。"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, APIRouterHandler)
    logging.info(f"Starting server on port {port}...")
    logging.info(f"Server running at http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logging.info("\nShutting down server...")
        httpd.shutdown()

# 为Vercel运行时导出处理器
handler = APIRouterHandler

if __name__ == '__main__':
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            logging.warning(f"无效的端口号 '{sys.argv[1]}', 使用默认端口 {port}.")
    
    run_server(port)
