import json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_POST(self):
        try:
            # 读取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            data = json.loads(raw_data.decode('utf-8')) if raw_data else {}
            
            prompt = data.get('prompt', '默认胎教故事')
            
            # 返回简单的模拟响应
            response = {
                "choices": [{
                    "message": {
                        "content": f"这是一个基于提示 '{prompt}' 的胎教故事：从前有一只小兔子，它住在美丽的森林里。每天晚上，小兔子都会在月光下跳舞，为即将到来的小宝宝送上最温暖的祝福..."
                    }
                }]
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            error_response = {"error": str(e)}
            self.wfile.write(json.dumps(error_response, ensure_ascii=False).encode('utf-8'))