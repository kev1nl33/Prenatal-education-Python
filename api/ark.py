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
        
        # 获取环境变量中的API密钥
        ark_api_key = os.environ.get('ARK_API_KEY')
        if not ark_api_key:
            return {
                "statusCode": 500,
                "headers": cors_headers,
                "body": json.dumps({"error": "ARK_API_KEY not configured"}, ensure_ascii=False)
            }
        
        # 解析请求体
        raw = request.body.decode("utf-8") if isinstance(request.body, (bytes, bytearray)) else (request.body or "")
        data = json.loads(raw) if raw else {}
        
        prompt = data.get("prompt", "")
        model = data.get("model") or os.environ.get('ARK_MODEL', 'kimi-k2-250711')
        
        if not prompt:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "prompt is required"}, ensure_ascii=False)
            }
        
        # 构建火山方舟请求
        ark_payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": "你是一个专业的胎教内容创作助手，擅长生成温馨、积极、有益的胎教内容。"},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 2000,
            "temperature": 0.7
        }
        
        req_data = json.dumps(ark_payload).encode("utf-8")
        req = urllib.request.Request(
            "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            data=req_data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {ark_api_key}"
            }
        )
        
        # 发送请求
        ctx = _build_ssl_ctx()
        try:
            if ctx is not None:
                with urllib.request.urlopen(req, timeout=30, context=ctx) as response:
                    response_data = response.read()
                    # 解析火山方舟API的响应并返回JSON格式
                    try:
                        ark_response = json.loads(response_data.decode("utf-8"))
                        return {
                            "statusCode": 200,
                            "headers": cors_headers,
                            "body": json.dumps(ark_response, ensure_ascii=False)
                        }
                    except json.JSONDecodeError:
                        # 如果响应不是JSON格式，直接返回文本
                        return {
                            "statusCode": 200,
                            "headers": cors_headers,
                            "body": json.dumps({"content": response_data.decode("utf-8")}, ensure_ascii=False)
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
            # 尝试解析错误响应为JSON，如果失败则包装为JSON格式
            try:
                error_response = json.loads(err_body.decode("utf-8"))
                return {
                    "statusCode": e.code,
                    "headers": cors_headers,
                    "body": json.dumps(error_response, ensure_ascii=False)
                }
            except json.JSONDecodeError:
                return {
                    "statusCode": e.code,
                    "headers": cors_headers,
                    "body": json.dumps({"error": err_body.decode("utf-8")}, ensure_ascii=False)
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