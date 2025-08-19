import os
import json
import hashlib
import struct
import wave
import io
import time
from typing import Dict, Any, List
from .base import SpeechSynthesizer


class LocalSpeechAdapter(SpeechSynthesizer):
    """本地/开发环境语音合成适配器"""
    
    def __init__(self):
        self.fixtures_dir = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
        
        # 安全选择缓存目录，优先 /tmp
        cache_candidates = [
            os.path.join('/tmp', 'tts'),
            os.path.join('.', '.cache', 'tts')
        ]
        chosen_cache = None
        for cache_path in cache_candidates:
            try:
                os.makedirs(cache_path, exist_ok=True)
                if os.access(cache_path, os.W_OK):
                    chosen_cache = cache_path
                    break
            except Exception:
                continue
        
        self.cache_dir = chosen_cache or os.path.join('.', '.cache', 'tts')
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
    
    def voice_clone(self, speaker_id: str, audio_data: bytes, audio_format: str = "wav", 
                   language: str = "zh", model_type: int = 1, **kwargs) -> Dict[str, Any]:
        """声音复刻（本地模式占位符实现）"""
        # 本地模式直接返回成功，不进行实际的声音复刻
        task_id = f"local_task_{int(time.time() * 1000)}"
        
        # 可以选择将音频数据保存到本地用于调试
        if kwargs.get("save_audio", False):
            audio_dir = os.path.join(self.cache_dir, "voice_clones")
            os.makedirs(audio_dir, exist_ok=True)
            audio_file = os.path.join(audio_dir, f"{speaker_id}.{audio_format}")
            try:
                with open(audio_file, 'wb') as f:
                    f.write(audio_data)
                print(f"[LOCAL DEBUG] Audio saved to: {audio_file}")
            except Exception as e:
                print(f"[LOCAL DEBUG] Failed to save audio: {e}")
        
        return {
            "success": True,
            "speaker_id": speaker_id,
            "task_id": task_id,
            "status": "completed",  # 本地模式直接标记为完成
            "message": "Voice cloning completed (local mode - placeholder implementation)",
            "local_mode": True
        }
    
    def get_voice_clone_status(self, speaker_id: str, **kwargs) -> Dict[str, Any]:
        """查询声音复刻状态（本地模式占位符实现）"""
        # 本地模式总是返回已完成状态
        return {
            "success": True,
            "speaker_id": speaker_id,
            "status": "completed",
            "progress": 100,
            "message": "Voice cloning completed (local mode)",
            "local_mode": True
        }
    
    def list_cloned_voices(self, **kwargs) -> List[Dict[str, Any]]:
        """获取已复刻的声音列表（本地模式占位符实现）"""
        # 检查本地是否有保存的声音文件
        voices = []
        audio_dir = os.path.join(self.cache_dir, "voice_clones")
        
        if os.path.exists(audio_dir):
            try:
                for filename in os.listdir(audio_dir):
                    if filename.endswith(('.wav', '.mp3', '.m4a')):
                        speaker_id = os.path.splitext(filename)[0]
                        file_path = os.path.join(audio_dir, filename)
                        stat = os.stat(file_path)
                        
                        voices.append({
                            "speaker_id": speaker_id,
                            "name": f"本地声音 - {speaker_id}",
                            "status": "completed",
                            "created_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(stat.st_ctime)),
                            "language": "zh",
                            "model_type": 1,
                            "local_mode": True,
                            "file_path": file_path
                        })
            except Exception as e:
                print(f"[LOCAL DEBUG] Error listing voice clones: {e}")
        
        # 如果没有本地文件，返回默认的演示声音
        if not voices:
            voices = [
                {
                    "speaker_id": "local_demo_1",
                    "name": "本地演示声音1",
                    "status": "completed",
                    "created_at": "2024-01-01T00:00:00Z",
                    "language": "zh",
                    "model_type": 1,
                    "local_mode": True
                },
                {
                    "speaker_id": "local_demo_2",
                    "name": "本地演示声音2",
                    "status": "completed",
                    "created_at": "2024-01-02T00:00:00Z",
                    "language": "en",
                    "model_type": 2,
                    "local_mode": True
                }
            ]
        
        return voices