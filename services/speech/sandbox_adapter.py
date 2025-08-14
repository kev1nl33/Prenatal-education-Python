import os
import time
import random
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