#!/usr/bin/env python3
import requests
import json
import time

def test_api():
    url = "https://prenatal-education-python.vercel.app/api/ark"
    headers = {
        "Content-Type": "application/json"
    }
    data = {
        "prompt": "请给我讲一个关于小兔子的胎教故事"
    }
    
    print("测试API...")
    print(f"URL: {url}")
    print(f"请求数据: {json.dumps(data, ensure_ascii=False)}")
    
    try:
        start_time = time.time()
        response = requests.post(url, headers=headers, json=data, timeout=15)
        end_time = time.time()
        
        print(f"\n状态码: {response.status_code}")
        print(f"响应时间: {end_time - start_time:.2f}秒")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"\n响应内容: {json.dumps(result, ensure_ascii=False, indent=2)}")
                print("\n✅ API测试成功！")
            except json.JSONDecodeError:
                print(f"\n响应文本: {response.text}")
                print("❌ 响应不是有效的JSON")
        else:
            print(f"\n错误响应: {response.text}")
            print("❌ API测试失败")
            
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求错误: {e}")
    except Exception as e:
        print(f"❌ 未知错误: {e}")

if __name__ == "__main__":
    test_api()