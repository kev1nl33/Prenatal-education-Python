import os
import json
import hashlib
import struct
import wave
import io
from typing import Dict, Any
from .base import SpeechSynthesizer


class LocalSpeechAdapter(SpeechSynthesizer):
    """本地/开发环境语音合成适配器"""
    
    def __init__(self):
        self.fixtures_dir = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
        self.cache_dir = os.path.join('/tmp', 'tts') if os.path.exists('/tmp') else os.path.join('.', '.cache', 'tts')
        os.makedirs(self.cache_dir, exist_ok=True)
        os.makedirs(self.fixtures_dir, exist_ok=True)
        
        # 加载fixtures索引
        self.fixtures_index = self._load_fixtures_index()
    
    def _load_fixtures_index(self) -> Dict[str, str]:
        """加载fixtures索引文件"""
        index_file = os.path.join(self.fixtures_dir, 'index.json')
        if os.path.exists(index_file):
            try:
                with open(index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {}
    
    def _get_cache_key(self, text: str, voice_type: str, quality: str) -> str:
        """生成缓存键"""
        content = f"{text}|{voice_type}|{quality}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _generate_placeholder_audio(self, text: str, duration_seconds: float = 0.5) -> bytes:
        """生成占位音频（静音或简单哔声）"""
        sample_rate = 22050
        channels = 1
        sample_width = 2  # 16-bit
        
        # 计算样本数
        num_samples = int(sample_rate * duration_seconds)
        
        # 生成简单的哔声（440Hz正弦波，持续0.1秒，然后静音）
        beep_samples = int(sample_rate * 0.1)
        samples = []
        
        # 哔声部分
        for i in range(min(beep_samples, num_samples)):
            # 440Hz正弦波
            value = int(16384 * 0.3 * (1 if i < beep_samples // 10 else 0))  # 短促哔声
            samples.append(value)
        
        # 静音部分
        for i in range(num_samples - len(samples)):
            samples.append(0)
        
        # 转换为字节
        audio_data = b''.join(struct.pack('<h', sample) for sample in samples)
        
        # 创建WAV文件
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            wav_file.setnchannels(channels)
            wav_file.setsampwidth(sample_width)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(audio_data)
        
        return wav_buffer.getvalue()
    
    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> bytes:
        """合成语音"""
        if not self.validate_text(text):
            raise ValueError("Invalid text input")
        
        cache_key = self._get_cache_key(text, voice_type, quality)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.wav")
        
        # 检查缓存
        if os.path.exists(cache_file):
            with open(cache_file, 'rb') as f:
                return f.read()
        
        # 检查fixtures
        if cache_key in self.fixtures_index:
            fixture_file = os.path.join(self.fixtures_dir, self.fixtures_index[cache_key])
            if os.path.exists(fixture_file):
                with open(fixture_file, 'rb') as f:
                    audio_data = f.read()
                    # 写入缓存
                    with open(cache_file, 'wb') as cache_f:
                        cache_f.write(audio_data)
                    return audio_data
        
        # 生成占位音频
        duration = min(len(text) * 0.1, 5.0)  # 根据文本长度估算时长，最多5秒
        audio_data = self._generate_placeholder_audio(text, duration)
        
        # 写入缓存
        with open(cache_file, 'wb') as f:
            f.write(audio_data)
        
        return audio_data
    
    def estimate_cost(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> float:
        """估算费用（本地模式固定返回0）"""
        return 0.0
    
    def get_provider_name(self) -> str:
        """获取提供商名称"""
        return "local"