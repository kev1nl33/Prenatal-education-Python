import os
from typing import Optional
from .speech.base import SpeechSynthesizer
from .speech.local_adapter import LocalSpeechAdapter
from .speech.sandbox_adapter import SandboxSpeechAdapter
from .speech.prod_adapter import ProductionSpeechAdapter
from .costbook import CostBook
from .cache import TTSCache


def get_speech_service(mode: Optional[str] = None) -> SpeechSynthesizer:
    """
    获取语音合成服务实例
    
    Args:
        mode: 运行模式 ('local', 'sandbox', 'prod')，如果为None则从环境变量读取
        
    Returns:
        语音合成服务实例
        
    Raises:
        ValueError: 当模式不支持时
    """
    if mode is None:
        mode = os.getenv('MODE', 'local').lower()
    
    mode = mode.lower()
    
    if mode == 'local':
        return LocalSpeechAdapter()
    elif mode == 'sandbox':
        return SandboxSpeechAdapter()
    elif mode == 'prod':
        return ProductionSpeechAdapter()
    else:
        raise ValueError(f"Unsupported mode: {mode}. Supported modes: local, sandbox, prod")


def get_current_mode() -> str:
    """获取当前运行模式"""
    return os.getenv('MODE', 'local').lower()


def is_dry_run() -> bool:
    """检查是否为干跑模式"""
    return os.getenv('DRY_RUN', 'false').lower() in ('true', '1', 'yes')


def is_kill_switch_enabled() -> bool:
    """检查是否启用了紧急停止开关"""
    return os.getenv('KILL_SWITCH', 'false').lower() in ('true', '1', 'yes')


def get_daily_cost_limit() -> float:
    """获取每日费用限制"""
    try:
        return float(os.getenv('MAX_DAILY_COST', '10.0'))
    except ValueError:
        return 10.0


def is_replay_mode() -> bool:
    """检查是否为回放模式"""
    return os.getenv('REPLAY', 'false').lower() in ('true', '1', 'yes')


def is_record_mode() -> bool:
    """检查是否为录制模式"""
    return os.getenv('RECORD', 'false').lower() in ('true', '1', 'yes')


def get_cost_book() -> CostBook:
    """获取费用账本实例"""
    return CostBook()


def get_tts_cache() -> TTSCache:
    """获取TTS缓存实例"""
    return TTSCache()