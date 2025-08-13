import json
import os
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            # 检查环境变量状态
            ark_api_key = os.environ.get('ARK_API_KEY', 'NOT_SET')
            
            # 隐藏真实的API密钥，只显示状态
            if ark_api_key == 'NOT_SET':
                key_status = 'NOT_SET'
            elif ark_api_key in ['your_ark_api_key_here', 'sk-your-real-api-key-here']:
                key_status = 'DEFAULT_VALUE'
            elif ark_api_key:
                key_status = f'SET (length: {len(ark_api_key)}, starts with: {ark_api_key[:10]}...)'
            else:
                key_status = 'EMPTY'
            
            force_test_mode = os.environ.get('FORCE_TEST_MODE', 'true').lower() == 'true'
            test_mode_by_key = ark_api_key in [None, '', 'your_ark_api_key_here', 'sk-your-real-api-key-here'] or not ark_api_key
            
            debug_info = {
                'ark_api_key_status': key_status,
                'force_test_mode': force_test_mode,
                'test_mode_by_key': test_mode_by_key,
                'test_mode_enabled': force_test_mode or test_mode_by_key,
                'environment_vars': {
                    'VERCEL': os.environ.get('VERCEL', 'NOT_SET'),
                    'VERCEL_ENV': os.environ.get('VERCEL_ENV', 'NOT_SET'),
                    'NODE_ENV': os.environ.get('NODE_ENV', 'NOT_SET'),
                    'FORCE_TEST_MODE': os.environ.get('FORCE_TEST_MODE', 'NOT_SET')
                }
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(debug_info, ensure_ascii=False, indent=2).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}, ensure_ascii=False).encode('utf-8'))