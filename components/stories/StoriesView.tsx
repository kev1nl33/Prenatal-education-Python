'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePlayer } from '@/components/providers/PlayerProvider';
import { useBabyProfile, AGE_GROUPS } from '@/components/providers/BabyProfileProvider';

const STORIES = [
  {
    id: 'library-bear-colors',
    title: '小熊学颜色',
    summary: '小熊宝宝和妈妈一起认识五彩缤纷的世界。',
    tag: '认知启蒙',
    duration: '08′30″',
    cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'library-bunny-sleep',
    title: '小兔子的晚安曲',
    summary: '月亮升起来了，小兔子听着妈妈的歌声甜甜入睡。',
    tag: '睡前故事',
    duration: '10′15″',
    cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'library-duck-count',
    title: '小鸭子数数歌',
    summary: '一只小鸭子，两只小鸭子，跟着节奏一起数。',
    tag: '儿歌童谣',
    duration: '05′42″',
    cover: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'library-touch-explore',
    title: '小手摸一摸',
    summary: '软软的、硬硬的、滑滑的，用小手感受不同的触感。',
    tag: '感官探索',
    duration: '07′18″',
    cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'library-star-lullaby',
    title: '星星的摇篮曲',
    summary: '星星们也要睡觉了，妈妈轻声哼唱，宝宝闭上眼睛。',
    tag: '睡前故事',
    duration: '09′20″',
    cover: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'library-cat-meow',
    title: '小猫咪说你好',
    summary: '小猫咪走遍了整个村庄，用喵喵声和每个朋友打招呼。',
    tag: '亲子互动',
    duration: '06′00″',
    cover: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
  },
];

const HIGHLIGHT = {
  id: 'featured-bear-adventure',
  title: '小熊的彩虹冒险',
  summary: '小熊宝宝跟着蝴蝶出发，发现了一道美丽的彩虹，每种颜色都藏着一个小惊喜。',
  duration: '08′45″',
  cover: 'https://images.unsplash.com/photo-1527628173875-3c7bfd28ad72?auto=format&fit=crop&w=800&q=80',
};

const RIVERS = [
  { tag: '睡前故事', icon: '🌙' },
  { tag: '儿歌童谣', icon: '🎵' },
  { tag: '认知启蒙', icon: '🧩' },
  { tag: '感官探索', icon: '✨' },
  { tag: '亲子互动', icon: '🤝' },
];

function getContextTime(): string {
  const h = new Date().getHours();
  if (h < 6)  return '深夜 · 宝宝睡得香吗？';
  if (h < 12) return `早上 ${h}:${String(new Date().getMinutes()).padStart(2,'0')} · 适合认知启蒙`;
  if (h < 14) return `午间 · 听段轻柔儿歌`;
  if (h < 18) return `下午 ${h}:${String(new Date().getMinutes()).padStart(2,'0')} · 亲子互动好时光`;
  return `晚上 ${h}:${String(new Date().getMinutes()).padStart(2,'0')} · 适合睡前故事`;
}

export function StoriesView() {
  const { upsertStory } = usePlayer();
  const { ageGroup, setAgeGroup } = useBabyProfile();
  const [showAgePanel, setShowAgePanel] = useState(false);

  // 注册静态故事到 player registry
  useEffect(() => {
    STORIES.forEach(story => {
      upsertStory({
        id: story.id, title: story.title, summary: story.summary,
        cover: story.cover, type: 'bedtime-story', createdAt: Date.now(),
      });
    });
    upsertStory({
      id: HIGHLIGHT.id, title: HIGHLIGHT.title, summary: HIGHLIGHT.summary,
      cover: HIGHLIGHT.cover, type: 'bedtime-story', createdAt: Date.now(),
    });
  }, [upsertStory]);

  const ageLabel = AGE_GROUPS.find(g => g.value === ageGroup)?.label || ageGroup;
  const contextTime = useMemo(() => getContextTime(), []);

  return (
    <main className="explore-page">

      {/* 上下文感知条 */}
      <div className="explore-context-bar">
        <div className="explore-context-left">
          <span className="explore-context-age">👶 {ageLabel}</span>
          <span className="explore-context-time">{contextTime}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="explore-context-change"
            onClick={() => setShowAgePanel(v => !v)}
          >
            更换月龄
          </button>
          {showAgePanel && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                onClick={() => setShowAgePanel(false)}
              />
              <div className="gem-popup" style={{ right: 0, left: 'auto', transform: 'none', top: 'calc(100% + 6px)' }}>
                {AGE_GROUPS.map(g => (
                  <button
                    key={g.value}
                    type="button"
                    className={`gem-option${g.value === ageGroup ? ' option-active' : ''}`}
                    onClick={() => { setAgeGroup(g.value); setShowAgePanel(false); }}
                  >
                    <span className="gem-option-icon">👶</span>
                    <span className="gem-option-label">{g.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 今日精推大卡 */}
      <Link href={`/player/${HIGHLIGHT.id}`} className="explore-hero-card">
        <img src={HIGHLIGHT.cover} alt={HIGHLIGHT.title} className="explore-hero-img" />
        <div className="explore-hero-overlay">
          <span className="explore-hero-badge">✦ 今日精推</span>
          <h2 className="explore-hero-title">{HIGHLIGHT.title}</h2>
          <div className="explore-hero-meta">
            <span className="explore-hero-duration">🕐 {HIGHLIGHT.duration}</span>
            <div className="explore-hero-play">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </Link>

      {/* 按类型的横向河流 */}
      {RIVERS.map(river => {
        const items = STORIES.filter(s => s.tag === river.tag);
        if (!items.length) return null;
        return (
          <div key={river.tag} className="explore-river">
            <div className="explore-river-header">
              <span style={{ fontSize: 16 }}>{river.icon}</span>
              <span className="explore-river-title">{river.tag}</span>
            </div>
            <div className="explore-river-scroll">
              {items.map(story => (
                <Link key={story.id} href={`/player/${story.id}`} className="explore-card">
                  <img src={story.cover} alt={story.title} className="explore-card-img" />
                  <div className="explore-card-body">
                    <span className="explore-card-tag">{story.tag}</span>
                    <span className="explore-card-title">{story.title}</span>
                    <span className="explore-card-duration">🕐 {story.duration}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })}

      {/* 生成新内容入口 */}
      <div style={{ padding: '24px 16px 0', textAlign: 'center' }}>
        <Link href="/home" className="btn btn-primary" style={{ display: 'inline-flex', gap: 8 }}>
          ✨ 定制专属内容
        </Link>
      </div>
    </main>
  );
}
