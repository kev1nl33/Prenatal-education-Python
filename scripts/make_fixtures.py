#!/usr/bin/env python3
"""
生成TTS fixtures的脚本

用法:
    python scripts/make_fixtures.py
    
功能:
1. 从预设的中文短句生成TTS音频
2. 将音频保存到 services/fixtures/ 目录
3. 生成索引文件便于查找
"""

import os
import sys
import time
import wave
import struct
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from services.fixtures import get_fixture_manager


# 预设的中文短句（5-10秒）
SAMPLE_TEXTS = [
    "欢迎来到胎教音乐世界，让我们一起感受美妙的旋律。",
    "宝宝，妈妈爱你，希望你健康快乐地成长。",
    "轻柔的音乐可以帮助宝宝放松，促进大脑发育。",
    "今天是美好的一天，阳光温暖，微风轻拂。",
    "小鸟在枝头歌唱，花儿在阳光下绽放，世界多么美好。"
]

# 音色配置
VOICE_CONFIGS = [
    {"voice": "zh_female_qingxin", "name": "清新女声"},
    {"voice": "zh_female_wennuan", "name": "温暖女声"},
    {"voice": "zh_male_qinqie", "name": "亲切男声"}
]


def generate_placeholder_audio(text: str, duration: float = 3.0, sample_rate: int = 16000) -> bytes:
    """
    生成占位音频（简单的正弦波）
    
    Args:
        text: 文本内容（用于计算时长）
        duration: 音频时长（秒）
        sample_rate: 采样率
        
    Returns:
        WAV格式的音频数据
    """
    # 根据文本长度调整时长
    char_count = len(text)
    estimated_duration = max(2.0, min(8.0, char_count * 0.15))  # 每字符约0.15秒
    
    if duration <= 0:
        duration = estimated_duration
    
    # 生成正弦波音频
    frequency = 440.0  # A4音符
    frames = int(duration * sample_rate)
    
    audio_data = []
    for i in range(frames):
        # 生成正弦波，添加淡入淡出效果
        t = i / sample_rate
        amplitude = 0.3
        
        # 淡入淡出
        fade_duration = 0.1
        if t < fade_duration:
            amplitude *= t / fade_duration
        elif t > duration - fade_duration:
            amplitude *= (duration - t) / fade_duration
        
        # 正弦波
        sample = amplitude * (0.5 * (1 + 0.5 * (t * 2)))  # 轻微的频率变化
        sample *= 32767  # 转换为16位整数范围
        audio_data.append(int(sample))
    
    # 创建WAV文件
    import io
    wav_buffer = io.BytesIO()
    
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(sample_rate)
        
        # 写入音频数据
        for sample in audio_data:
            wav_file.writeframes(struct.pack('<h', sample))
    
    return wav_buffer.getvalue()


def generate_silence_audio(duration: float = 1.0, sample_rate: int = 16000) -> bytes:
    """
    生成静音音频
    
    Args:
        duration: 音频时长（秒）
        sample_rate: 采样率
        
    Returns:
        WAV格式的静音音频数据
    """
    frames = int(duration * sample_rate)
    
    import io
    wav_buffer = io.BytesIO()
    
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(1)  # 单声道
        wav_file.setsampwidth(2)  # 16位
        wav_file.setframerate(sample_rate)
        
        # 写入静音数据
        silence_data = b'\x00\x00' * frames
        wav_file.writeframes(silence_data)
    
    return wav_buffer.getvalue()


def main():
    """主函数"""
    print("开始生成TTS fixtures...")
    
    fixture_manager = get_fixture_manager()
    
    generated_count = 0
    
    # 为每个文本和音色组合生成fixture
    for text in SAMPLE_TEXTS:
        for voice_config in VOICE_CONFIGS:
            voice = voice_config["voice"]
            voice_name = voice_config["name"]
            
            # 检查是否已存在
            if fixture_manager.exists(text, voice):
                print(f"跳过已存在的fixture: {text[:20]}... ({voice_name})")
                continue
            
            print(f"生成fixture: {text[:30]}... ({voice_name})")
            
            # 生成占位音频
            audio_data = generate_placeholder_audio(text)
            duration = len(text) * 0.15  # 估算时长
            
            # 录制fixture
            fixture_key = fixture_manager.record(
                text=text,
                audio_data=audio_data,
                voice=voice,
                duration=duration
            )
            
            if fixture_key:
                generated_count += 1
                print(f"  ✓ 生成成功: {fixture_key}")
            else:
                print(f"  ✗ 生成失败")
            
            # 短暂延迟
            time.sleep(0.1)
    
    # 生成一些通用的占位音频
    print("\n生成通用占位音频...")
    
    generic_samples = [
        {"text": "占位音频", "duration": 1.0},
        {"text": "测试音频", "duration": 2.0},
        {"text": "默认音频", "duration": 3.0}
    ]
    
    for sample in generic_samples:
        text = sample["text"]
        duration = sample["duration"]
        
        if not fixture_manager.exists(text, "default"):
            if duration < 2.0:
                audio_data = generate_silence_audio(duration)
            else:
                audio_data = generate_placeholder_audio(text, duration)
            
            fixture_key = fixture_manager.record(
                text=text,
                audio_data=audio_data,
                voice="default",
                duration=duration
            )
            
            if fixture_key:
                generated_count += 1
                print(f"  ✓ 生成通用音频: {text} ({duration}s)")
    
    # 显示统计信息
    stats = fixture_manager.get_stats()
    fixtures = fixture_manager.list_fixtures()
    
    print(f"\n=== 生成完成 ===")
    print(f"本次生成: {generated_count} 个fixtures")
    print(f"总计fixtures: {stats['total_fixtures']} 个")
    print(f"总大小: {stats['total_size_mb']} MB")
    
    print(f"\n=== Fixtures列表 ===")
    for fixture in fixtures[:10]:  # 只显示前10个
        print(f"- {fixture['text'][:40]}... ({fixture['voice']}) - {fixture['duration']:.1f}s")
    
    if len(fixtures) > 10:
        print(f"... 还有 {len(fixtures) - 10} 个fixtures")
    
    print(f"\nFixtures保存在: {fixture_manager.fixtures_dir}")
    print("可以通过 services.fixtures.replay() 函数使用这些fixtures")


if __name__ == "__main__":
    main()