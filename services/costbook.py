import os
import json
import time
from datetime import datetime, date
from typing import Dict, Any, Optional


class CostBook:
    """费用账本管理"""
    
    def __init__(self, storage_path: Optional[str] = None):
        if storage_path is None:
            # 优先使用Vercel缓存目录，否则使用临时目录
            if os.path.exists('/.vercel'):
                storage_path = '/.vercel/cache/costbook.json'
                os.makedirs('/.vercel/cache', exist_ok=True)
            else:
                storage_path = '/tmp/costbook.json' if os.path.exists('/tmp') else './costbook.json'
        
        self.storage_path = storage_path
        self.data = self._load_data()
    
    def _load_data(self) -> Dict[str, Any]:
        """加载账本数据"""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        
        # 默认数据结构
        return {
            "daily_stats": {},  # 按日期存储统计
            "total_calls": 0,
            "total_cost": 0.0,
            "cache_hits": 0,
            "cache_misses": 0,
            "errors": 0,
            "last_updated": time.time()
        }
    
    def _save_data(self):
        """保存账本数据"""
        self.data["last_updated"] = time.time()
        try:
            os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save cost book: {e}")
    
    def _get_today_key(self) -> str:
        """获取今日日期键"""
        return date.today().isoformat()
    
    def _get_today_stats(self) -> Dict[str, Any]:
        """获取今日统计数据"""
        today = self._get_today_key()
        if today not in self.data["daily_stats"]:
            self.data["daily_stats"][today] = {
                "calls": 0,
                "cost": 0.0,
                "cache_hits": 0,
                "cache_misses": 0,
                "errors": 0,
                "avg_latency": 0.0,
                "total_latency": 0.0
            }
        return self.data["daily_stats"][today]
    
    def will_exceed_today(self, limit: float) -> bool:
        """
        检查今日费用是否会超过限制
        
        Args:
            limit: 每日费用限制（元）
            
        Returns:
            是否会超过限制
        """
        today_stats = self._get_today_stats()
        return today_stats["cost"] >= limit
    
    def commit(self, cost: float, latency: float = 0.0, from_cache: bool = False, error: bool = False):
        """
        提交一次调用记录
        
        Args:
            cost: 本次调用费用
            latency: 延迟时间（秒）
            from_cache: 是否来自缓存
            error: 是否出错
        """
        today_stats = self._get_today_stats()
        
        # 更新今日统计
        today_stats["calls"] += 1
        today_stats["cost"] += cost
        today_stats["total_latency"] += latency
        
        if today_stats["calls"] > 0:
            today_stats["avg_latency"] = today_stats["total_latency"] / today_stats["calls"]
        
        if from_cache:
            today_stats["cache_hits"] += 1
            self.data["cache_hits"] += 1
        else:
            today_stats["cache_misses"] += 1
            self.data["cache_misses"] += 1
        
        if error:
            today_stats["errors"] += 1
            self.data["errors"] += 1
        
        # 更新总计
        self.data["total_calls"] += 1
        self.data["total_cost"] += cost
        
        self._save_data()
    
    def get_today_summary(self) -> Dict[str, Any]:
        """获取今日汇总"""
        today_stats = self._get_today_stats()
        
        # 计算缓存命中率
        total_requests = today_stats["cache_hits"] + today_stats["cache_misses"]
        cache_hit_rate = (today_stats["cache_hits"] / total_requests * 100) if total_requests > 0 else 0
        
        # 计算失败率
        error_rate = (today_stats["errors"] / today_stats["calls"] * 100) if today_stats["calls"] > 0 else 0
        
        return {
            "date": self._get_today_key(),
            "calls": today_stats["calls"],
            "cost": round(today_stats["cost"], 4),
            "cache_hit_rate": round(cache_hit_rate, 1),
            "error_rate": round(error_rate, 1),
            "avg_latency": round(today_stats["avg_latency"], 2)
        }
    
    def get_total_summary(self) -> Dict[str, Any]:
        """获取总体汇总"""
        total_requests = self.data["cache_hits"] + self.data["cache_misses"]
        cache_hit_rate = (self.data["cache_hits"] / total_requests * 100) if total_requests > 0 else 0
        error_rate = (self.data["errors"] / self.data["total_calls"] * 100) if self.data["total_calls"] > 0 else 0
        
        return {
            "total_calls": self.data["total_calls"],
            "total_cost": round(self.data["total_cost"], 4),
            "cache_hit_rate": round(cache_hit_rate, 1),
            "error_rate": round(error_rate, 1),
            "last_updated": datetime.fromtimestamp(self.data["last_updated"]).isoformat()
        }
    
    def cleanup_old_data(self, days_to_keep: int = 30):
        """清理旧数据"""
        cutoff_date = datetime.now().date()
        cutoff_timestamp = (cutoff_date - timedelta(days=days_to_keep)).isoformat()
        
        # 删除过期的日统计
        keys_to_remove = []
        for date_key in self.data["daily_stats"]:
            if date_key < cutoff_timestamp:
                keys_to_remove.append(date_key)
        
        for key in keys_to_remove:
            del self.data["daily_stats"][key]
        
        if keys_to_remove:
            self._save_data()


# 全局实例
_cost_book = None

def get_cost_book() -> CostBook:
    """获取全局费用账本实例"""
    global _cost_book
    if _cost_book is None:
        _cost_book = CostBook()
    return _cost_book