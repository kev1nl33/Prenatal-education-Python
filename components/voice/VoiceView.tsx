'use client';

import Link from 'next/link';

const STORIES = [
  {
    id: 'library-bear-colors',
    title: '小熊学颜色',
    summary: '小熊宝宝和妈妈一起认识五彩缤纷的世界。',
    tag: '认知启蒙',
    duration: '08′30″',
    cover: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'library-bunny-sleep',
    title: '小兔子的晚安曲',
    summary: '月亮升起来了，小兔子听着妈妈的歌声甜甜入睡。',
    tag: '睡前故事',
    duration: '10′15″',
    cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'library-duck-count',
    title: '小鸭子数数歌',
    summary: '一只小鸭子，两只小鸭子，跟着节奏一起数。',
    tag: '儿歌童谣',
    duration: '05′42″',
    cover: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 'library-touch-explore',
    title: '小手摸一摸',
    summary: '软软的、硬硬的、滑滑的，用小手感受不同的触感。',
    tag: '感官探索',
    duration: '07′18″',
    cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80'
  }
];

const THEMES = [
  { icon: '🌙', label: '睡前故事' },
  { icon: '🎵', label: '儿歌童谣' },
  { icon: '🧩', label: '认知启蒙' },
  { icon: '🤝', label: '亲子互动' }
];

export function VoiceView() {
  return (
    <main className="library-section explore-more">

      {/* Header */}
      <div className="library-header">
        <span className="section-pill">📚 早教故事库</span>
        <div className="library-heading">
          <h2>探索更多早教内容</h2>
          <p>丰富的早教故事和互动内容，陪伴宝宝快乐成长。</p>
        </div>
      </div>

      {/* 主题分类 */}
      <div className="library-category-grid">
        {THEMES.map((theme) => (
          <div key={theme.label} className="library-category-card">
            <div className="category-icon">{theme.icon}</div>
            <div className="category-text"><h3>{theme.label}</h3></div>
          </div>
        ))}
      </div>

      {/* 故事网格 */}
      <div className="library-story-grid">
        {STORIES.map((story) => (
          <article key={story.id} className="library-story-card" data-story-id={story.id}>
            <div className="story-cover" style={{ width: 100, height: 100, flexShrink: 0, overflow: 'hidden' }}>
              <img src={story.cover} alt={story.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div className="story-body">
              <div className="story-meta">
                <span className="story-tag">{story.tag}</span>
                <span className="story-duration">🕐 {story.duration}</span>
              </div>
              <h3>{story.title}</h3>
              <p>{story.summary}</p>
              <Link href={`/player/${story.id}`} className="story-play" aria-label={`播放${story.title}`}>
                <span>▶</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
