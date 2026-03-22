const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function normalizeBaseUrl(value: string): string {
  if (!value) return '';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export const API_BASE = normalizeBaseUrl(RAW_API_BASE);

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    cache: 'no-store',
    ...init
  });

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const data = await response.clone().json();
      detail = data?.error || data?.message || detail;
    } catch (error) {
      // ignore json parse errors
    }
    throw new Error(`${detail} (request: ${url})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  // fallback to text for debug
  const text = await response.text();
  return JSON.parse(text) as T;
}
