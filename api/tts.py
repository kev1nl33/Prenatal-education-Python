import json
import os
import ssl
import urllib.request
from urllib.error import HTTPError


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
    allowed_origin = os.environ.get('ALLOWED_ORIGIN')
    if not allowed_origin:
        raise ValueError('ALLOWED_ORIGIN environment variable is required')
    
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowed_origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
    }


def _verify_auth(request):
    auth_token = os.environ.get('AUTH_TOKEN')
    if not auth_token:
        raise ValueError('AUTH_TOKEN environment variable is required')
    
    request_token = request.headers.get('X-Auth-Token') or request.headers.get('x-auth-token')
    if request_token != auth_token:
        return False
    return True


def handler(request):
    try:
        cors_headers = _get_cors_headers()
        
        # 处理CORS预检请求
        if request.method == "OPTIONS":
            return {
                "statusCode": 204,
                "headers": cors_headers,
                "body": ""
            }
        
        # 验证访问令牌
        if not _verify_auth(request):
            return {
                "statusCode": 401,
                "headers": cors_headers,
                "body": json.dumps({"error": "Unauthorized"}, ensure_ascii=False)
            }
        
        # 获取环境变量中的TTS访问令牌
        tts_access_token = os.environ.get('TTS_ACCESS_TOKEN')
        if not tts_access_token:
            return {
                "statusCode": 500,
                "headers": cors_headers,
                "body": json.dumps({"error": "TTS_ACCESS_TOKEN not configured"}, ensure_ascii=False)
            }
        
        # 解析请求体
        raw = request.body.decode("utf-8") if isinstance(request.body, (bytes, bytearray)) else (request.body or "")
        data = json.loads(raw) if raw else {}
        
        text = data.get("text", "")
        if not text:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "text is required"}, ensure_ascii=False)
            }
        
        # 构建TTS请求payload，使用传入的参数
        tts_payload = {
            "app": {
                "appid": data.get("appid", os.environ.get('TTS_APP_ID', '')),
                "token": tts_access_token,
                "cluster": data.get("cluster", "volcano_tts")
            },
            "user": {
                "uid": data.get("uid", "test_user_001")
            },
            "audio": {
                "voice_type": data.get("voice_type", "zh_female_xinlingjitang_moon_bigtts"),
                "encoding": data.get("encoding", "mp3"),
                "speed_ratio": data.get("speed_ratio", 1.0),
                "volume_ratio": data.get("volume_ratio", 1.0),
                "pitch_ratio": data.get("pitch_ratio", 1.0)
            },
            "request": {
                "reqid": data.get("reqid", str(int(__import__('time').time() * 1000))),
                "text": text,
                "text_type": data.get("text_type", "plain"),
                "operation": data.get("operation", "query"),
                "with_frontend": data.get("with_frontend", 1),
                "frontend_type": data.get("frontend_type", "unitTson")
            }
        }
        
        req_data = json.dumps(tts_payload).encode("utf-8")
        req = urllib.request.Request(
            "https://openspeech.bytedance.com/api/v1/tts",
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer;{tts_access_token}"
            }
        )
        
        # 发送请求
        ctx = _build_ssl_ctx()
        try:
            if ctx is not None:
                with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                    response_data = response.read()
                    return {
                        "statusCode": 200,
                        "headers": cors_headers,
                        "body": response_data.decode("utf-8")
                    }
            else:
                with urllib.request.urlopen(req, timeout=30) as response:
                    response_data = response.read()
                    return {
                        "statusCode": 200,
                        "headers": cors_headers,
                        "body": response_data.decode("utf-8")
                    }
        except HTTPError as e:
            err_body = e.read()
            return {
                "statusCode": e.code,
                "headers": cors_headers,
                "body": err_body.decode("utf-8")
            }
    except Exception as e:
        try:
            cors_headers = _get_cors_headers()
        except:
            cors_headers = {"Content-Type": "application/json"}
        
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e)}, ensure_ascii=False)
        }