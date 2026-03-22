'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useHomeController, type ContentType, type DurationType, type MoodType } from '@/hooks/useHomeController';
import { useBabyProfile, AGE_GROUPS, type AgeGroup } from '@/components/providers/BabyProfileProvider';
import { usePlayer } from '@/components/providers/PlayerProvider';

/* ── 数据配置 ── */
const CONTENT_TYPES: { key: ContentType; icon: string; title: string; desc: string }[] = [
  { key: 'bedtime-story', icon: '🌙', title: '睡前故事', desc: '温馨助眠' },
  { key: 'nursery-rhyme', icon: '🎵', title: '儿歌童谣', desc: '培养语感' },
  { key: 'cognitive',     icon: '🧩', title: '认知启蒙', desc: '颜色形状' },
  { key: 'language',      icon: '💬', title: '语言发展', desc: '词汇积累' },
  { key: 'sensory',       icon: '✨', title: '感官探索', desc: '多感体验' },
  { key: 'parent-child',  icon: '🤝', title: '亲子互动', desc: '增进亲情' },
];

const DURATIONS: { value: DurationType; icon: string; label: string; desc: string }[] = [
  { value: 'short',  icon: '⚡', label: '短篇', desc: '3-5分钟' },
  { value: 'medium', icon: '🌿', label: '中篇', desc: '5-10分钟' },
  { value: 'long',   icon: '🌊', label: '长篇', desc: '10-15分钟' },
];

const MOODS: { value: MoodType; icon: string; label: string; desc: string }[] = [
  { value: 'happy',   icon: '☀️', label: '活泼欢快', desc: '节奏明快' },
  { value: 'neutral', icon: '🌙', label: '温馨舒缓', desc: '轻柔平和' },
];

