'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import Link from 'next/link';
import { useHomeController, type ContentType, type DurationType, type MoodType } from '@/hooks/useHomeController';
import { usePlayer } from '@/components/providers/PlayerProvider';
import { useBabyProfile } from '@/components/providers/BabyProfileProvider';
import { AgeSelector } from '@/components/common/AgeSelector';

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

type ContentCard = {
  key: ContentType;
  icon: string;
  title: string;
  description: string;
};

const CONTENT_TYPES: ContentCard[] = [
  { key: 'bedtime-story', icon: '', title: '睡前故事', description: '温馨的睡前故事，帮助宝宝安静入睡' },
  { key: 'nursery-rhyme', icon: '', title: '儿歌童谣', description: '朗朗上口的儿歌，培养语感和节奏感' },
  { key: 'cognitive', icon: '', title: '认知启蒙', description: '颜色、形状、数字、动物等基础认知' },
  { key: 'language', icon: '', title: '语言发展', description: '词汇积累和表达能力培养' },
  { key: 'sensory', icon: '', title: '感官探索', description: '通过多感官体验认识周围世界' },
  { key: 'parent-child', icon: '', title: '亲子互动', description: '有趣的亲子游戏，增进亲子关系' }
];

const DURATIONS: { value: DurationType; icon: string; label: string; desc: string }[] = [
  { value: 'short', icon: '', label: '短篇', desc: '3-5 分钟' },
  { value: 'medium', icon: '', label: '中篇', desc: '5-10 分钟' },
  { value: 'long', icon: '', label: '长篇', desc: '10-15 分钟' }
];

const MOODS: { value: MoodType; icon: string; label: string; desc: string }[] = [
  { value: 'happy', icon: '', label: '活泼欢快', desc: '节奏明快，充满活力' },
  { value: 'neutral', icon: '', label: '温馨舒缓', desc: '轻柔平和，适合安抚' }
];

