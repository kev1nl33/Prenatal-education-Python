#!/usr/bin/env python3
"""
TTS API 负载测试脚本
测试 TTS API 在并发请求下的性能和稳定性
"""

import json
import urllib.request
import urllib.error
import time
import threading
import statistics
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# 测试配置
BASE_URL = "http://localhost:8003"
CONCURRENT_USERS = 5  # 并发用户数
REQUESTS_PER_USER = 10  # 每个用户的请求数
TEST_TEXTS = [
    "这是第一个测试文本，用于语音合成。",
    "今天天气真好，阳光明媚。",
    "人工智能技术正在快速发展。",
    "音频合成质量越来越高。",
    "测试不同长度的文本内容。"
]
VOICE_TYPES = ["zh_female_qingxin", "zh_male_chunhou"]
RESOURCE_IDS = ["", "test-resource-1", "test-resource-2"]

# 全局统计
stats_lock = threading.Lock()
request_stats = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "response_times": [],
    "error_codes": {},
    "cache_hits": 0,
    "cache_misses": 0
}

def make_request(text, voice_type, resource_id="", quality="draft"):
    """发送单个 TTS 请求"""
    start_time = time.time()
    
    payload = {
        "text": text,
        "voice_type": voice_type,
        "quality": quality
    }
    
    headers = {"Content-Type": "application/json"}
    
    if resource_id:
        headers["X-Api-Resource-Id"] = resource_id
    
    url = f"{BASE_URL}/api/tts"
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            response_data = response.read().decode('utf-8')
            end_time = time.time()
            
            result = {
                "success": True,
                "status_code": response.getcode(),
                "response_time": end_time - start_time,
                "data": json.loads(response_data) if response_data else {},
                "request_id": None,
                "from_cache": False,
                "audio_size": 0
            }
            
            # 解析响应数据
            if result["data"]:
                result["request_id"] = result["data"].get("requestId")
                result["from_cache"] = result["data"].get("fromCache", False)
                audio_data = result["data"].get("data", "")
                result["audio_size"] = len(audio_data) if audio_data else 0
            
            return result
            
    except urllib.error.HTTPError as e:
        end_time = time.time()
        error_data = e.read().decode('utf-8') if e.fp else ""
        
        return {
            "success": False,
            "status_code": e.code,
            "response_time": end_time - start_time,
            "error": str(e),
            "error_data": json.loads(error_data) if error_data else {},
            "request_id": None
        }
        
    except Exception as e:
        end_time = time.time()
        return {
            "success": False,
            "status_code": 0,
            "response_time": end_time - start_time,
            "error": str(e),
            "request_id": None
        }

def update_stats(result):
    """更新全局统计信息"""
    with stats_lock:
        stats = request_stats
        stats["total_requests"] += 1
        stats["response_times"].append(result["response_time"])
        
        if result["success"]:
            stats["successful_requests"] += 1
            
            # 缓存统计
            if result.get("from_cache"):
                stats["cache_hits"] += 1
            else:
                stats["cache_misses"] += 1
        else:
            stats["failed_requests"] += 1
            
            # 错误码统计
            error_code = result.get("status_code", 0)
            if error_code in stats["error_codes"]:
                stats["error_codes"][error_code] += 1
            else:
                stats["error_codes"][error_code] = 1

def worker_thread(worker_id, requests_count):
    """工作线程函数"""
    print(f"Worker {worker_id} 开始执行 {requests_count} 个请求")
    
    results = []
    
    for i in range(requests_count):
        # 随机选择测试参数
        import random
        text = random.choice(TEST_TEXTS)
        voice_type = random.choice(VOICE_TYPES)
        resource_id = random.choice(RESOURCE_IDS)
        
        print(f"Worker {worker_id} 请求 {i+1}/{requests_count}: text_len={len(text)}, voice={voice_type}, resource={'yes' if resource_id else 'no'}")
        
        result = make_request(text, voice_type, resource_id)
        result["worker_id"] = worker_id
        result["request_index"] = i + 1
        
        results.append(result)
        update_stats(result)
        
        # 请求间隔（避免过于密集）
        time.sleep(0.1)
    
    print(f"Worker {worker_id} 完成所有请求")
    return results

def print_progress():
    """打印进度信息"""
    while True:
        time.sleep(2)
        with stats_lock:
            total = request_stats["total_requests"]
            success = request_stats["successful_requests"]
            failed = request_stats["failed_requests"]
            
            if total == 0:
                continue
                
            print(f"\r进度: {total}/{CONCURRENT_USERS * REQUESTS_PER_USER} 请求 | 成功: {success} | 失败: {failed}", end="", flush=True)
            
            # 检查是否完成
            if total >= CONCURRENT_USERS * REQUESTS_PER_USER:
                break

