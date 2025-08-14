from abc import ABC, abstractmethod
from typing import Optional, Dict, Any


class SpeechSynthesizer(ABC):
    """语音合成抽象基类"""
    
    @abstractmethod
    def synthesize(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> bytes:
        """
        合成语音
        
        Args:
            text: 要合成的文本
            voice_type: 音色类型
            quality: 音质 (draft/high)
            **kwargs: 其他参数
            
        Returns:
            音频数据字节流
        """
        pass
    
    @abstractmethod
    def estimate_cost(self, text: str, voice_type: str = "default", quality: str = "draft", **kwargs) -> float:
        """
        估算费用
        
        Args:
            text: 要合成的文本
            voice_type: 音色类型
            quality: 音质
            **kwargs: 其他参数
            
        Returns:
            估算费用（元）
        """
        pass
    
    @abstractmethod
    def get_provider_name(self) -> str:
        """
        获取提供商名称
        
        Returns:
            提供商名称
        """
        pass
    
    def validate_text(self, text: str) -> bool:
        """
        验证文本是否合法
        
        Args:
            text: 要验证的文本
            
        Returns:
            是否合法
        """
        if not text or not text.strip():
            return False
        if len(text) > 10000:  # 限制最大长度
            return False
        return True