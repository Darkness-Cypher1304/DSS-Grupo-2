'use client';

// ============================================================================
// AuthContext
// ============================================================================
// Maneja el estado del usuario autenticado en toda la app.
// Al cargar, intenta refresh con la cookie HttpOnly automáticamente.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  api,
  apiPost,
  setAccessToken,
  type AuthUser,
  type LoginResponse,
} from './api-client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Al montar, intentamos refresh para retomar sesión
  useEffect(() => {
    void (async () => {
      try {
        const result = await apiPost<LoginResponse>('/auth/refresh');
        if (result?.accessToken) {
          setAccessToken(result.accessToken);
          setUser(result.user);
        }
      } catch {
        // Sin sesión activa
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiPost<LoginResponse>('/auth/login', { email, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    return apiPost<{ message: string }>('/auth/register', data);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Aunque falle, limpiar estado local
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await apiPost<LoginResponse>('/auth/refresh');
      if (result?.accessToken) {
        setAccessToken(result.accessToken);
        setUser(result.user);
      }
    } catch {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
