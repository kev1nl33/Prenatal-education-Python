import { getAuthTokenAsync } from '@/lib/auth';
import { API_BASE } from '@/lib/apiClient';

export interface ArkChoice {
  index: number;
  finish_reason?: string;
  message: {
    role: string;
    content: string;
  };
}

export interface ArkResponse {
  id?: string;
  choices: ArkChoice[];
  usage?: Record<string, unknown>;
}

export async function arkGenerate(prompt: string, model: string): Promise<ArkResponse> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Auth-Token': await getAuthTokenAsync()
  };

  const response = await fetch(`${API_BASE}/api/ark`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model }),
    cache: 'no-store'
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const data = await response.clone().json();
      detail = data?.error || data?.message || detail;
    } catch (error) {
      // ignore
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as ArkResponse;
  if (!data?.choices?.length || !data.choices[0]?.message?.content) {
    throw new Error('API响应格式错误：缺少有效的生成内容');
  }
  return data;
}
