const DEFAULT_API_BASE = 'http://localhost:4001/api';

export const AUTH_TOKEN_KEY = 'mentors_auth_token';
export const AUTH_USER_KEY = 'mentors_auth_user';
const LEGACY_AUTH_KEYS = ['tcrs_auth_user', 'tcrs_auth_token'];

export function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  LEGACY_AUTH_KEYS.forEach((key) => {
    window.localStorage.removeItem(key);
  });
}

export function getApiBase() {
  return (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || DEFAULT_API_BASE;
}

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
}

export function getAuthHeaders(init?: HeadersInit) {
  const headers = new Headers(init ?? {});
  if (!headers.has('Authorization')) {
    const token = getAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  return headers;
}

export async function apiFetch(path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return fetch(`${getApiBase()}/${normalizedPath}`, {
    ...init,
    cache: 'no-store',
    headers: getAuthHeaders(init?.headers),
  });
}

export function emitAuthChange() {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event('mentors-auth-change'));
}
