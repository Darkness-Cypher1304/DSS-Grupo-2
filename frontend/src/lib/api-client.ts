// ============================================================================
// API Client
// ============================================================================
// Wrapper sobre fetch con:
//   - Bearer token automático (desde sessionStorage / memoria)
//   - Refresh automático en 401 (usa cookie HttpOnly del refresh)
//   - Manejo unificado de errores
// ============================================================================

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Token en memoria (no en localStorage por seguridad)
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Listeners para reaccionar a cambios de token (ej. cierre de sesión)
type AuthListener = (token: string | null) => void;
const listeners = new Set<AuthListener>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((l) => l(token));
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onAuthChange(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ----------------------------------------------------------------------------
// Instancia de axios
// ----------------------------------------------------------------------------
export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true, // envía cookies (refresh token)
  timeout: 30000,
});

// Interceptor de request: añadir Bearer
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Interceptor de response: refresh automático en 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      original._retry = true;

      try {
        const newToken = await refreshAccessToken();
        if (newToken && original.headers) {
          original.headers.Authorization = `Bearer ${newToken}`;
          return api(original);
        }
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(error);
  },
);

// ----------------------------------------------------------------------------
// Refresh
// ----------------------------------------------------------------------------
async function refreshAccessToken(): Promise<string | null> {
  // Deduplicación: si ya hay un refresh en curso, esperarlo
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await axios.post<{ data: { accessToken: string } }>(
        `${API_BASE}/api/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const newToken = res.data?.data?.accessToken;
      if (newToken) {
        setAccessToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ----------------------------------------------------------------------------
// Helper para extraer .data.data automáticamente (TransformInterceptor del back)
// ----------------------------------------------------------------------------
export async function apiGet<T>(url: string): Promise<T> {
  const res = await api.get<{ data: T }>(url);
  return res.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post<{ data: T }>(url, body);
  return res.data.data;
}

export async function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.patch<{ data: T }>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await api.delete<{ data: T }>(url);
  return res.data.data;
}

// ----------------------------------------------------------------------------
// Tipos compartidos con el backend
// ----------------------------------------------------------------------------
export type UserRole = 'PARENT' | 'SPECIALIST' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  emailVerified: boolean;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}
