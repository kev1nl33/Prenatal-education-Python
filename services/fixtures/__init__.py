import os
import json
import hashlib
import time
from typing import Dict, Any, Optional, List
from pathlib import Path


class FixtureManager:
    """录制回放管理器"""
    
    def __init__(self, fixtures_dir: Optional[str] = None):
        if fixtures_dir is None:
            fixtures_dir = os.path.join(os.path.dirname(__file__))
        
        self.fixtures_dir = Path(fixtures_dir)
        self.fixtures_dir.mkdir(parents=True, exist_ok=True)
        
        # 索引文件
        self.index_file = self.fixtures_dir / 'index.json'
        self.index = self._load_index()
    
    def _load_index(self) -> Dict[str, Any]:
        """加载fixtures索引"""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        
        return {
            "version": "1.0",
            "created": time.time(),
            "fixtures": {},  # hash -> {file, text, voice, params, created, size, duration}
            "stats": {
                "total_fixtures": 0,
                "total_size": 0
            }
        }
    
    def _save_index(self):
        """保存fixtures索引"""
        try:
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(self.index, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save fixtures index: {e}")
    
    def _generate_fixture_key(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> str:
        """
        生成fixture键
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            fixture键（hash值）
        """
        if params is None:
            params = {}
        
        fixture_input = {
            "text": text.strip(),
            "voice": voice,
            "params": sorted(params.items()) if params else []
        }
        
        fixture_str = json.dumps(fixture_input, ensure_ascii=False, sort_keys=True)
        return hashlib.sha256(fixture_str.encode('utf-8')).hexdigest()[:16]
    
    def _get_fixture_file_path(self, fixture_key: str) -> Path:
        """获取fixture文件路径"""
        return self.fixtures_dir / f"{fixture_key}.wav"
    
    def record(self, text: str, audio_data: bytes, voice: str = "default", 
               params: Optional[Dict] = None, duration: float = 0.0) -> str:
        """
        录制fixture
        
        Args:
            text: 要合成的文本
            audio_data: 音频数据
            voice: 音色参数
            params: 其他参数
            duration: 音频时长（秒）
            
        Returns:
            fixture键
        """
        fixture_key = self._generate_fixture_key(text, voice, params)
        fixture_file = self._get_fixture_file_path(fixture_key)
        
        try:
            # 保存音频文件
            with open(fixture_file, 'wb') as f:
                f.write(audio_data)
            
            # 更新索引
            file_size = len(audio_data)
            
            self.index["fixtures"][fixture_key] = {
                "file": fixture_file.name,
                "text": text,
                "voice": voice,
                "params": params or {},
                "created": time.time(),
                "size": file_size,
                "duration": duration
            }
            
            self.index["stats"]["total_fixtures"] += 1
            self.index["stats"]["total_size"] += file_size
            
            self._save_index()
            
            print(f"Recorded fixture: {text[:50]}... -> {fixture_key}")
            return fixture_key
            
        except Exception as e:
            print(f"Warning: Failed to record fixture: {e}")
            return ""
    
    def replay(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> Optional[bytes]:
        """
        回放fixture
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            音频数据，如果不存在则返回None
        """
        fixture_key = self._generate_fixture_key(text, voice, params)
        
        if fixture_key not in self.index["fixtures"]:
            return None
        
        fixture_file = self._get_fixture_file_path(fixture_key)
        
        if not fixture_file.exists():
            print(f"Warning: Fixture file not found: {fixture_file}")
            return None
        
        try:
            with open(fixture_file, 'rb') as f:
                return f.read()
        except Exception as e:
            print(f"Warning: Failed to read fixture file {fixture_file}: {e}")
            return None
    
    def exists(self, text: str, voice: str = "default", params: Optional[Dict] = None) -> bool:
        """
        检查fixture是否存在
        
        Args:
            text: 要合成的文本
            voice: 音色参数
            params: 其他参数
            
        Returns:
            是否存在fixture
        """
        fixture_key = self._generate_fixture_key(text, voice, params)
        return fixture_key in self.index["fixtures"]
    
    def list_fixtures(self) -> List[Dict[str, Any]]:
        """列出所有fixtures"""
        fixtures = []
        for fixture_key, fixture_info in self.index["fixtures"].items():
            fixtures.append({
                "key": fixture_key,
                "text": fixture_info["text"],
                "voice": fixture_info["voice"],
                "duration": fixture_info["duration"],
                "size": fixture_info["size"],
                "created": fixture_info["created"]
            })
        
        return sorted(fixtures, key=lambda x: x["created"], reverse=True)
    
    def get_stats(self) -> Dict[str, Any]:
        """获取fixtures统计信息"""
        stats = self.index["stats"].copy()
        size_mb = stats["total_size"] / (1024 * 1024)
        
        return {
            "total_fixtures": stats["total_fixtures"],
            "total_size_mb": round(size_mb, 2)
        }
    
    def cleanup_missing_files(self):
        """清理索引中但文件不存在的条目"""
        keys_to_remove = []
        
        for fixture_key in self.index["fixtures"]:
            fixture_file = self._get_fixture_file_path(fixture_key)
            if not fixture_file.exists():
                keys_to_remove.append(fixture_key)
        
        for key in keys_to_remove:
            fixture_info = self.index["fixtures"][key]
            self.index["stats"]["total_fixtures"] -= 1
            self.index["stats"]["total_size"] -= fixture_info["size"]
            del self.index["fixtures"][key]
        
        if keys_to_remove:
            self._save_index()
            print(f"Cleaned up {len(keys_to_remove)} missing fixture entries")


# 全局实例
_fixture_manager = None

def get_fixture_manager() -> FixtureManager:
    """获取全局fixture管理器实例"""
    global _fixture_manager
    if _fixture_manager is None:
        _fixture_manager = FixtureManager()
    return _fixture_manager


def record(text: str, audio_data: bytes, voice: str = "default", 
           params: Optional[Dict] = None, duration: float = 0.0) -> str:
    """录制fixture的便捷函数"""
    return get_fixture_manager().record(text, audio_data, voice, params, duration)


def replay(text: str, voice: str = "default", params: Optional[Dict] = None) -> Optional[bytes]:
    """回放fixture的便捷函数"""
    return get_fixture_manager().replay(text, voice, params)