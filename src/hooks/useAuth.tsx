import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { User, UserRole } from '@/types';
import {
  ApiError, AUTH_TOKEN_KEY, AUTH_USER_KEY, SESSION_EXPIRED_EVENT, apiFetch, clearLegacyAuthStorage, emitAuthChange, getAuthToken, readApiError,
} from '@/lib/api';

export type LoginResult = { ok: true } | { ok: false; message: string };

interface AuthContextType {
  user: User | null;
  /** Bearer token of the current session ('' when signed out). */
  token: string;
  isAuthenticated: boolean;
  /** True while a stored session is being re-validated with the server after a page load. */
  isChecking: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  /** Replaces the signed-in user's details (after a profile edit). Pass null to sign out. */
  updateCurrentUser: (nextUser: User | null) => void;
  /** Stores a new token (the server issues one after a password change). */
  replaceToken: (token: string) => void;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isTeamLeader: boolean;
  isSalesSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readStoredUser = (): User | null => {
  try {
    const stored = window.localStorage.getItem(AUTH_USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
};

/** Written synchronously, so a reload right after signing in (or a second tab) sees the session. */
const writeStorage = (token: string, user: User | null) => {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    else window.localStorage.removeItem(AUTH_TOKEN_KEY);
    if (token && user) window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(AUTH_USER_KEY);
    clearLegacyAuthStorage();
  } catch {
    // storage unavailable (private mode / quota): the session still works until the tab is closed
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(() => (getAuthToken() ? readStoredUser() : null));
  // A token found in storage is re-validated once per page load; until then the cached user is shown.
  const [verifiedToken, setVerifiedToken] = useState('');

  // Another tab signed in/out, or apiFetch ended the session after a 401.
  useEffect(() => {
    const sync = () => {
      const stored = getAuthToken();
      setToken(stored);
      setUser(stored ? readStoredUser() : null);
    };
    const onExpired = () => toast.info('Your session has ended. Please sign in again.');
    window.addEventListener('storage', sync);
    window.addEventListener('mentors-auth-change', sync);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('mentors-auth-change', sync);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  // Re-validate a stored token. Only a 401 ends the session (inside apiFetch); a network error or a 5xx must not
  // sign people out - the data screens show a retry instead.
  useEffect(() => {
    if (!token || verifiedToken === token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const response = await apiFetch('auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (cancelled) return;
        if (response.ok) {
          const payload = await response.json();
          if (!cancelled && payload?.user) {
            setUser(payload.user as User);
            writeStorage(token, payload.user as User);
          }
        }
      } catch {
        // offline: keep the cached session
      }
      if (!cancelled) setVerifiedToken(token);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, verifiedToken]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const response = await apiFetch('auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!response.ok) {
        const error = await readApiError(response);
        // 429 (too many attempts), 403 (disabled account) and 5xx carry a message that tells the person what to do
        return { ok: false, message: error.status === 401 || error.status === 400 ? 'Invalid email or password' : error.message };
      }
      const payload = await response.json();
      if (!payload?.token || !payload?.user) return { ok: false, message: 'The server sent an unexpected answer. Please try again.' };
      const nextToken = String(payload.token);
      writeStorage(nextToken, payload.user as User);
      setVerifiedToken(nextToken);
      setToken(nextToken);
      setUser(payload.user as User);
      emitAuthChange();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : 'Cannot reach the server. Check your connection and try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    writeStorage('', null);
    setToken('');
    setUser(null);
    setVerifiedToken('');
    emitAuthChange();
  }, []);

  const updateCurrentUser = useCallback((nextUser: User | null) => {
    if (!nextUser) {
      logout();
      return;
    }
    setUser((current) => {
      const merged = { ...(current ?? {}), ...nextUser } as User;
      writeStorage(getAuthToken(), merged);
      return merged;
    });
    emitAuthChange();
  }, [logout]);

  const replaceToken = useCallback((nextToken: string) => {
    writeStorage(nextToken, readStoredUser());
    setVerifiedToken(nextToken);
    setToken(nextToken);
    emitAuthChange();
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => Boolean(user && roles.includes(user.role)), [user]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isChecking: Boolean(token) && verifiedToken !== token,
    login,
    logout,
    updateCurrentUser,
    replaceToken,
    hasRole,
    isAdmin: user?.role === 'admin' || user?.role === 'franchise_owner',
    isAgent: user?.role === 'agent',
    isTeamLeader: user?.role === 'team_leader',
    isSalesSupervisor: user?.role === 'sales_supervisor',
  }), [user, token, verifiedToken, login, logout, updateCurrentUser, replaceToken, hasRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
