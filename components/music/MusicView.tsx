'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { useBabyProfile } from '@/components/providers/BabyProfileProvider';
import { usePlayer } from '@/components/providers/PlayerProvider';
import { AgeSelector } from '@/components/common/AgeSelector';
import {
  MUSIC_LIBRARY,
  MUSIC_CATEGORIES,
  filterByAge,
  filterByCategory,
  type MusicTrack
} from '@/lib/music';

export function MusicView() {
  const { ageGroup, setAgeGroup } = useBabyProfile();
  const { setAudioUrl, upsertStory, setCurrentStoryById, isPlaying, play, pause } = usePlayer();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const filteredTracks = useMemo(() => {
    let tracks = filterByAge(MUSIC_LIBRARY, ageGroup);
    tracks = filterByCategory(tracks, activeCategory);
    return tracks;
  }, [ageGroup, activeCategory]);

  const handlePlayTrack = (track: MusicTrack) => {
    upsertStory({
      id: track.id,
      title: `${track.title} - ${track.composer}`,
      summary: `${track.composer}《${track.title}》`,
      type: 'music',
      createdAt: Date.now()
    });
    setCurrentStoryById(track.id);
    setAudioUrl(track.audioUrl, track.id);
    setPlayingTrackId(track.id);
    setTimeout(() => play(), 100);
  };

  const handleTogglePlay = (track: MusicTrack) => {
    if (playingTrackId === track.id && isPlaying) {
      pause();
    } else if (playingTrackId === track.id) {
      play();
    } else {
      handlePlayTrack(track);
    }
  };

  const MOOD_LABELS: Record<string, string> = {
    sleep: '🌙 助眠',
    calm: '🌿 舒缓',
    happy: '☀️ 欢快',
  };

  return (
    <main className="library-section music-section">

      {/* Header */}
      <div className="library-header">
        <span className="section-pill">🎵 古典音乐</span>
        <div className="library-heading">
          <h2>古典音乐陪伴</h2>
          <p>精选公有领域古典名曲，用音乐滋养宝宝的听觉发展。</p>
        </div>
      </div>

      <AgeSelector value={ageGroup} onChange={setAgeGroup} />

      {/* 分类 */}
      <div className="library-category-grid">
        <button
          type="button"
          className={clsx('library-category-card', { active: activeCategory === 'all' })}
          onClick={() => setActiveCategory('all')}
        >
          <div className="category-icon">🎼</div>
          <div className="category-text"><h3>全部</h3></div>
        </button>
        {MUSIC_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            type="button"
            className={clsx('library-category-card', { active: activeCategory === cat.key })}
            onClick={() => setActiveCategory(cat.key)}
          >
            <div className="category-icon">{cat.icon}</div>
            <div className="category-text"><h3>{cat.label}</h3></div>
          </button>
        ))}
      </div>

      {/* 曲目列表 */}
      <div className="library-story-grid">
        {filteredTracks.length === 0 && (
          <div className="music-empty">
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎵</div>
            <p>当前月龄和分类下暂无曲目，试试切换筛选条件。</p>
          </div>
        )}
        {filteredTracks.map((track) => {
          const isCurrentTrack = playingTrackId === track.id;
          const isCurrentPlaying = isCurrentTrack && isPlaying;
          return (
            <article
              key={track.id}
              className={clsx('library-story-card music-card', { playing: isCurrentPlaying })}
            >
              <div className="story-body">
                <div className="story-meta">
                  <span className="story-tag">{track.composer}</span>
                  <span className="story-duration">🕐 {track.duration}</span>
                </div>
                <h3>{track.title}</h3>
                <p>{MOOD_LABELS[track.mood] || track.mood}</p>
                <button
                  type="button"
                  className="story-play"
                  aria-label={`${isCurrentPlaying ? '暂停' : '播放'}${track.title}`}
                  onClick={() => handleTogglePlay(track)}
                >
                  <span>{isCurrentPlaying ? '⏸' : '▶'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
