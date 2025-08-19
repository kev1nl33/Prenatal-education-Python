from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List


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
    
    @abstractmethod
    def voice_clone(self, speaker_id: str, audio_data: bytes, audio_format: str = "wav", 
                   language: str = "zh", model_type: int = 1, **kwargs) -> Dict[str, Any]:
        """
        声音复刻
        
        Args:
            speaker_id: 说话人ID
            audio_data: 音频数据
            audio_format: 音频格式 (wav, mp3等)
            language: 语言 (zh, en等)
            model_type: 模型类型 (1=ICL, 2=DiT标准版, 3=DiT还原版)
            **kwargs: 其他参数
            
        Returns:
            包含任务ID和状态的字典
        """
        pass
    
    @abstractmethod
    def get_voice_clone_status(self, speaker_id: str, **kwargs) -> Dict[str, Any]:
        """
        查询声音复刻状态
        
        Args:
            speaker_id: 说话人ID
            **kwargs: 其他参数
            
        Returns:
            包含训练状态和进度的字典
        """
        pass
    
    @abstractmethod
    def list_cloned_voices(self, **kwargs) -> List[Dict[str, Any]]:
        """
        获取已复刻的声音列表
        
        Args:
            **kwargs: 其他参数
            
        Returns:
            已复刻声音的列表
        """
        pass