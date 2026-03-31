import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { apiFetch, emitAuthChange, getAuthToken } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
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
    const stored = window.localStorage.getItem('tcrs_auth_user');
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
        window.localStorage.removeItem('tcrs_auth_user');
      }
      if (token) {
        window.localStorage.setItem('mentors_auth_token', token);
      } else {
        window.localStorage.removeItem('mentors_auth_token');
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
        window.localStorage.setItem('tcrs_auth_user', JSON.stringify(user));
      } else {
        window.localStorage.removeItem('tcrs_auth_user');
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
          throw new Error('Session not found');
        }
        const payload = await response.json();
        if (!cancelled) {
          setUser(payload.user ?? null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
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
      const response = await apiFetch('auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json();
      if (payload?.token && payload?.user) {
        setToken(String(payload.token));
        setUser(payload.user as User);
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
