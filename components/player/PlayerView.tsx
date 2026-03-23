'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { usePlayer } from '@/components/providers/PlayerProvider';

interface PlayerViewProps {
  storyId: string;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// 根据内容类型返回默认封面渐变
const TYPE_GRADIENTS: Record<string, string> = {
  'bedtime-story': 'linear-gradient(135deg, #1a1040 0%, #2d1b69 50%, #0a0e27 100%)',
  'nursery-rhyme': 'linear-gradient(135deg, #1a0a2e 0%, #6b2fa0 50%, #0a0e27 100%)',
  'cognitive':     'linear-gradient(135deg, #0a1a2e 0%, #1a5276 50%, #0a0e27 100%)',
  'language':      'linear-gradient(135deg, #1a0a1e 0%, #7b2d8b 50%, #0a0e27 100%)',
  'sensory':       'linear-gradient(135deg, #1a1a0a 0%, #7d6608 50%, #0a0e27 100%)',
  'parent-child':  'linear-gradient(135deg, #0a1a0a 0%, #1a5276 50%, #0a0e27 100%)',
  'music':         'linear-gradient(135deg, #1a0a0a 0%, #7b241c 50%, #0a0e27 100%)',
};

const TYPE_ICONS: Record<string, string> = {
  'bedtime-story': '🌙',
  'nursery-rhyme': '🎵',
  'cognitive':     '🧩',
  'language':      '💬',
  'sensory':       '✨',
  'parent-child':  '🤝',
  'music':         '🎼',
};

export function PlayerView({ storyId }: PlayerViewProps) {
  const {
    stories,
    currentStory,
    setCurrentStoryById,
    audioRef,
    audioUrl,
    play,
    pause,
    isPlaying,
    hasPlaylist,
    currentSegmentIndex,
  } = usePlayer();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const story = useMemo(() => {
    if (currentStory && currentStory.id === storyId) return currentStory;
    return stories.find((item) => item.id === storyId);
  }, [storyId, stories, currentStory]);

  useEffect(() => {
    setCurrentStoryById(storyId);
  }, [storyId, setCurrentStoryById]);

  // 监听 audio 时间更新
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime     = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
    const onDuration = () => setDuration(audio.duration || 0);
    const onLoaded   = () => setDuration(audio.duration || 0);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDuration);
    audio.addEventListener('loadedmetadata', onLoaded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDuration);
      audio.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [audioRef, isDragging]);

  // 进度条点击 / 拖拽
  const seekTo = useCallback((clientX: number) => {
    if (!progressBarRef.current || !audioRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [audioRef, duration]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    seekTo(e.clientX);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [seekTo]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    seekTo(e.clientX);
  }, [isDragging, seekTo]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 跳秒
  const skip = useCallback((seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
  }, [audioRef, currentTime, duration]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const coverGradient = TYPE_GRADIENTS[story?.type || ''] || TYPE_GRADIENTS['bedtime-story'];
  const coverIcon = TYPE_ICONS[story?.type || ''] || '🌙';

  if (!story) {
    return (
      <main className="player-section">
        <div className="player-empty">
          <div style={{ fontSize: '3rem' }}>🌙</div>
          <h3>暂未找到该故事</h3>
          <p>请返回首页生成新的内容或从故事库中选择。</p>
          <Link href="/home" className="btn btn-primary">↩ 返回首页</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="immersive-player">
      {/* 隐藏原生 audio 元素，保持 audioRef 有效 */}
      <audio ref={audioRef} src={audioUrl ?? undefined} style={{ display: 'none' }} />

      {/* 背景光晕 */}
      <div className="player-bg-orb player-bg-orb-1" />
      <div className="player-bg-orb player-bg-orb-2" />

      {/* 顶部返回 */}
      <div className="player-topbar">
        <Link href="/home" className="player-back-btn" aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <span className="player-topbar-title">正在播放</span>
        <div style={{ width: 36 }} />
      </div>

      {/* 封面 */}
      <div className="player-cover-wrap">
        <div
          className={`player-cover-disc ${isPlaying ? 'cover-spinning' : 'cover-paused'}`}
          style={{ background: story.cover ? undefined : coverGradient }}
        >
          {story.cover ? (
            <img src={story.cover} alt={story.title} className="player-cover-img" />
          ) : (
            <span className="player-cover-icon">{coverIcon}</span>
          )}
        </div>
        {/* 播放时光晕 */}
        {isPlaying && <div className="player-aura" />}
      </div>

      {/* 信息 */}
      <div className="player-info-block">
        <div className="player-status-chip">
          {isPlaying ? '🎵 宝宝正在聆听' : '✨ 准备就绪'}
          {hasPlaylist && (
            <span className="player-segment"> · 第 {currentSegmentIndex + 1} 段</span>
          )}
        </div>
        <h2 className="player-title">{story.title || '宝宝的专属内容'}</h2>
        <p className="player-subtitle">{story.summary || '温柔的声音陪伴宝宝快乐成长'}</p>
      </div>

      {/* 进度条 */}
      <div className="player-progress-section">
        <div
          ref={progressBarRef}
          className="progress-track"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-label="播放进度"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="progress-fill" style={{ width: `${progress}%` }}>
            <div className={`progress-thumb ${isPlaying ? 'thumb-pulse' : ''}`} />
          </div>
        </div>
        <div className="progress-times">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="player-controls">
        <button
          type="button"
          className="player-ctrl-btn player-ctrl-skip"
          onClick={() => skip(-15)}
          aria-label="后退15秒"
          disabled={!audioUrl}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a7 7 0 0 0 0 14h4" />
            <polyline points="11 4 7 8 11 12" />
          </svg>
          <span className="skip-label">15</span>
        </button>

        <button
          type="button"
          className={`player-play-btn ${isPlaying ? 'play-btn-active' : ''}`}
          onClick={() => (isPlaying ? pause() : play())}
          disabled={!audioUrl}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className="player-ctrl-btn player-ctrl-skip"
          onClick={() => skip(30)}
          aria-label="快进30秒"
          disabled={!audioUrl}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 4h7a7 7 0 0 1 0 14h-4" />
            <polyline points="13 4 17 8 13 12" />
          </svg>
          <span className="skip-label">30</span>
        </button>
      </div>

      {/* 底部操作 */}
      <div className="player-footer-actions">
        <Link href="/home" className="btn btn-outline btn-sm">✨ 生成新内容</Link>
      </div>
    </main>
  );
}