def calculate_statistics():
    """计算并打印统计信息"""
    stats = request_stats
    
    if not stats["response_times"]:
        print("没有收集到响应时间数据")
        return
    
    response_times = stats["response_times"]
    
    print(f"\n{'='*60}")
    print(f"负载测试结果统计")
    print(f"{'='*60}")
    
    # 基本统计
    print(f"总请求数: {stats['total_requests']}")
    print(f"成功请求: {stats['successful_requests']}")
    print(f"失败请求: {stats['failed_requests']}")
    print(f"成功率: {stats['successful_requests']/stats['total_requests']*100:.1f}%")
    
    # 缓存统计
    total_cache_requests = stats['cache_hits'] + stats['cache_misses']
    if total_cache_requests > 0:
        cache_hit_rate = stats['cache_hits'] / total_cache_requests * 100
        print(f"缓存命中率: {cache_hit_rate:.1f}% ({stats['cache_hits']}/{total_cache_requests})")
    
    # 响应时间统计
    print(f"\n响应时间统计 (秒):")
    print(f"  平均响应时间: {statistics.mean(response_times):.3f}")
    print(f"  中位数响应时间: {statistics.median(response_times):.3f}")
    print(f"  最小响应时间: {min(response_times):.3f}")
    print(f"  最大响应时间: {max(response_times):.3f}")
    
    if len(response_times) > 1:
        print(f"  响应时间标准差: {statistics.stdev(response_times):.3f}")
    
    # 百分位数
    sorted_times = sorted(response_times)
    p50 = sorted_times[int(len(sorted_times) * 0.5)]
    p90 = sorted_times[int(len(sorted_times) * 0.9)]
    p95 = sorted_times[int(len(sorted_times) * 0.95)]
    p99 = sorted_times[int(len(sorted_times) * 0.99)]
    
    print(f"  P50: {p50:.3f}")
    print(f"  P90: {p90:.3f}")
    print(f"  P95: {p95:.3f}")
    print(f"  P99: {p99:.3f}")
    
    # 吞吐量
    total_time = max(response_times) if response_times else 1
    throughput = stats['successful_requests'] / total_time
    print(f"\n吞吐量: {throughput:.2f} 请求/秒")
    
    # 错误统计
    if stats['error_codes']:
        print(f"\n错误码统计:")
        for code, count in sorted(stats['error_codes'].items()):
            print(f"  HTTP {code}: {count} 次")

def main():
    """主函数"""
    print(f"TTS API 负载测试")
    print(f"测试目标: {BASE_URL}")
    print(f"并发用户: {CONCURRENT_USERS}")
    print(f"每用户请求数: {REQUESTS_PER_USER}")
    print(f"总请求数: {CONCURRENT_USERS * REQUESTS_PER_USER}")
    print(f"开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    # 启动进度监控线程
    progress_thread = threading.Thread(target=print_progress, daemon=True)
    progress_thread.start()
    
    # 执行负载测试
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=CONCURRENT_USERS) as executor:
        # 提交所有工作线程
        futures = []
        for worker_id in range(CONCURRENT_USERS):
            future = executor.submit(worker_thread, worker_id + 1, REQUESTS_PER_USER)
            futures.append(future)
        
        # 等待所有线程完成
        all_results = []
        for future in as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except Exception as e:
                print(f"\n工作线程异常: {e}")
    
    end_time = time.time()
    total_duration = end_time - start_time
    
    print(f"\n\n测试完成，总耗时: {total_duration:.2f} 秒")
    
    # 计算和打印统计信息
    calculate_statistics()
    
    # 性能评估
    print(f"\n{'='*60}")
    print(f"性能评估")
    print(f"{'='*60}")
    
    success_rate = request_stats['successful_requests'] / request_stats['total_requests'] * 100
    avg_response_time = statistics.mean(request_stats['response_times']) if request_stats['response_times'] else 0
    
    if success_rate >= 95 and avg_response_time <= 5.0:
        print("✅ 性能优秀：成功率 ≥ 95% 且平均响应时间 ≤ 5秒")
        exit_code = 0
    elif success_rate >= 90 and avg_response_time <= 10.0:
        print("⚠️  性能良好：成功率 ≥ 90% 且平均响应时间 ≤ 10秒")
        exit_code = 0
    else:
        print("❌ 性能不佳：成功率 < 90% 或平均响应时间 > 10秒")
        exit_code = 1
    
    print(f"结束时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    sys.exit(exit_code)

if __name__ == "__main__":
    main()