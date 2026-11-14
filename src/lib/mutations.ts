import { apiFetch, readApiError } from './api';

type JsonRequestInit = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown;
  headers?: HeadersInit;
};

/** JSON request to the API. Resolves with the parsed body; rejects with an ApiError carrying the server's message. */
export async function jsonRequest<T = unknown>(path: string, init: JsonRequestInit = {}): Promise<T> {
  const { body, headers, ...rest } = init;
  const response = await apiFetch(path, {
    ...rest,
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await readApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
