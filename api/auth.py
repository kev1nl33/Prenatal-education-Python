import json
import os
import hashlib
import uuid
import time
from http.server import BaseHTTPRequestHandler
from typing import Dict, Optional

# 简单的token存储（生产环境应使用Redis等）
_active_tokens: Dict[str, Dict] = {}

def _get_cors_headers():
    allowed_origin = os.environ.get('ALLOWED_ORIGIN', '*')
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def _hash_password(password: str) -> str:
    """使用SHA256哈希密码"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def _verify_password(password: str) -> bool:
    """
    验证密码是否正确
    从环境变量读取正确的密码哈希值
    """
    # 从环境变量读取密码（明文或哈希）
    correct_password = os.environ.get('APP_PASSWORD', 'xiaoman')

    # 如果环境变量中是哈希值（64位十六进制），直接比较
    if len(correct_password) == 64 and all(c in '0123456789abcdef' for c in correct_password.lower()):
        return _hash_password(password) == correct_password.lower()

    # 否则当作明文密码比较（向后兼容）
    return password == correct_password


def _generate_token() -> str:
    """生成安全的访问令牌"""
    return hashlib.sha256(f"{uuid.uuid4()}{time.time()}".encode()).hexdigest()


def _cleanup_expired_tokens():
    """清理过期的token（超过24小时）"""
    current_time = time.time()
    expired_tokens = [
        token for token, data in _active_tokens.items()
        if current_time - data['created_at'] > 86400  # 24小时
    ]
    for token in expired_tokens:
        del _active_tokens[token]


def _validate_token(token: str) -> bool:
    """验证token是否有效"""
    _cleanup_expired_tokens()
    return token in _active_tokens


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """处理CORS预检请求"""
        cors_headers = _get_cors_headers()
        self.send_response(204)
        for key, value in cors_headers.items():
            self.send_header(key, value)
        self.end_headers()

    def do_POST(self):
        """处理认证请求"""
        cors_headers = _get_cors_headers()

        try:
            # 解析请求体
            content_length = int(self.headers.get('Content-Length', 0))
            raw_data = self.rfile.read(content_length)
            data = json.loads(raw_data.decode("utf-8")) if raw_data else {}

            action = data.get("action", "login")

            if action == "login":
                # 登录：验证密码并生成token
                password = data.get("password", "").strip()

                if not password:
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PARAMETER",
                        "message": "密码不能为空"
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return

                # 验证密码
                if _verify_password(password):
                    # 生成token
                    token = _generate_token()
                    _active_tokens[token] = {
                        'created_at': time.time(),
                        'user': 'authenticated_user'
                    }

                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": True,
                        "message": "认证成功",
                        "token": token,
                        "expiresIn": 86400  # 24小时
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                else:
                    # 密码错误
                    self.send_response(401)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PASSWORD",
                        "message": "密码错误，请重试"
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            elif action == "verify":
                # 验证token是否有效
                token = data.get("token", "").strip()

                if not token:
                    self.send_response(400)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_PARAMETER",
                        "message": "Token不能为空"
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                    return

                if _validate_token(token):
                    self.send_response(200)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": True,
                        "message": "Token有效",
                        "valid": True
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
                else:
                    self.send_response(401)
                    for key, value in cors_headers.items():
                        self.send_header(key, value)
                    self.end_headers()
                    response = {
                        "ok": False,
                        "errorCode": "INVALID_TOKEN",
                        "message": "Token无效或已过期",
                        "valid": False
                    }
                    self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            elif action == "logout":
                # 退出登录：删除token
                token = data.get("token", "").strip()

                if token in _active_tokens:
                    del _active_tokens[token]

                self.send_response(200)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": True,
                    "message": "退出成功"
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            else:
                # 不支持的action
                self.send_response(400)
                for key, value in cors_headers.items():
                    self.send_header(key, value)
                self.end_headers()
                response = {
                    "ok": False,
                    "errorCode": "INVALID_ACTION",
                    "message": f"不支持的操作: {action}"
                }
                self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            for key, value in cors_headers.items():
                self.send_header(key, value)
            self.end_headers()
            response = {
                "ok": False,
                "errorCode": "INTERNAL_ERROR",
                "message": f"服务器错误: {str(e)}"
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        """健康检查"""
        cors_headers = _get_cors_headers()
        self.send_response(200)
        for key, value in cors_headers.items():
            self.send_header(key, value)
        self.end_headers()
        response = {
            "message": "Authentication API is running",
            "endpoints": {
                "POST /api/auth": {
                    "login": "验证密码并获取token",
                    "verify": "验证token是否有效",
                    "logout": "退出登录"
                }
            }
        }
        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))
