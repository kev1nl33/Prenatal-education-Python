import os
import time
import random
from typing import Dict, Any, List
from .base import SpeechSynthesizer
from .local_adapter import LocalSpeechAdapter


class SandboxSpeechAdapter(SpeechSynthesizer):
    """沙箱环境语音合成适配器（DRY_RUN模式）"""
    
    def __init__(self):
        self.local_adapter = LocalSpeechAdapter()
        # 从环境变量读取价格配置
        self.price_per_1k_char = float(os.environ.get('TTS_PRICE_PER_1K_CHAR', '0.02'))  # 默认每1000字符0.02元
        self.high_quality_multiplier = float(os.environ.get('TTS_HIGH_QUALITY_MULTIPLIER', '2.0'))  # 高质量倍数
    
    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> bytes:
        """合成语音（沙箱模式返回本地占位音频）"""
        if not self.validate_text(text):
            raise ValueError("Invalid text input")
        
        # 模拟网络延迟
        delay = random.uniform(0.5, 2.0)  # 0.5-2秒随机延迟
        time.sleep(delay)
        
        # 模拟偶发错误（5%概率）
        if random.random() < 0.05:
            error_types = [
                (429, "Rate limit exceeded"),
                (500, "Internal server error"),
                (503, "Service temporarily unavailable")
            ]
            error_code, error_msg = random.choice(error_types)
            raise Exception(f"Simulated error {error_code}: {error_msg}")
        
        # 返回本地占位音频
        return self.local_adapter.synthesize(text, voice_type, quality, **kwargs)
    
    def estimate_cost(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> float:
        """估算费用"""
        if not text:
            return 0.0
        
        # 按字符数计费
        char_count = len(text)
        base_cost = (char_count / 1000.0) * self.price_per_1k_char
        
        # 高质量音频加价
        if quality == "high":
            base_cost *= self.high_quality_multiplier
        
        # 不同音色可能有不同价格（这里简化处理）
        voice_multiplier = {
            "premium": 1.5,
            "standard": 1.0,
            "basic": 0.8
        }.get(voice_type, 1.0)
        
        return round(base_cost * voice_multiplier, 4)
    
    def get_provider_name(self) -> str:
        """获取提供商名称"""
        return "sandbox"
    
    def dry_run_estimate(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> dict:
        """DRY_RUN模式：仅返回估算信息，不实际调用"""
        cost = self.estimate_cost(text, voice_type, quality, **kwargs)
        estimated_duration = len(text) * 0.1  # 估算音频时长（秒）
        
        return {
            "success": True,
            "cost": cost,
            "estimated_duration": round(estimated_duration, 2),
            "char_count": len(text),
            "voice_type": voice_type,
            "quality": quality,
            "provider": self.get_provider_name(),
            "dry_run": True,
            "message": "This is a dry run estimate. No actual synthesis was performed."
        }
    
    def voice_clone(self, speaker_id: str, audio_data: bytes, audio_format: str = "wav", 
                   language: str = "zh", model_type: int = 1, **kwargs) -> Dict[str, Any]:
        """声音复刻（沙箱模式模拟）"""
        # 模拟网络延迟
        delay = random.uniform(0.5, 1.5)
        time.sleep(delay)
        
        # 模拟偶发错误（10%概率）
        if random.random() < 0.1:
            error_types = [
                "Audio quality too low",
                "Unsupported audio format",
                "Speaker ID already exists"
            ]
            error_msg = random.choice(error_types)
            return {
                "success": False,
                "error": f"Simulated error: {error_msg}"
            }
        
        # 模拟成功响应
        task_id = f"sandbox_task_{int(time.time() * 1000)}"
        return {
            "success": True,
            "speaker_id": speaker_id,
            "task_id": task_id,
            "status": "submitted",
            "message": "Voice cloning task submitted successfully (sandbox mode)",
            "estimated_duration": random.randint(300, 1800)  # 5-30分钟
        }
    
    def get_voice_clone_status(self, speaker_id: str, **kwargs) -> Dict[str, Any]:
        """查询声音复刻状态（沙箱模式模拟）"""
        # 模拟网络延迟
        delay = random.uniform(0.2, 0.8)
        time.sleep(delay)
        
        # 模拟不同的训练状态
        status_options = [
            {"status": "training", "progress": random.randint(10, 90), "message": "Voice cloning in progress"},
            {"status": "completed", "progress": 100, "message": "Voice cloning completed successfully"},
            {"status": "failed", "progress": 0, "message": "Voice cloning failed due to insufficient audio quality"}
        ]
        
        # 根据speaker_id的哈希值选择状态，保持一致性
        status_index = hash(speaker_id) % len(status_options)
        selected_status = status_options[status_index]
        
        return {
            "success": True,
            "speaker_id": speaker_id,
            "status": selected_status["status"],
            "progress": selected_status["progress"],
            "message": selected_status["message"],
            "sandbox_mode": True
        }
    
    def list_cloned_voices(self, **kwargs) -> List[Dict[str, Any]]:
        """获取已复刻的声音列表（沙箱模式模拟）"""
        # 模拟网络延迟
        delay = random.uniform(0.3, 1.0)
        time.sleep(delay)
        
        # 返回模拟的声音列表
        return [
            {
                "speaker_id": "sandbox_speaker_1",
                "name": "沙箱测试声音1",
                "status": "completed",
                "created_at": "2024-01-01T10:00:00Z",
                "language": "zh",
                "model_type": 1,
                "sandbox_mode": True
            },
            {
                "speaker_id": "sandbox_speaker_2",
                "name": "沙箱测试声音2",
                "status": "training",
                "created_at": "2024-01-02T14:30:00Z",
                "language": "zh",
                "model_type": 2,
                "sandbox_mode": True
            },
            {
                "speaker_id": "sandbox_speaker_3",
                "name": "沙箱测试声音3",
                "status": "failed",
                "created_at": "2024-01-03T09:15:00Z",
                "language": "en",
                "model_type": 1,
                "sandbox_mode": True
            }
        ]