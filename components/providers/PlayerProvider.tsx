'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode
} from 'react';
import type { ParsedTtsResponse } from '@/lib/ttsParser';

export type StoryMeta = {
  id: string;
  title: string;
  summary: string;
  cover?: string;
  type?: string;
  text?: string;
  createdAt?: number;
  audioUrl?: string;
};

export interface PlayerContextValue {
  stories: StoryMeta[];
  currentStory?: StoryMeta;
  audioUrl?: string;
  isPlaying: boolean;
  setStories: (stories: StoryMeta[]) => void;
  upsertStory: (story: StoryMeta) => void;
  setCurrentStoryById: (id: string) => void;
  setAudioUrl: (url?: string, storyId?: string) => void;
  play: () => void;
  pause: () => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  setIsPlaying: (next: boolean) => void;
  setPlaylist: (segments: ParsedTtsResponse[], storyId: string) => void;
  currentSegmentIndex: number;
  hasPlaylist: boolean;
}

const PlayerContext = createContext<PlayerContextValue | undefined>(undefined);

const STORAGE_KEY = 've_story_registry';

function loadStoriesFromStorage(): StoryMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('Failed to parse story registry', error);
    return [];
  }
}

function persistStories(stories: StoryMeta[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
  } catch (error) {
    console.warn('Failed to persist story registry', error);
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [stories, setStoriesState] = useState<StoryMeta[]>([]);
  const [currentStoryId, setCurrentStoryId] = useState<string | undefined>(undefined);
  const [audioUrl, setAudioUrlState] = useState<string | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioPlaylist, setAudioPlaylist] = useState<ParsedTtsResponse[] | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [playlistStoryId, setPlaylistStoryId] = useState<string | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const initial = loadStoriesFromStorage();
    if (initial.length) {
      setStoriesState(initial);
    }
  }, []);

  useEffect(() => {
    if (stories.length) {
      persistStories(stories);
    }
  }, [stories]);

  const currentStory = useMemo(() => {
    if (!currentStoryId) return undefined;
    return stories.find((story) => story.id === currentStoryId);
  }, [stories, currentStoryId]);

  const setStories = useCallback((nextStories: StoryMeta[]) => {
    setStoriesState(nextStories);
  }, []);

  const upsertStory = useCallback((story: StoryMeta) => {
    setStoriesState((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === story.id);
      if (existingIndex === -1) {
        return [...prev, story];
      }
      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...story };
      return next;
    });
    setCurrentStoryId(story.id);
  }, []);

  const setCurrentStoryById = useCallback((id: string) => {
    setCurrentStoryId(id);
  }, []);

  const setAudioUrl = useCallback((url?: string, storyId?: string) => {
    setAudioUrlState((prev) => {
      // 只对 blob URL 执行 revoke，预置音频路径不需要
      if (prev && prev !== url && prev.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return url;
    });
    setIsPlaying(false);

    if (url && storyId) {
      setStoriesState((prev) => {
        const index = prev.findIndex((item) => item.id === storyId);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], audioUrl: url };
        return next;
      });
    }
  }, []);

  const setPlaylist = useCallback((segments: ParsedTtsResponse[], storyId: string) => {
    if (!segments.length) {
      setAudioPlaylist(null);
      setPlaylistStoryId(undefined);
      return;
    }
    setAudioPlaylist(segments);
    setPlaylistStoryId(storyId);
    setCurrentSegmentIndex(0);
    setAudioUrl(segments[0].audioUrl, storyId);
  }, [setAudioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (audioPlaylist && audioPlaylist.length > 1) {
        const nextIndex = currentSegmentIndex + 1;
        if (nextIndex < audioPlaylist.length) {
          const nextSegment = audioPlaylist[nextIndex];
          setCurrentSegmentIndex(nextIndex);
          setAudioUrl(nextSegment.audioUrl, playlistStoryId);
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch(() => undefined);
            }
          }, 0);
          return;
        }
      }
      setIsPlaying(false);
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioPlaylist, currentSegmentIndex, playlistStoryId, setAudioUrl]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    void audio.play();
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const contextValue: PlayerContextValue = useMemo(() => ({
    stories,
    currentStory,
    audioUrl,
    isPlaying,
    setStories,
    upsertStory,
    setCurrentStoryById,
    setAudioUrl,
    play,
    pause,
    audioRef,
    setIsPlaying,
    setPlaylist,
    currentSegmentIndex,
    hasPlaylist: Boolean(audioPlaylist && audioPlaylist.length > 1)
  }), [stories, currentStory, audioUrl, isPlaying, setStories, upsertStory, setCurrentStoryById, setAudioUrl, play, pause, audioPlaylist, currentSegmentIndex, setPlaylist]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer 必须在 PlayerProvider 内使用');
  }
  return context;
}
