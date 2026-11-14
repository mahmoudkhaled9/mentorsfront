import { useEffect, useState } from 'react';

/**
 * useState that is remembered in this browser (localStorage) - for view preferences only (visible columns, page size).
 * Falls back to plain state when storage is unavailable (private mode, quota). Stored values are merged over the default
 * so new keys added later get their default.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as T;
      if (initial && typeof initial === 'object' && !Array.isArray(initial) && parsed && typeof parsed === 'object') {
        return { ...initial, ...parsed };
      }
      return typeof parsed === typeof initial ? parsed : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  }, [key, value]);
  return [value, setValue] as const;
}
