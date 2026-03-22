'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/components/providers/PlayerProvider';
import { useBabyProfile, AGE_GROUPS } from '@/components/providers/BabyProfileProvider';

const TYPE_LABELS: Record<string, string> = {
  'bedtime-story': '睡前故事',
  'nursery-rhyme': '儿歌童谣',
  'cognitive':     '认知启蒙',
  'language':      '语言发展',
  'sensory':       '感官探索',
  'parent-child':  '亲子互动',
  'music':         '古典音乐',
};

const TYPE_ICONS: Record<string, string> = {
  'bedtime-story': '🌙', 'nursery-rhyme': '🎵', 'cognitive': '🧩',
  'language': '💬', 'sensory': '✨', 'parent-child': '🤝', 'music': '🎼',
};

const STARRED_KEY = 've_starred_stories';
const FIRST_USE_KEY = 've_first_use_date';

function loadStarred(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STARRED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveStarred(set: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STARRED_KEY, JSON.stringify([...set]));
}

function getDaysUsed(): number {
  if (typeof window === 'undefined') return 1;
  const stored = window.localStorage.getItem(FIRST_USE_KEY);
  if (!stored) {
    window.localStorage.setItem(FIRST_USE_KEY, String(Date.now()));
    return 1;
  }
  return Math.max(1, Math.round((Date.now() - Number(stored)) / 86400000));
}

function groupByDate(stories: { id: string; createdAt?: number; [k: string]: unknown }[]) {
  const now = Date.now();
  const DAY = 86400000;
  const groups: Record<string, typeof stories> = {};

  stories.forEach(s => {
    const ts = s.createdAt || 0;
    const diff = now - ts;
    let key: string;
    if (diff < DAY) key = '今日';
    else if (diff < 2 * DAY) key = '昨天';
    else if (diff < 7 * DAY) key = '本周';
    else key = '更早';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  return groups;
}

export function MeView() {
  const { stories } = usePlayer();
  const { ageGroup, setAgeGroup } = useBabyProfile();
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [daysUsed, setDaysUsed] = useState(1);
  const [showAgePanel, setShowAgePanel] = useState(false);
  const [justStarred, setJustStarred] = useState<string | null>(null);

  useEffect(() => {
    setStarred(loadStarred());
    setDaysUsed(getDaysUsed());
  }, []);

  const toggleStar = useCallback((id: string) => {
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else { next.add(id); setJustStarred(id); setTimeout(() => setJustStarred(null), 400); }
      saveStarred(next);
      return next;
    });
  }, []);

  const sorted = useMemo(
    () => [...stories].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [stories]
  );

  const starredStories = useMemo(() => sorted.filter(s => starred.has(s.id)), [sorted, starred]);
  const normalStories  = useMemo(() => sorted.filter(s => !starred.has(s.id)), [sorted, starred]);
  const grouped = useMemo(() => groupByDate(normalStories), [normalStories]);
  const GROUP_ORDER = ['今日', '昨天', '本周', '更早'];

  const ageLabel = AGE_GROUPS.find(g => g.value === ageGroup)?.label || ageGroup;

  return (
    <main className="treasure-page">

      {/* 宝宝档案卡 */}
      <div className="treasure-profile-card">
        <div className="treasure-profile-header">
          <span className="treasure-profile-title">👶 宝宝档案</span>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="treasure-profile-edit"
              onClick={() => setShowAgePanel(v => !v)}
            >
              {ageLabel} ▾
            </button>
            {showAgePanel && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowAgePanel(false)} />
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

        <div className="treasure-stats">
          <div className="treasure-stat">
            <span className="treasure-stat-num">🌙 {daysUsed}</span>
            <span className="treasure-stat-label">陪伴天数</span>
          </div>
          <div className="treasure-stat">
            <span className="treasure-stat-num">🎵 {stories.length}</span>
            <span className="treasure-stat-label">生成故事</span>
          </div>
          <div className="treasure-stat">
            <span className="treasure-stat-num">⭐ {starred.size}</span>
            <span className="treasure-stat-label">星光珍藏</span>
          </div>
        </div>
      </div>

      {/* 无记录空状态 */}
      {stories.length === 0 && (
        <div className="treasure-empty">
          <span className="treasure-empty-icon">🌙</span>
          <p className="treasure-empty-title">暂无历史记录</p>
          <p className="treasure-empty-sub">去生成宝宝的第一个专属故事吧～</p>
          <Link href="/home" className="btn btn-primary" style={{ marginTop: 8 }}>
            ✨ 开始创作
          </Link>
        </div>
      )}

      {/* 星光珍藏区 */}
      {starredStories.length > 0 && (
        <>
          <div className="treasure-section-title">⭐ 星光珍藏</div>
          <div className="treasure-list">
            {starredStories.map(story => (
              <TreasureItem
                key={story.id}
                story={story}
                isStarred
                isAnimating={justStarred === story.id}
                onToggleStar={toggleStar}
              />
            ))}
          </div>
        </>
      )}

      {/* 按日期分组的历史 */}
      {normalStories.length > 0 && GROUP_ORDER.map(group => {
        const items = grouped[group];
        if (!items || items.length === 0) return null;
        return (
          <div key={group}>
            <div className="treasure-section-title">{group}</div>
            <div className="treasure-list">
              {items.map(story => (
                <TreasureItem
                  key={story.id}
                  story={story}
                  isStarred={false}
                  isAnimating={justStarred === story.id}
                  onToggleStar={toggleStar}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* 底部入口 */}
      <div className="treasure-footer">
        <a href="/landing.html">关于月光摇篮</a>
        <a href="mailto:support@kevinai.com">意见反馈</a>
        <a href="/landing.html">访问官网</a>
      </div>
    </main>
  );
}

/* ── 单条历史卡片 ── */
interface TreasureItemProps {
  story: {
    id: string;
    title?: string;
    summary?: string;
    cover?: string;
    type?: string;
    createdAt?: number;
  };
  isStarred: boolean;
  isAnimating: boolean;
  onToggleStar: (id: string) => void;
}

function TreasureItem({ story, isStarred, isAnimating, onToggleStar }: TreasureItemProps) {
  const typeIcon = TYPE_ICONS[story.type || ''] || '📖';
  const typeLabel = TYPE_LABELS[story.type || ''] || '故事';
  const timeStr = story.createdAt
    ? new Date(story.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="treasure-item">
      {/* 缩略图 */}
      <div className="treasure-thumb">
        {story.cover
          ? <img src={story.cover} alt={story.title || ''} />
          : typeIcon
        }
      </div>

      {/* 内容 */}
      <div className="treasure-body">
        <div className="treasure-item-title">{story.title || story.summary || '未命名故事'}</div>
        <div className="treasure-item-meta">
          <span className="treasure-item-badge">{typeLabel}</span>
          {timeStr && <span className="treasure-item-time">{timeStr}</span>}
        </div>
      </div>

      {/* 操作 */}
      <div className="treasure-item-actions">
        <button
          type="button"
          className={`treasure-star-btn${isStarred ? ' starred' : ''}${isAnimating ? ' starred' : ''}`}
          onClick={() => onToggleStar(story.id)}
          aria-label={isStarred ? '取消收藏' : '收藏'}
        >
          {isStarred ? '⭐' : '☆'}
        </button>
        <Link href={`/player/${story.id}`} className="treasure-play-btn" aria-label="播放">
          ▶
        </Link>
      </div>
    </div>
  );
}
