'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer, StoryMeta } from '@/components/providers/PlayerProvider';
import { useBabyProfile, type AgeGroup } from '@/components/providers/BabyProfileProvider';
import { arkGenerate } from '@/lib/ark';
import {
  synthesizeSegmentedText,
  ttsSynthesize,
  type TtsPayload
} from '@/lib/tts';

export type ContentType =
  | 'bedtime-story'
  | 'nursery-rhyme'
  | 'cognitive'
  | 'language'
  | 'sensory'
  | 'parent-child';

export type DurationType = 'short' | 'medium' | 'long';
export type MoodType = 'happy' | 'neutral';

const PLAYER_VISUALS: Record<ContentType, { title: string; cover: string }> = {
  'bedtime-story': {
    title: '宝宝的睡前故事',
    cover: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&q=80'
  },
  'nursery-rhyme': {
    title: '欢乐儿歌童谣',
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=640&q=80'
  },
  cognitive: {
    title: '认知启蒙时光',
    cover: 'https://images.unsplash.com/photo-1477238134895-98438ad7b985?auto=format&fit=crop&w=640&q=80'
  },
  language: {
    title: '语言发展乐园',
    cover: 'https://images.unsplash.com/photo-1504280390368-39776d1e5dff?auto=format&fit=crop&w=640&q=80'
  },
  sensory: {
    title: '感官探索之旅',
    cover: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=640&q=80'
  },
  'parent-child': {
    title: '亲子互动游戏',
    cover: 'https://images.unsplash.com/photo-1528372444006-1bfc81acab02?auto=format&fit=crop&w=640&q=80'
  }
};

const VOICE_OPTIONS = [
  { value: 'S_DrtguyIB1', label: 'Kevin（专属）' },
  { value: 'zh_female_tianmeitaozi_mars_bigtts', label: '甜美桃子（多情感）' },
  { value: 'zh_female_roumeinvyou_emo_v2_mars_bigtts', label: '柔美女友（多情感）' },
  { value: 'zh_female_shuangkuaisisi_emo_v2_mars_bigtts', label: '爽快思思（多情感）' },
  { value: 'ICL_zh_female_huoponvhai_tob', label: '活泼女孩' }
];

function cleanTextForReading(text: string): string {
  if (!text) return text;
  return text.replace(/^#{1,6}\s*/gm, '').trim();
}

function createSummary(text: string): string {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 60) return normalized;
  return `${normalized.slice(0, 60)}…`;
}

const AGE_DESCRIPTIONS: Record<AgeGroup, string> = {
  '0-3': '0-3个月的新生儿，视觉和听觉刚开始发展，喜欢高对比度的图案和轻柔的声音',
  '4-6': '4-6个月的宝宝，开始能抓握物品，对鲜艳颜色感兴趣，喜欢重复的声音和节奏',
  '7-9': '7-9个月的宝宝，开始爬行探索，能理解简单的词语，对因果关系产生好奇',
  '10-12': '10-12个月的宝宝，即将学步，能说简单的叠词，喜欢模仿和互动游戏',
  '13-18': '13-18个月的幼儿，开始学步和说话，词汇量快速增长，喜欢指认物品和简单指令',
  '19-24': '19-24个月的幼儿，语言爆发期，能说短句，喜欢角色扮演和简单的故事情节',
  '25-36': '25-36个月的幼儿，想象力丰富，能理解复杂故事，喜欢提问和探索世界'
};

function buildPrompt(type: ContentType, mood: MoodType, duration: DurationType, ageGroup: AgeGroup): string {
  const moodMap: Record<MoodType, string> = {
    happy: '愉悦活泼',
    neutral: '平和温馨'
  };

  const durationMap: Record<DurationType, string> = {
    short: '约400-600字',
    medium: '约800-1200字',
    long: '约1500-2000字'
  };

  const typeMap: Record<ContentType, string> = {
    'bedtime-story':
      '创作一个温馨的睡前故事，内容积极正面，富有想象力，语言温柔优美，情节简单易懂，帮助宝宝安静入睡',
    'nursery-rhyme':
      '创作一首朗朗上口的儿歌童谣，节奏明快，用词简单重复，适合宝宝跟唱和律动，培养语感和节奏感',
    cognitive:
      '创作认知启蒙内容，围绕颜色、形状、数字、动物等基础概念，用生动有趣的方式帮助宝宝认识世界',
    language:
      '创作语言发展内容，包含简单词汇、短句练习、对话互动，帮助宝宝积累词汇和表达能力',
    sensory:
      '创作感官探索内容，引导宝宝通过触摸、听觉、视觉等感官体验来认识周围环境，激发好奇心',
    'parent-child':
      '设计一个亲子互动游戏或活动，包含具体的玩法步骤，促进亲子关系，同时锻炼宝宝的运动和认知能力'
  };

  const ageDesc = AGE_DESCRIPTIONS[ageGroup];

  return `请为${ageDesc}的宝宝，生成${typeMap[type]}。整体基调为"${moodMap[mood]}"，篇幅${durationMap[duration]}。要求：\n- 内容适合该月龄段宝宝的发展特点\n- 用词简单、温暖、富有节奏感\n- 建议分为自然小段，便于朗读\n- 面向中文语境读者，使用简体中文\n- 请使用自然流畅的叙述格式，不要使用markdown标题格式（如#、##、###等）`;
}