const VOICE_CARDS = [
  { value: 'S_DrtguyIB1',                                icon: '🎤', label: 'Kevin',    desc: '专属定制' },
  { value: 'zh_female_tianmeitaozi_mars_bigtts',          icon: '🍑', label: '甜美桃子', desc: '多情感推荐' },
  { value: 'zh_female_roumeinvyou_emo_v2_mars_bigtts',    icon: '🌸', label: '柔美女友', desc: '多情感' },
  { value: 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', icon: '⚡', label: '爽快思思', desc: '多情感' },
  { value: 'ICL_zh_female_huoponvhai_tob',                icon: '🌟', label: '活泼女孩', desc: '元气满满' },
];

type GemKey = 'age' | 'type' | 'duration' | 'mood' | 'voice';

const GEMS: { key: GemKey; label: string }[] = [
  { key: 'age',      label: '月龄' },
  { key: 'type',     label: '类型' },
  { key: 'duration', label: '时长' },
  { key: 'mood',     label: '风格' },
  { key: 'voice',    label: '音色' },
];

const TYPE_COVER_ICONS: Record<string, string> = {
  'bedtime-story': '🌙', 'nursery-rhyme': '🎵', 'cognitive': '🧩',
  'language': '💬', 'sensory': '✨', 'parent-child': '🤝',
};
const TYPE_COVER_GRADIENTS: Record<string, string> = {
  'bedtime-story': 'linear-gradient(135deg,#1a1040,#2d1b69,#0a0e27)',
  'nursery-rhyme': 'linear-gradient(135deg,#1a0a2e,#6b2fa0,#0a0e27)',
  'cognitive':     'linear-gradient(135deg,#0a1a2e,#1a5276,#0a0e27)',
  'language':      'linear-gradient(135deg,#1a0a1e,#7b2d8b,#0a0e27)',
  'sensory':       'linear-gradient(135deg,#1a1a0a,#7d6608,#0a0e27)',
  'parent-child':  'linear-gradient(135deg,#0a1a0a,#1a5276,#0a0e27)',
};

/* ── 时间问候语 ── */
function getTagline(): string {
  const h = new Date().getHours();
  if (h < 6)  return '夜深了，给宝宝许一个甜梦';
  if (h < 12) return '早安，今天为宝宝准备什么？';
  if (h < 18) return '午后时光，陪宝宝一起探索世界';
  return '今晚，为宝宝许一个愿';
}

/* ── GemPopup 组件 ── */
interface GemPopupProps {
  gemKey: GemKey;
  ageGroup: AgeGroup;
  contentType: ContentType;
  duration: DurationType;
  mood: MoodType;
  voiceType: string;
  onSelect: (key: GemKey, value: string) => void;
  onClose: () => void;
}

function GemPopup({ gemKey, ageGroup, contentType, duration, mood, voiceType, onSelect, onClose }: GemPopupProps) {
  let options: { value: string; icon: string; label: string; desc: string }[] = [];
  let currentVal = '';

  if (gemKey === 'age') {
    options = AGE_GROUPS.map(g => ({ value: g.value, icon: '👶', label: g.label, desc: '' }));
    currentVal = ageGroup;
  } else if (gemKey === 'type') {
    options = CONTENT_TYPES.map(c => ({ value: c.key, icon: c.icon, label: c.title, desc: c.desc }));
    currentVal = contentType;
  } else if (gemKey === 'duration') {
    options = DURATIONS.map(d => ({ value: d.value, icon: d.icon, label: d.label, desc: d.desc }));
    currentVal = duration;
  } else if (gemKey === 'mood') {
    options = MOODS.map(m => ({ value: m.value, icon: m.icon, label: m.label, desc: m.desc }));
    currentVal = mood;
  } else if (gemKey === 'voice') {
    options = VOICE_CARDS.map(v => ({ value: v.value, icon: v.icon, label: v.label, desc: v.desc }));
    currentVal = voiceType;
  }

  return (
    <>
      <div className="gem-popup-overlay" onClick={onClose} />
      <div className="gem-popup">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            className={clsx('gem-option', { 'option-active': opt.value === currentVal })}
            onClick={() => { onSelect(gemKey, opt.value); onClose(); }}
          >
            <span className="gem-option-icon">{opt.icon}</span>
            <span className="gem-option-label">{opt.label}</span>
            {opt.desc && <span className="gem-option-desc">{opt.desc}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

/* ── 主组件 ── */
export function HomeView() {
  const controller = useHomeController();
  const { ageGroup, setAgeGroup } = useBabyProfile();
  const { upsertStory } = usePlayer();
  const { storyMeta } = controller;
  const [openGem, setOpenGem] = useState<GemKey | null>(null);
  const [animatingGem, setAnimatingGem] = useState<GemKey | null>(null);
  const gemRefs = useRef<Partial<Record<GemKey, HTMLDivElement>>>({});

  // 获取当前宝石显示值
  const getGemValue = (key: GemKey): string => {
    if (key === 'age')      return AGE_GROUPS.find(g => g.value === ageGroup)?.label || ageGroup;
    if (key === 'type')     return CONTENT_TYPES.find(c => c.key === controller.contentType)?.title || '';
    if (key === 'duration') return DURATIONS.find(d => d.value === controller.duration)?.label || '';
    if (key === 'mood')     return MOODS.find(m => m.value === controller.mood)?.label || '';
    if (key === 'voice')    return VOICE_CARDS.find(v => v.value === controller.voiceType)?.label || '';
    return '';
  };

  const getGemIcon = (key: GemKey): string => {
    if (key === 'age')      return '👶';
    if (key === 'type')     return CONTENT_TYPES.find(c => c.key === controller.contentType)?.icon || '🌙';
    if (key === 'duration') return DURATIONS.find(d => d.value === controller.duration)?.icon || '⚡';
    if (key === 'mood')     return MOODS.find(m => m.value === controller.mood)?.icon || '🌙';
    if (key === 'voice')    return VOICE_CARDS.find(v => v.value === controller.voiceType)?.icon || '🎤';
    return '✦';
  };

  const handleGemSelect = useCallback((key: GemKey, value: string) => {
    if (key === 'age')      setAgeGroup(value as AgeGroup);
    if (key === 'type')     controller.setContentType(value as ContentType);
    if (key === 'duration') controller.setDuration(value as DurationType);
    if (key === 'mood')     controller.setMood(value as MoodType);
    if (key === 'voice')    controller.setVoiceType(value);
    setAnimatingGem(key);
    setTimeout(() => setAnimatingGem(null), 450);
  }, [controller, setAgeGroup]);

  // 预填卡点击 — 展开/收起宝石区
  const [gemsExpanded, setGemsExpanded] = useState(false);

  const presetTitle = `${CONTENT_TYPES.find(c => c.key === controller.contentType)?.title || '睡前故事'}`;
  const presetDesc  = `${AGE_GROUPS.find(g => g.value === ageGroup)?.label || ''} · ${DURATIONS.find(d => d.value === controller.duration)?.label || ''} · ${MOODS.find(m => m.value === controller.mood)?.label || ''} · ${VOICE_CARDS.find(v => v.value === controller.voiceType)?.label || ''}`;

  return (
    <main className="cradle-page">
      {/* 顶部情绪标语 */}
      <div className="cradle-hero">
        <span className="cradle-moon">☽</span>
        <h1 className="cradle-tagline">{getTagline()}</h1>
        <p className="cradle-sub">AI 智能生成 · 专属胎教内容</p>
      </div>

      {/* 智能预填卡 */}
      <div
        className="cradle-preset-card"
        onClick={() => setGemsExpanded(v => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setGemsExpanded(v => !v)}
        aria-expanded={gemsExpanded}
      >
        <span className="cradle-preset-icon">{getGemIcon('type')}</span>
        <div className="cradle-preset-body">
          <p className="cradle-preset-title">{presetTitle}</p>
          <p className="cradle-preset-desc">{presetDesc}</p>
        </div>
        <span className="cradle-preset-arrow">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            {gemsExpanded
              ? <path d="M18 15l-6-6-6 6" />
              : <path d="M6 9l6 6 6-6" />
            }
          </svg>
        </span>
      </div>

      {/* 宝石选择器（可展开） */}
      {gemsExpanded && (
        <div className="cradle-gems-section">
          <p className="cradle-gems-label">调整偏好</p>
          <div className="cradle-gems-row">
            {GEMS.map(gem => (
              <div
                key={gem.key}
                ref={el => { if (el) gemRefs.current[gem.key] = el; }}
                style={{ position: 'relative', flex: 1 }}
              >
                <button
                  type="button"
                  className={clsx('gem-btn', {
                    'gem-active': openGem === gem.key,
                    'gem-selected': animatingGem === gem.key,
                  })}
                  onClick={() => setOpenGem(k => k === gem.key ? null : gem.key)}
                >
                  <span className="gem-icon">{getGemIcon(gem.key)}</span>
                  <span className="gem-label">{gem.label}</span>
                  <span className="gem-value">{getGemValue(gem.key)}</span>
                </button>

                {openGem === gem.key && (
                  <GemPopup
                    gemKey={gem.key}
                    ageGroup={ageGroup}
                    contentType={controller.contentType}
                    duration={controller.duration}
                    mood={controller.mood}
                    voiceType={controller.voiceType}
                    onSelect={handleGemSelect}
                    onClose={() => setOpenGem(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 主 CTA */}
      <div className="cradle-cta-section">
        <button
          type="button"
          className="cradle-generate-btn"
          onClick={controller.handleGenerateContent}
          disabled={controller.isGenerating}
        >
          {controller.isGenerating ? (
            <>
              <div className="loading-spinner" />
              <span>✨ 正在为宝宝创作…</span>
            </>
          ) : (
            <span>✦ 为宝宝创作专属故事</span>
          )}
        </button>
      </div>

      {/* 生成结果 — 故事卷轴 */}
      {controller.showResult && (
        <div className="scroll-result">
          {/* 卷轴封面 */}
          <div
            className="scroll-cover-placeholder"
            style={{ background: TYPE_COVER_GRADIENTS[controller.contentType] || TYPE_COVER_GRADIENTS['bedtime-story'] }}
          >
            {TYPE_COVER_ICONS[controller.contentType] || '🌙'}
          </div>

          <div className="scroll-body">
            <span className="scroll-badge">✨ 生成完成</span>

            {/* 文字内容 */}
            <div className="scroll-text">{controller.generatedText}</div>

            {/* 音频操作 */}
            <div className="scroll-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={controller.handlePreviewAudio}
                disabled={controller.isPreviewing}
              >
                <span>{controller.isPreviewing ? '准备中…' : '🎧 试听'}</span>
                {controller.isPreviewing && <div className="loading-spinner" />}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={controller.handleGenerateAudio}
                disabled={controller.isGeneratingAudio}
              >
                <span>{controller.isGeneratingAudio ? '生成中…' : '🎙️ 生成语音'}</span>
                {controller.isGeneratingAudio && <div className="loading-spinner" />}
              </button>
              {storyMeta && (
                <Link href={`/player/${encodeURIComponent(storyMeta.id)}`} className="btn btn-primary">
                  ▶ 播放
                </Link>
              )}
            </div>

            {/* 试听播放器 */}
            {controller.previewUrl && (
              <div className="preview-player">
                <span className="preview-label">🎵 试听</span>
                <audio controls src={controller.previewUrl} style={{ width: '100%', borderRadius: 10 }}>
                  您的浏览器不支持音频播放。
                </audio>
              </div>
            )}

            {/* 底部辅助操作 */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={controller.handleDownloadAudio}
                disabled={!controller.hasAudio}
              >
                ⬇ 下载音频
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={controller.handleGenerateContent}
                disabled={controller.isGenerating}
              >
                ↺ 重新生成
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
