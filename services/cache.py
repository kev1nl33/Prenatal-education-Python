import os
import hashlib
import json
import time
from typing import Optional, Dict, Any
from pathlib import Path


class TTSCache:
    """TTS结果缓存管理"""
    
    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir is None:
            # 在无状态平台上优先使用 /tmp，其它路径仅在可写时使用
            candidates = [
                '/tmp/tts',
                '/.vercel/cache/tts',  # 仅当其可写时使用
                './cache/tts'
            ]
            chosen = None
            for path in candidates:
                try:
                    os.makedirs(path, exist_ok=True)
                    if os.access(path, os.W_OK):
                        chosen = path
                        break
                except Exception:
                    continue
            cache_dir = chosen or './cache/tts'
        
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # 元数据文件
        self.metadata_file = self.cache_dir / 'metadata.json'
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict[str, Any]:
        """加载缓存元数据"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        
        return {
            "version": "1.0",
            "created": time.time(),
            "entries": {},  # hash -> {file, text, voice, params, created, accessed, size}
            "stats": {
                "hits": 0,
                "misses": 0,
                "total_size": 0
            }
        }
    
    def _save_metadata(self):
        """保存缓存元数据"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save cache metadata: {e}")
    
    def _generate_cache_key(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> str:
        """
        生成缓存键
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            缓存键（hash值）
        """
        # 标准化参数
        if params is None:
            params = {}
        
        # 创建用于hash的字符串
        cache_input = {
            "text": text.strip(),
            "voice": voice,
            "params": sorted(params.items()) if params else []
        }
        
        cache_str = json.dumps(cache_input, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(cache_str.encode('utf-8')).hexdigest()[:16]
    
    def _get_cache_file_path(self, cache_key: str) -> Path:
        """获取缓存文件路径"""
        return self.cache_dir / f"{cache_key}.bin"
    
    def get(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> Optional[bytes]:
        """
        获取缓存的音频数据
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            缓存的音频数据，如果不存在则返回None
        """
        cache_key = self._generate_cache_key(text, voice, params)
        cache_file = self._get_cache_file_path(cache_key)
        
        if not cache_file.exists():
            self.metadata["stats"]["misses"] += 1
            self._save_metadata()
            return None
        
        try:
            with open(cache_file, 'rb') as f:
                audio_data = f.read()
            
            # 更新访问时间和统计
            if cache_key in self.metadata["entries"]:
                self.metadata["entries"][cache_key]["accessed"] = time.time()
            
            self.metadata["stats"]["hits"] += 1
            self._save_metadata()
            
            return audio_data
            
        except Exception as e:
            print(f"Warning: Failed to read cache file {cache_file}: {e}")
            self.metadata["stats"]["misses"] += 1
            self._save_metadata()
            return None
    
    def set(self, text: str, audio_data: bytes, voice: str = "default", params: Optional[Dict] = None):
        """
        设置缓存
        
        Args:
            text: 要合成的文本
            audio_data: 音频数据
            voice: 音色参数
            params: 其他参数
        """
        cache_key = self._generate_cache_key(text, voice, params)
        cache_file = self._get_cache_file_path(cache_key)
        
        try:
            with open(cache_file, 'wb') as f:
                f.write(audio_data)
            
            # 更新元数据
            file_size = len(audio_data)
            current_time = time.time()
            
            self.metadata["entries"][cache_key] = {
                "file": cache_file.name,
                "text": text[:100],  # 只保存前100个字符用于调试
                "voice": voice,
                "params": params or {},
                "created": current_time,
                "accessed": current_time,
                "size": file_size
            }
            
            self.metadata["stats"]["total_size"] += file_size
            self._save_metadata()
            
        except Exception as e:
            print(f"Warning: Failed to save cache file {cache_file}: {e}")
    
    def exists(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> bool:
        """
        检查缓存是否存在
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            是否存在缓存
        """
        cache_key = self._generate_cache_key(text, voice, params)
        cache_file = self._get_cache_file_path(cache_key)
        return cache_file.exists()
    
    def delete(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> bool:
        """
        删除缓存
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            是否成功删除
        """
        cache_key = self._generate_cache_key(text, voice, params)
        cache_file = self._get_cache_file_path(cache_key)
        
        if not cache_file.exists():
            return False
        
        try:
            # 更新统计
            if cache_key in self.metadata["entries"]:
                file_size = self.metadata["entries"][cache_key]["size"]
                self.metadata["stats"]["total_size"] -= file_size
                del self.metadata["entries"][cache_key]
            
            cache_file.unlink()
            self._save_metadata()
            return True
            
        except Exception as e:
            print(f"Warning: Failed to delete cache file {cache_file}: {e}")
            return False
    
    def cleanup(self, max_age_days: int = 7, max_size_mb: int = 100):
        """
        清理缓存
        
        Args:
            max_age_days: 最大保留天数
            max_size_mb: 最大缓存大小（MB）
        """
        current_time = time.time()
        max_age_seconds = max_age_days * 24 * 3600
        max_size_bytes = max_size_mb * 1024 * 1024
        
        # 收集需要删除的条目
        entries_to_delete = []
        
        for cache_key, entry in self.metadata["entries"].items():
            # 检查年龄
            age = current_time - entry["accessed"]
            if age > max_age_seconds:
                entries_to_delete.append(cache_key)
        
        # 如果总大小超过限制，删除最旧的条目
        if self.metadata["stats"]["total_size"] > max_size_bytes:
            # 按访问时间排序
            sorted_entries = sorted(
                self.metadata["entries"].items(),
                key=lambda x: x[1]["accessed"]
            )
            
            current_size = self.metadata["stats"]["total_size"]
            for cache_key, entry in sorted_entries:
                if current_size <= max_size_bytes:
                    break
                if cache_key not in entries_to_delete:
                    entries_to_delete.append(cache_key)
                    current_size -= entry["size"]
        
        # 执行删除
        deleted_count = 0
        for cache_key in entries_to_delete:
            cache_file = self._get_cache_file_path(cache_key)
            try:
                if cache_file.exists():
                    cache_file.unlink()
                
                if cache_key in self.metadata["entries"]:
                    file_size = self.metadata["entries"][cache_key]["size"]
                    self.metadata["stats"]["total_size"] -= file_size
                    del self.metadata["entries"][cache_key]
                
                deleted_count += 1
                
            except Exception as e:
                print(f"Warning: Failed to delete cache file {cache_file}: {e}")
        
        if deleted_count > 0:
            self._save_metadata()
            print(f"Cleaned up {deleted_count} cache entries")
    
    def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        stats = self.metadata["stats"].copy()
        
        # 计算命中率
        total_requests = stats["hits"] + stats["misses"]
        hit_rate = (stats["hits"] / total_requests * 100) if total_requests > 0 else 0
        
        # 计算大小（MB）
        size_mb = stats["total_size"] / (1024 * 1024)
        
        return {
            "hit_rate": round(hit_rate, 1),
            "total_entries": len(self.metadata["entries"]),
            "total_size_mb": round(size_mb, 2),
            "hits": stats["hits"],
            "misses": stats["misses"]
        }


# 全局实例
_tts_cache = None

def get_tts_cache() -> TTSCache:
    """获取全局TTS缓存实例"""
    global _tts_cache
    if _tts_cache is None:
        _tts_cache = TTSCache()
    return _tts_cache