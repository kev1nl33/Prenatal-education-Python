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
        # 检测运行环境，优先使用生产模式
        mode = os.getenv('MODE')
        if mode is None:
            # 根据环境自动检测模式
            if os.getenv('VERCEL') or os.getenv('VERCEL_ENV'):
                # 在 Vercel 环境中，检查是否配置了TTS服务
                # 支持两种配置方式：TTS_API_KEY 或 火山引擎的 TTS_APP_ID+TTS_ACCESS_TOKEN
                tts_api_key = os.getenv('TTS_API_KEY', '')
                tts_app_id = os.getenv('TTS_APP_ID', '')
                tts_access_token = os.getenv('TTS_ACCESS_TOKEN', '')
                
                has_api_key = bool(tts_api_key and tts_api_key != 'your_tts_api_key_here')
                has_volc_config = bool(tts_app_id and tts_access_token and 
                                     tts_app_id != 'your_app_id_here' and 
                                     tts_access_token != 'your_access_token_here')
                
                mode = 'prod' if (has_api_key or has_volc_config) else 'local'
            elif os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('RENDER'):
                mode = 'prod'  # 其他云平台默认使用生产模式
            else:
                mode = 'local'  # 本地开发环境
        mode = mode.lower()
    
    mode = mode.lower()
    
    if mode == 'local':
        return LocalSpeechAdapter()
    elif mode == 'sandbox':
        return SandboxSpeechAdapter()
    elif mode == 'prod':
        try:
            return ProductionSpeechAdapter()
        except ValueError as e:
            # 如果生产模式配置有问题，自动降级到本地模式
            print(f"WARNING: Production TTS config error, falling back to local mode: {e}")
            return LocalSpeechAdapter()
    else:
        raise ValueError(f"Unsupported mode: {mode}. Supported modes: local, sandbox, prod")


def get_current_mode() -> str:
    """获取当前运行模式"""
    mode = os.getenv('MODE')
    if mode is None:
        # 根据环境自动检测模式
        if os.getenv('VERCEL') or os.getenv('VERCEL_ENV'):
            # 在 Vercel 环境中，检查是否配置了TTS服务
            # 支持两种配置方式：TTS_API_KEY 或 火山引擎的 TTS_APP_ID+TTS_ACCESS_TOKEN
            tts_api_key = os.getenv('TTS_API_KEY', '')
            tts_app_id = os.getenv('TTS_APP_ID', '')
            tts_access_token = os.getenv('TTS_ACCESS_TOKEN', '')
            
            has_api_key = bool(tts_api_key and tts_api_key != 'your_tts_api_key_here')
            has_volc_config = bool(tts_app_id and tts_access_token and 
                                 tts_app_id != 'your_app_id_here' and 
                                 tts_access_token != 'your_access_token_here')
            
            mode = 'prod' if (has_api_key or has_volc_config) else 'local'
        elif os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('RENDER'):
            mode = 'prod'  # 其他云平台默认使用生产模式
        else:
            mode = 'local'  # 本地开发环境
    return mode.lower()


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