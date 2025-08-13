from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            "message": "Hello from Python!",
            "status": "success",
            "timestamp": "2024-01-01T00:00:00Z"
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return
    
    def do_POST(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {
            "message": "POST request received!",
            "status": "success"
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
        return