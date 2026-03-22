import type { AgeGroup } from '@/components/providers/BabyProfileProvider';

export interface MusicTrack {
  id: string;
  title: string;
  composer: string;
  audioUrl: string;
  category: 'mozart' | 'bach' | 'vivaldi' | 'lullaby' | 'nature-sounds';
  mood: 'calm' | 'playful' | 'sleep';
  ageGroup: AgeGroup[];
  duration: string;
}

export const MUSIC_CATEGORIES = [
  { key: 'mozart' as const, icon: '', label: '莫扎特' },
  { key: 'bach' as const, icon: '', label: '巴赫' },
  { key: 'vivaldi' as const, icon: '', label: '维瓦尔第' },
  { key: 'lullaby' as const, icon: '', label: '摇篮曲' },
  { key: 'nature-sounds' as const, icon: '', label: '自然声音' },
];

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: 'mozart-k525',
    title: '小夜曲 K.525 第一乐章',
    composer: '莫扎特',
    audioUrl: '/audio/mozart-k525.mp3',
    category: 'mozart',
    mood: 'playful',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '5′30″'
  },
  {
    id: 'mozart-k448',
    title: '双钢琴奏鸣曲 K.448',
    composer: '莫扎特',
    audioUrl: '/audio/mozart-k448.mp3',
    category: 'mozart',
    mood: 'playful',
    ageGroup: ['4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '4′15″'
  },
  {
    id: 'bach-air',
    title: 'G弦上的咏叹调',
    composer: '巴赫',
    audioUrl: '/audio/bach-air.mp3',
    category: 'bach',
    mood: 'calm',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '4′50″'
  },
  {
    id: 'bach-cello-suite',
    title: '大提琴组曲第一号',
    composer: '巴赫',
    audioUrl: '/audio/bach-cello-suite.mp3',
    category: 'bach',
    mood: 'calm',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '3′20″'
  },
  {
    id: 'vivaldi-spring',
    title: '四季·春 第一乐章',
    composer: '维瓦尔第',
    audioUrl: '/audio/vivaldi-spring.mp3',
    category: 'vivaldi',
    mood: 'playful',
    ageGroup: ['4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '3′30″'
  },
  {
    id: 'brahms-lullaby',
    title: '勃拉姆斯摇篮曲',
    composer: '勃拉姆斯',
    audioUrl: '/audio/brahms-lullaby.mp3',
    category: 'lullaby',
    mood: 'sleep',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '4′10″'
  },
  {
    id: 'schubert-lullaby',
    title: '舒伯特摇篮曲',
    composer: '舒伯特',
    audioUrl: '/audio/schubert-lullaby.mp3',
    category: 'lullaby',
    mood: 'sleep',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '3′45″'
  },
  {
    id: 'nature-rain',
    title: '轻柔雨声',
    composer: '自然录音',
    audioUrl: '/audio/nature-rain.mp3',
    category: 'nature-sounds',
    mood: 'sleep',
    ageGroup: ['0-3', '4-6', '7-9', '10-12'],
    duration: '5′00″'
  },
  {
    id: 'nature-ocean',
    title: '海浪声',
    composer: '自然录音',
    audioUrl: '/audio/nature-ocean.mp3',
    category: 'nature-sounds',
    mood: 'calm',
    ageGroup: ['0-3', '4-6', '7-9', '10-12', '13-18', '19-24', '25-36'],
    duration: '5′00″'
  },
];

export function filterByAge(tracks: MusicTrack[], ageGroup: AgeGroup): MusicTrack[] {
  return tracks.filter((t) => t.ageGroup.includes(ageGroup));
}

export function filterByCategory(tracks: MusicTrack[], category: string): MusicTrack[] {
  if (category === 'all') return tracks;
  return tracks.filter((t) => t.category === category);
}
