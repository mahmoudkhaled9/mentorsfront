const DEFAULT_API_BASE = 'http://localhost:4001/api';

export const AUTH_TOKEN_KEY = 'mentors_auth_token';
export const AUTH_USER_KEY = 'mentors_auth_user';
const LEGACY_AUTH_KEYS = ['tcrs_auth_user', 'tcrs_auth_token'];

export function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return;
  LEGACY_AUTH_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function getApiBase() {
  return (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') || DEFAULT_API_BASE;
}

export function getAuthToken() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function getAuthHeaders(init?: HeadersInit) {
  const headers = new Headers(init ?? {});
  if (!headers.has('Authorization')) {
    const token = getAuthToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export function emitAuthChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('mentors-auth-change'));
}

/** Fired when the server says the session is over (expired, revoked, account disabled). */
export const SESSION_EXPIRED_EVENT = 'mentors-session-expired';

/** Clears the stored session and tells the app (AuthProvider listens) that the person is signed out. */
export function endSession() {
  if (typeof window === 'undefined') return;
  const hadToken = Boolean(getAuthToken());
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    clearLegacyAuthStorage();
  } catch {
    // storage unavailable - the in-memory state is cleared by the listeners
  }
  emitAuthChange();
  if (hadToken) window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/** An error from the API (or from reaching it). `status` 0 means the server could not be reached at all. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** field name -> message, from the server's validation `details`; lets forms mark the offending input. */
  readonly fieldErrors: Record<string, string>;
  readonly retryAfterSec?: number;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, extra: { fieldErrors?: Record<string, string>; retryAfterSec?: number; requestId?: string } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = extra.fieldErrors ?? {};
    this.retryAfterSec = extra.retryAfterSec;
    this.requestId = extra.requestId;
  }
}

const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  400: 'The request was not accepted. Please check the entered values.',
  401: 'Your session has ended. Please sign in again.',
  403: 'You do not have permission to do this.',
  404: 'This record no longer exists or you cannot access it.',
  409: 'This conflicts with existing data.',
  413: 'The data you are sending is too large.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'The server had a problem. Please try again.',
  503: 'The service is busy. Please try again in a moment.',
};

/** Turns a non-OK response into an ApiError (never throws while doing so). */
export async function readApiError(response: Response): Promise<ApiError> {
  let payload: { error?: string; code?: string; details?: unknown; requestId?: string } = {};
  let isJson = true;
  try {
    payload = await response.json();
  } catch {
    // not JSON (proxy error page, empty body)
    isJson = false;
  }
  if (response.status === 404 && !isJson) {
    // Express's own "Cannot GET ..." page: the route does not exist on the running server
    return new ApiError(404, 'ENDPOINT_MISSING', 'The server does not offer this feature yet. The running backend is probably an older version: restart it (npm start in yourmentorsapp).');
  }
  const fieldErrors: Record<string, string> = {};
  if (Array.isArray(payload.details)) {
    for (const d of payload.details as { field?: string; message?: string }[]) {
      if (d?.field && d.message && !fieldErrors[d.field]) fieldErrors[d.field] = d.message;
    }
  }
  const retry = Number(response.headers.get('Retry-After'));
  const message = payload.error || DEFAULT_MESSAGES[response.status] || DEFAULT_MESSAGES[response.status >= 500 ? 500 : 400];
  return new ApiError(response.status, payload.code ?? `HTTP_${response.status}`, message, {
    fieldErrors, retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : undefined, requestId: payload.requestId,
  });
}

/** A short, human message for any error (ApiError, network failure, unexpected). */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return DEFAULT_MESSAGES[0];
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

/**
 * fetch() against the API with the stored token. A 401 on an authenticated request ends the session (the app shows the
 * sign-in page). Network failures throw an ApiError with status 0.
 */
export async function apiFetch(path: string, init?: RequestInit) {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const headers = getAuthHeaders(init?.headers);
  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/${normalizedPath}`, { ...init, cache: 'no-store', headers });
  } catch {
    throw new ApiError(0, 'NETWORK', `Cannot reach the server at ${getApiBase()}. Make sure the backend is running, then try again.`);
  }
  const sentToken = headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (response.status === 401 && sentToken && normalizedPath !== 'auth/login' && sentToken === getAuthToken()) {
    endSession();
  }
  return response;
}
