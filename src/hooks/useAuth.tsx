import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { apiFetch, emitAuthChange, getAuthToken, AUTH_TOKEN_KEY, AUTH_USER_KEY, clearLegacyAuthStorage } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (nextUser: User | null) => void;
  hasRole: (roles: UserRole[]) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isTeamLeader: boolean;
  isSalesSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const readStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(AUTH_USER_KEY);
    return stored ? (JSON.parse(stored) as User) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => getAuthToken());
  const [user, setUser] = useState<User | null>(() => {
    const storedToken = getAuthToken();
    return storedToken ? readStoredUser() : null;
  });

  const updateCurrentUser = useCallback((nextUser: User | null) => {
    setUser((currentUser) => {
      const mergedUser = nextUser ? { ...(currentUser ?? {}), ...nextUser } : null;

      if (typeof window !== 'undefined') {
        if (mergedUser) {
          window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(mergedUser));
        } else {
          window.localStorage.removeItem(AUTH_USER_KEY);
        }
        emitAuthChange();
      }

      return mergedUser;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const syncAuthState = () => {
      setToken(getAuthToken());
      setUser(readStoredUser());
    };
    syncAuthState();
    window.addEventListener('storage', syncAuthState);
    window.addEventListener('mentors-auth-change', syncAuthState as EventListener);
    return () => {
      window.removeEventListener('storage', syncAuthState);
      window.removeEventListener('mentors-auth-change', syncAuthState as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (!token) {
        window.localStorage.removeItem(AUTH_USER_KEY);
        clearLegacyAuthStorage();
      }
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      emitAuthChange();
    } catch {
      // Ignore storage errors
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (user) {
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(AUTH_USER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [user]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;

    const verifySession = async () => {
      try {
        const response = await apiFetch('auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw Object.assign(new Error('Session not found'), { status: response.status });
          }
          return;
        }

        const payload = await response.json();
        const nextUser = payload?.user ?? payload ?? null;
        if (!cancelled && nextUser) {
          setUser(nextUser);
        }
      } catch (error) {
        if (!cancelled) {
          const status = (error as { status?: number } | undefined)?.status;
          if (status !== undefined && status !== 401 && status !== 403) {
            return;
          }
          setToken('');
          setUser(null);
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(AUTH_TOKEN_KEY);
            window.localStorage.removeItem(AUTH_USER_KEY);
            clearLegacyAuthStorage();
            emitAuthChange();
          }
        }
      }
    };

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      const response = await apiFetch('auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      const userFromResponse = payload?.user ?? null;
      const tokenFromResponse = payload?.token ?? '';

      if (tokenFromResponse && userFromResponse) {
        setToken(String(tokenFromResponse));
        setUser(userFromResponse as User);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(AUTH_USER_KEY);
      clearLegacyAuthStorage();
      emitAuthChange();
    }
  }, []);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'admin' || user?.role === 'franchise_owner';
  const isAgent = user?.role === 'agent';
  const isTeamLeader = user?.role === 'team_leader';
  const isSalesSupervisor = user?.role === 'sales_supervisor';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        updateCurrentUser,
        hasRole,
        isAdmin,
        isAgent,
        isTeamLeader,
        isSalesSupervisor,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
