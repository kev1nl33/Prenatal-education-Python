const TOKEN_STORAGE_KEY = 've_auth_token';

export function getAuthToken(): string {
  if (typeof window === 'undefined') {
    return 'demo-token-2024';
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) || 'demo-token-2024';
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export async function getAuthTokenAsync(): Promise<string> {
  return getAuthToken();
}