export interface HomeController {
  contentType: ContentType;
  setContentType: (type: ContentType) => void;
  mood: MoodType;
  setMood: (mood: MoodType) => void;
  duration: DurationType;
  setDuration: (duration: DurationType) => void;
  voiceType: string;
  setVoiceType: (voice: string) => void;
  generatedText: string;
  isGenerating: boolean;
  isPreviewing: boolean;
  isGeneratingAudio: boolean;
  showResult: boolean;
  handleGenerateContent: () => Promise<void>;
  handlePreviewAudio: () => Promise<void>;
  handleConfirmPreview: () => void;
  handleGenerateAudio: () => Promise<void>;
  handleDownloadAudio: () => void;
  hasAudio: boolean;
  storyMeta?: StoryMeta;
  previewUrl?: string;
  isPreviewReady: boolean;
  voiceOptions: typeof VOICE_OPTIONS;
}

const MODEL_DEFAULT = 'doubao-1.5-pro-32k-250115';
const HISTORY_KEY = 've_story_history';

function loadHistory(): StoryMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('Failed to load history', error);
    return [];
  }
}

function persistHistory(stories: StoryMeta[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(stories));
  } catch (error) {
    console.warn('Failed to persist history', error);
  }
}

export function useHomeController(): HomeController {
  const { upsertStory, currentStory, setAudioUrl, setPlaylist, setCurrentStoryById, stories } = usePlayer();
  const { ageGroup } = useBabyProfile();
  const [contentType, setContentType] = useState<ContentType>('bedtime-story');
  const [mood, setMood] = useState<MoodType>('happy');
  const [duration, setDuration] = useState<DurationType>('short');
  const [voiceType, setVoiceType] = useState<string>('zh_female_tianmeitaozi_mars_bigtts');
  const [generatedText, setGeneratedText] = useState('');
  const [storyMeta, setStoryMeta] = useState<StoryMeta | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  useEffect(() => {
    const history = loadHistory();
    if (history.length) {
      history.forEach(upsertStory);
    }
  }, [upsertStory]);

  useEffect(() => {
    if (!stories.length) return;
    persistHistory(stories);
  }, [stories]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleGenerateContent = useCallback(async () => {
    setIsGenerating(true);
    try {
      const prompt = buildPrompt(contentType, mood, duration, ageGroup);
      const data = await arkGenerate(prompt, MODEL_DEFAULT);
      const text = cleanTextForReading(data.choices?.[0]?.message?.content || '');
      if (!text) {
        throw new Error('未从模型获取到有效文本');
      }

      const visuals = PLAYER_VISUALS[contentType];
      const id = `generated-${Date.now()}`;
      const summary = createSummary(text);
      const title = visuals.title;

      const meta: StoryMeta = {
        id,
        title,
        summary,
        cover: visuals.cover,
        type: contentType,
        text,
        createdAt: Date.now()
      };

      setGeneratedText(text);
      setStoryMeta(meta);
      setShowResult(true);
      upsertStory(meta);
      setCurrentStoryById(id);
      setIsPreviewReady(false);
      setAudioBlob(null);
      setAudioUrl(undefined, id);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '生成内容失败');
    } finally {
      setIsGenerating(false);
    }
  }, [contentType, mood, duration, ageGroup, upsertStory, setCurrentStoryById, setAudioUrl]);

  const handlePreviewAudio = useCallback(async () => {
    if (!generatedText) {
      alert('请先生成文本内容');
      return;
    }
    setIsPreviewing(true);
    try {
      const snippet = generatedText.slice(0, Math.min(120, generatedText.length));
      const payload: TtsPayload = {
        text: snippet,
        voice_type: voiceType,
        emotion: mood,
        quality: 'draft'
      };
      const response = await ttsSynthesize(payload);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(response.audioUrl);
      setIsPreviewReady(true);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '试听失败');
    } finally {
      setIsPreviewing(false);
    }
  }, [generatedText, voiceType, mood, previewUrl]);

  const handleConfirmPreview = useCallback(() => {
    if (!previewUrl) {
      alert('请先完成试听生成');
      return;
    }
    setIsPreviewReady(true);
  }, [previewUrl]);

  const handleGenerateAudio = useCallback(async () => {
    if (!generatedText || !storyMeta) {
      alert('请先生成文本内容');
      return;
    }

    setIsGeneratingAudio(true);
    try {
      const textLength = generatedText.length;
      let responses;

      if (textLength <= 800) {
        const payload: TtsPayload = {
          text: generatedText,
          voice_type: voiceType,
          emotion: mood,
          quality: 'draft'
        };
        const single = await ttsSynthesize(payload);
        responses = [single];
      } else {
        responses = await synthesizeSegmentedText(generatedText, voiceType, mood, 'draft');
      }

      if (!responses.length) throw new Error('未获得到有效音频');

      setPlaylist(responses, storyMeta.id);
      setStoryMeta((prev) => (prev ? { ...prev, audioUrl: responses[0].audioUrl } : prev));
      const first = responses[0];
      setAudioBlob(first.blob);
      alert('语音生成成功，请前往播放页收听');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : '生成语音失败');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [generatedText, storyMeta, voiceType, mood, setPlaylist]);

  const handleDownloadAudio = useCallback(() => {
    if (!audioBlob) {
      alert('请先生成语音后再下载');
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `早教音频_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp3`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [audioBlob]);

  const hasAudio = useMemo(() => Boolean(currentStory?.audioUrl), [currentStory]);

  return {
    contentType,
    setContentType,
    mood,
    setMood,
    duration,
    setDuration,
    voiceType,
    setVoiceType,
    generatedText,
    isGenerating,
    isPreviewing,
    isGeneratingAudio,
    showResult,
    handleGenerateContent,
    handlePreviewAudio,
    handleConfirmPreview,
    handleGenerateAudio,
    handleDownloadAudio,
    hasAudio,
    storyMeta: storyMeta || currentStory,
    previewUrl,
    isPreviewReady,
    voiceOptions: VOICE_OPTIONS
  };
}
