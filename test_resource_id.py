#!/usr/bin/env python3
"""
TTS Resource ID 契约测试脚本
测试各种 Resource ID 场景：无 ID、有 ID、错误 ID、非法字符、两处不一致等
"""

import json
import urllib.request
import urllib.error
import time
import sys

# 测试配置
BASE_URL = "http://localhost:8003"
TEST_TEXT = "这是一个测试语音合成的文本。"
VOICE_TYPE = "zh_female_qingxin"

def make_request(endpoint, data=None, headers=None, method="POST"):
    """发送 HTTP 请求"""
    url = f"{BASE_URL}{endpoint}"
    
    if headers is None:
        headers = {"Content-Type": "application/json"}
    
    if data:
        data = json.dumps(data).encode('utf-8')
    
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            response_data = response.read().decode('utf-8')
            return {
                "status_code": response.getcode(),
                "data": json.loads(response_data) if response_data else {},
                "headers": dict(response.headers)
            }
    except urllib.error.HTTPError as e:
        error_data = e.read().decode('utf-8') if e.fp else ""
        return {
            "status_code": e.code,
            "data": json.loads(error_data) if error_data else {},
            "headers": dict(e.headers) if hasattr(e, 'headers') else {},
            "error": str(e)
        }
    except Exception as e:
        return {
            "status_code": 0,
            "data": {},
            "headers": {},
            "error": str(e)
        }

def test_case(name, description, test_func):
    """执行测试用例"""
    print(f"\n{'='*60}")
    print(f"测试用例: {name}")
    print(f"描述: {description}")
    print(f"{'='*60}")
    
    try:
        result = test_func()
        if result.get('passed', False):
            print(f"✅ 测试通过: {result.get('message', '')}")
        else:
            print(f"❌ 测试失败: {result.get('message', '')}")
        return result.get('passed', False)
    except Exception as e:
        print(f"❌ 测试异常: {str(e)}")
        return False

def test_no_resource_id():
    """测试场景1：无 Resource ID"""
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft"
    }
    
    response = make_request("/api/tts", payload)
    
    if response["status_code"] == 200:
        data = response["data"]
        if data.get("ok") and "data" in data:
            return {"passed": True, "message": f"成功合成音频，大小: {len(data.get('data', ''))} chars"}
        else:
            return {"passed": False, "message": f"响应格式错误: {data}"}
    else:
        return {"passed": False, "message": f"HTTP {response['status_code']}: {response.get('data', {})}"}

def test_valid_resource_id_header():
    """测试场景2：有效的 Resource ID (Header)"""
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Api-Resource-Id": "test-resource-123"
    }
    
    response = make_request("/api/tts", payload, headers)
    
    if response["status_code"] == 200:
        data = response["data"]
        if data.get("ok") and "data" in data:
            return {"passed": True, "message": f"成功合成音频，Resource ID 通过 Header 传递"}
        else:
            return {"passed": False, "message": f"响应格式错误: {data}"}
    else:
        return {"passed": False, "message": f"HTTP {response['status_code']}: {response.get('data', {})}"}

def test_valid_resource_id_body():
    """测试场景3：有效的 Resource ID (Body)"""
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft",
        "resource_id": "test-resource-456"
    }
    
    response = make_request("/api/tts", payload)
    
    if response["status_code"] == 200:
        data = response["data"]
        if data.get("ok") and "data" in data:
            return {"passed": True, "message": f"成功合成音频，Resource ID 通过 Body 传递"}
        else:
            return {"passed": False, "message": f"响应格式错误: {data}"}
    else:
        return {"passed": False, "message": f"HTTP {response['status_code']}: {response.get('data', {})}"}

def test_invalid_resource_id_chars():
    """测试场景4：非法字符的 Resource ID"""
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft",
        "resource_id": "invalid@resource#id!"
    }
    
    response = make_request("/api/tts", payload)
    
    if response["status_code"] == 400:
        data = response["data"]
        if data.get("errorCode") == "INVALID_RESOURCE_ID":
            return {"passed": True, "message": f"正确拒绝非法字符: {data.get('message')}"}
        else:
            return {"passed": False, "message": f"错误码不正确: {data}"}
    else:
        return {"passed": False, "message": f"应该返回 400，实际: HTTP {response['status_code']}"}