const VOICE_CARDS = [
  { value: 'S_DrtguyIB1', icon: '', label: 'Kevin', desc: '专属定制' },
  { value: 'zh_female_tianmeitaozi_mars_bigtts', icon: '', label: '甜美桃子', desc: '多情感·推荐' },
  { value: 'zh_female_roumeinvyou_emo_v2_mars_bigtts', icon: '', label: '柔美女友', desc: '多情感' },
  { value: 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', icon: '', label: '爽快思思', desc: '多情感' },
  { value: 'ICL_zh_female_huoponvhai_tob', icon: '', label: '活泼女孩', desc: '元气满满' }
];

type WizardStep = 'library' | 'type' | 'duration' | 'mood' | 'voice' | 'confirm';
const STEPS: WizardStep[] = ['library', 'type', 'duration', 'mood', 'voice', 'confirm'];

const STEP_META: Record<WizardStep, { num: number; title: string; subtitle: string }> = {
  library:  { num: 1, title: '故事库', subtitle: '浏览精选故事或定制新内容' },
  type:     { num: 2, title: '内容类型', subtitle: '想给宝宝听什么？' },
  duration: { num: 3, title: '内容长度', subtitle: '选择合适的篇幅' },
  mood:     { num: 4, title: '内容风格', subtitle: '选择整体基调' },
  voice:    { num: 5, title: '朗读语音', subtitle: '挑选喜欢的音色' },
  confirm:  { num: 6, title: '确认生成', subtitle: '检查选择，一键生成' }
};

function getSelectedLabel(step: WizardStep, contentType: ContentType, duration: DurationType, mood: MoodType, voiceType: string): string {
  switch (step) {
    case 'library': return '定制新内容';
    case 'type': return CONTENT_TYPES.find(c => c.key === contentType)?.title || '';
    case 'duration': return DURATIONS.find(d => d.value === duration)?.label || '';
    case 'mood': return MOODS.find(m => m.value === mood)?.label || '';
    case 'voice': return VOICE_CARDS.find(v => v.value === voiceType)?.label || '';
    default: return '';
  }
}

export function StoriesView() {
  const controller = useHomeController();
  const { upsertStory } = usePlayer();
  const { ageGroup, setAgeGroup } = useBabyProfile();
  const { storyMeta } = controller;
  const [currentStep, setCurrentStep] = useState<WizardStep>('library');
  const [mode, setMode] = useState<'browse' | 'create'>('browse');

  useEffect(() => {
    STORIES.forEach((story) => {
      upsertStory({
        id: story.id,
        title: story.title,
        summary: story.summary,
        cover: story.cover,
        type: 'bedtime-story',
        createdAt: Date.now()
      });
    });
  }, [upsertStory]);

  const highlightStory = useMemo(() => ({
    id: 'featured-bear-adventure',
    title: '小熊的彩虹冒险',
    summary: '小熊宝宝跟着蝴蝶出发，发现了一道美丽的彩虹，每种颜色都藏着一个小惊喜。',
    duration: '08′45″',
    cover: 'https://images.unsplash.com/photo-1527628173875-3c7bfd28ad72?auto=format&fit=crop&w=640&q=80'
  }), []);

  const currentIndex = STEPS.indexOf(currentStep);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1]);
  }, [currentStep]);

  const goTo = useCallback((step: WizardStep) => {
    setCurrentStep(step);
  }, []);

  const handleCreateNew = () => {
    setMode('create');
    goNext();
  };

  const handleTypeSelect = (type: ContentType) => {
    controller.setContentType(type);
    goNext();
  };

  const handleDurationSelect = (d: DurationType) => {
    controller.setDuration(d);
    goNext();
  };

  const handleMoodSelect = (m: MoodType) => {
    controller.setMood(m);
    goNext();
  };

  const handleVoiceSelect = (v: string) => {
    controller.setVoiceType(v);
    goNext();
  };

  const completedSteps = STEPS.slice(0, currentIndex).filter(s => mode === 'create' || s === 'library');

  return (
    <main className="wizard-page">
      {/* 面包屑导航 */}
      {completedSteps.length > 0 && mode === 'create' && (
        <div className="wizard-breadcrumb">
          {completedSteps.map((step) => (
            <button
              key={step}
              type="button"
              className="breadcrumb-chip"
              onClick={() => goTo(step)}
            >
              <span className="breadcrumb-label">{STEP_META[step].title}</span>
              <span className="breadcrumb-value">
                {getSelectedLabel(step, controller.contentType, controller.duration, controller.mood, controller.voiceType)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 步骤标题 */}
      {mode === 'create' && (
        <div className="wizard-header">
          <div className="wizard-step-indicator">
            <span className="step-num">{STEP_META[currentStep].num}</span>
            <span className="step-total">/ {STEPS.length}</span>
          </div>
          <h2 className="wizard-title">{STEP_META[currentStep].title}</h2>
          <p className="wizard-subtitle">{STEP_META[currentStep].subtitle}</p>
        </div>
      )}

      {/* Step 1: 故事库 */}
      {currentStep === 'library' && (
        <div className="wizard-step wizard-step-enter">
          <div className="stories-library-section">
            <div className="library-header">
              <div className="library-greeting">
                <span className="greeting-title">故事库</span>
                <p className="greeting-subtitle">浏览精选故事，或定制专属早教内容</p>
              </div>
              <AgeSelector value={ageGroup} onChange={setAgeGroup} />
            </div>

            {/* 今日推荐 */}
            <div className="library-highlight" data-story-id={highlightStory.id}>
              <div className="highlight-art">
                <img src={highlightStory.cover} alt="早教故事插画" loading="lazy" />
              </div>
              <div className="highlight-info">
                <span className="highlight-pill">今日推荐</span>
                <h3>{highlightStory.title}</h3>
                <p>{highlightStory.summary}</p>
                <div className="highlight-meta">
                  <span className="highlight-duration">{highlightStory.duration}</span>
                  <Link
                    href={`/player/${highlightStory.id}`}
                    className="highlight-play"
                    aria-label="播放推荐内容"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.6"></circle>
                      <path d="M10 8.5L15 12L10 15.5V8.5Z" fill="currentColor"></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>

            {/* 故事列表 */}
            <div className="library-stories">
              <h3 className="library-section-title">精选故事</h3>
              <div className="stories-grid">
                {STORIES.map((story) => (
                  <Link
                    key={story.id}
                    href={`/player/${story.id}`}
                    className="story-item"
                  >
                    <div className="story-cover">
                      <img src={story.cover} alt={story.title} loading="lazy" />
                    </div>
                    <div className="story-info">
                      <span className="story-tag">{story.tag}</span>
                      <h4>{story.title}</h4>
                      <p>{story.summary}</p>
                      <span className="story-duration">{story.duration}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* 定制按钮 */}
            <div className="library-create-cta">
              <button
                type="button"
                className="btn btn-primary btn-large"
                onClick={handleCreateNew}
              >
                <span className="btn-text">定制新内容</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: 内容类型 */}
      {currentStep === 'type' && mode === 'create' && (
        <div className="wizard-step wizard-step-enter">
          <div className="wizard-grid">
            {CONTENT_TYPES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={clsx('wizard-card', { active: controller.contentType === item.key })}
                onClick={() => handleTypeSelect(item.key)}
              >
                <span className="wizard-card-icon">{item.icon}</span>
                <span className="wizard-card-title">{item.title}</span>
                <span className="wizard-card-desc">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 时长 */}
      {currentStep === 'duration' && mode === 'create' && (
        <div className="wizard-step wizard-step-enter">
          <div className="wizard-grid wizard-grid-row">
            {DURATIONS.map((d) => (
              <button
                key={d.value}
                type="button"
                className={clsx('wizard-card wizard-card-wide', { active: controller.duration === d.value })}
                onClick={() => handleDurationSelect(d.value)}
              >
                <span className="wizard-card-icon">{d.icon}</span>
                <div>
                  <span className="wizard-card-title">{d.label}</span>
                  <span className="wizard-card-desc">{d.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: 风格 */}
      {currentStep === 'mood' && mode === 'create' && (
        <div className="wizard-step wizard-step-enter">
          <div className="wizard-grid wizard-grid-row">
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={clsx('wizard-card wizard-card-wide', { active: controller.mood === m.value })}
                onClick={() => handleMoodSelect(m.value)}
              >
                <span className="wizard-card-icon">{m.icon}</span>
                <div>
                  <span className="wizard-card-title">{m.label}</span>
                  <span className="wizard-card-desc">{m.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: 语音 */}
      {currentStep === 'voice' && mode === 'create' && (
        <div className="wizard-step wizard-step-enter">
          <div className="wizard-grid wizard-grid-row">
            {VOICE_CARDS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={clsx('wizard-card wizard-card-wide', { active: controller.voiceType === v.value })}
                onClick={() => handleVoiceSelect(v.value)}
              >
                <span className="wizard-card-icon">{v.icon}</span>
                <div>
                  <span className="wizard-card-title">{v.label}</span>
                  <span className="wizard-card-desc">{v.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 6: 确认 & 生成 */}
      {currentStep === 'confirm' && mode === 'create' && (
        <div className="wizard-step wizard-step-enter">
          <div className="wizard-summary">
            {(['type', 'duration', 'mood', 'voice'] as WizardStep[]).map((step) => (
              <div key={step} className="summary-row">
                <span className="summary-label">{STEP_META[step].title}</span>
                <span className="summary-value">
                  {getSelectedLabel(step, controller.contentType, controller.duration, controller.mood, controller.voiceType)}
                </span>
                <button type="button" className="summary-edit" onClick={() => goTo(step)}>修改</button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary wizard-generate-btn"
            onClick={controller.handleGenerateContent}
            disabled={controller.isGenerating}
          >
            <span className="btn-text">{controller.isGenerating ? '正在生成…' : '开始生成'}</span>
            {controller.isGenerating && <div className="loading-spinner" />}
          </button>
        </div>
      )}

      {/* 生成结果 */}
      {controller.showResult && mode === 'create' && (
        <section className="wizard-result">
          <div className="result-header">
            <span className="result-pill">生成完成</span>
            <h2>宝宝的早教内容</h2>
          </div>

          <article className="story-card">
            <div className="story-card-head"><span className="story-pill">文字内容</span></div>
            <div className="content-text">{controller.generatedText}</div>
          </article>

          <div className="wizard-audio-actions">
            <button
              className="btn btn-outline"
              onClick={controller.handlePreviewAudio}
              disabled={controller.isPreviewing}
            >
              <span className="btn-text">{controller.isPreviewing ? '准备试听…' : '试听效果'}</span>
              {controller.isPreviewing && <div className="loading-spinner" />}
            </button>
            <button
              className="btn btn-secondary"
              onClick={controller.handleGenerateAudio}
              disabled={controller.isGeneratingAudio}
            >
              <span className="btn-text">{controller.isGeneratingAudio ? '生成中…' : '生成语音'}</span>
              {controller.isGeneratingAudio && <div className="loading-spinner" />}
            </button>
          </div>

          {controller.previewUrl && (
            <div className="preview-player">
              <span className="preview-label">试听</span>
              <audio controls src={controller.previewUrl}>您的浏览器不支持音频播放。</audio>
            </div>
          )}

          <div className="wizard-result-footer">
            {storyMeta && (
              <Link href={`/player/${encodeURIComponent(storyMeta.id)}`} className="btn btn-primary">
                前往播放页
              </Link>
            )}
            <button type="button" className="btn btn-outline" onClick={controller.handleDownloadAudio} disabled={!controller.hasAudio}>
              下载音频
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setCurrentStep('library'); setMode('browse'); }}>
              返回故事库
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
