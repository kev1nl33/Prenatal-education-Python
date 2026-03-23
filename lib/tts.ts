import { getAuthTokenAsync } from '@/lib/auth';
import { API_BASE } from '@/lib/apiClient';
import { parseTtsFetchResponse, ParsedTtsResponse } from '@/lib/ttsParser';

export interface TtsPayload {
  text: string;
  voice_type: string;
  emotion?: string;
  quality?: 'draft' | 'standard' | 'hq';
}

export type TtsProgressCallback = (current: number, total: number, message: string) => void;

export async function ttsSynthesize(payload: TtsPayload): Promise<ParsedTtsResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Auth-Token': await getAuthTokenAsync()
  };

  const response = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  return parseTtsFetchResponse(response);
}

export function segmentText(text: string, maxLength = 800): string[] {
  if (!text || text.length <= maxLength) {
    return [text];
  }

  const segments: string[] = [];
  const sentences = text.split(/[。！？；\n]/);
  let currentSegment = '';

  for (let sentence of sentences) {
    sentence = sentence.trim();
    if (!sentence) continue;

    if (sentence.length > maxLength) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
        currentSegment = '';
      }
      const parts = sentence.split('，');
      let tempSegment = '';
      for (const part of parts) {
        if ((tempSegment + part).length > maxLength) {
          if (tempSegment) {
            segments.push(tempSegment.trim());
          }
          tempSegment = part;
        } else {
          tempSegment += (tempSegment ? '，' : '') + part;
        }
      }
      if (tempSegment) {
        segments.push(tempSegment.trim());
      }
      continue;
    }

    const testSegment = currentSegment + (currentSegment ? '。' : '') + sentence;
    if (testSegment.length > maxLength && currentSegment) {
      segments.push(currentSegment.trim());
      currentSegment = sentence;
    } else {
      currentSegment = testSegment;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter(Boolean);
}

export async function synthesizeSegmentedText(
  text: string,
  voiceType: string,
  emotion: string = 'neutral',
  quality: 'draft' | 'standard' | 'hq' = 'draft',
  onProgress?: TtsProgressCallback
): Promise<ParsedTtsResponse[]> {
  const segments = segmentText(text, 800);
  const audioSegments: ParsedTtsResponse[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (onProgress) {
      onProgress(i + 1, segments.length, `正在生成第 ${i + 1}/${segments.length} 段语音...`);
    }

    const payload: TtsPayload = {
      text: segment,
      voice_type: voiceType,
      emotion,
      quality
    };

    const result = await ttsSynthesize(payload);
    audioSegments.push(result);

    if (i < segments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return audioSegments;
}