def test_invalid_resource_id_length():
    """测试场景5：超长的 Resource ID"""
    long_id = "a" * 129  # 超过 128 字符限制
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft",
        "resource_id": long_id
    }
    
    response = make_request("/api/tts", payload)
    
    if response["status_code"] == 400:
        data = response["data"]
        if data.get("errorCode") == "INVALID_RESOURCE_ID":
            return {"passed": True, "message": f"正确拒绝超长 ID: {data.get('message')}"}
        else:
            return {"passed": False, "message": f"错误码不正确: {data}"}
    else:
        return {"passed": False, "message": f"应该返回 400，实际: HTTP {response['status_code']}"}

def test_resource_id_mismatch():
    """测试场景6：Header 和 Body 不一致"""
    payload = {
        "text": TEST_TEXT,
        "voice_type": VOICE_TYPE,
        "quality": "draft",
        "resource_id": "body-resource-id"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Api-Resource-Id": "header-resource-id"
    }
    
    response = make_request("/api/tts", payload, headers)
    
    # 应该使用 Header 的值，并且成功处理
    if response["status_code"] == 200:
        data = response["data"]
        if data.get("ok"):
            return {"passed": True, "message": "正确处理不一致情况，优先使用 Header 值"}
        else:
            return {"passed": False, "message": f"响应格式错误: {data}"}
    else:
        return {"passed": False, "message": f"HTTP {response['status_code']}: {response.get('data', {})}"}

def test_cors_headers():
    """测试场景7：CORS 预检请求"""
    headers = {
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Api-Resource-Id",
        "Origin": "http://localhost:3000"
    }
    
    response = make_request("/api/tts", method="OPTIONS", headers=headers)
    
    if response["status_code"] == 204:
        cors_headers = response["headers"]
        allowed_headers = cors_headers.get("Access-Control-Allow-Headers", "")
        if "X-Api-Resource-Id" in allowed_headers:
            return {"passed": True, "message": f"CORS 头部正确包含 X-Api-Resource-Id: {allowed_headers}"}
        else:
            return {"passed": False, "message": f"CORS 头部缺少 X-Api-Resource-Id: {allowed_headers}"}
    else:
        return {"passed": False, "message": f"OPTIONS 请求失败: HTTP {response['status_code']}"}

def main():
    """主测试函数"""
    print("TTS Resource ID 契约测试")
    print(f"测试目标: {BASE_URL}")
    print(f"开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 测试用例列表
    test_cases = [
        ("test_no_resource_id", "无 Resource ID", test_no_resource_id),
        ("test_valid_resource_id_header", "有效的 Resource ID (Header)", test_valid_resource_id_header),
        ("test_valid_resource_id_body", "有效的 Resource ID (Body)", test_valid_resource_id_body),
        ("test_invalid_resource_id_chars", "非法字符的 Resource ID", test_invalid_resource_id_chars),
        ("test_invalid_resource_id_length", "超长的 Resource ID", test_invalid_resource_id_length),
        ("test_resource_id_mismatch", "Header 和 Body 不一致", test_resource_id_mismatch),
        ("test_cors_headers", "CORS 预检请求", test_cors_headers),
    ]
    
    # 执行测试
    passed = 0
    total = len(test_cases)
    
    for test_name, description, test_func in test_cases:
        if test_case(test_name, description, test_func):
            passed += 1
    
    # 测试结果汇总
    print(f"\n{'='*60}")
    print(f"测试结果汇总")
    print(f"{'='*60}")
    print(f"总测试数: {total}")
    print(f"通过数: {passed}")
    print(f"失败数: {total - passed}")
    print(f"通过率: {passed/total*100:.1f}%")
    print(f"结束时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 返回退出码
    sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()