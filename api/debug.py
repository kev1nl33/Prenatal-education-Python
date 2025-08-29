# api/debug.py
import json
from http.server import BaseHTTPRequestHandler
from .state import LAST_TTS_DEBUG_INFO # Import the shared state

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        debug_info = {}
        if LAST_TTS_DEBUG_INFO:
            debug_info = LAST_TTS_DEBUG_INFO[0]
            
        response = {
            "message": "Last TTS call debug information.",
            "data": debug_info
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
