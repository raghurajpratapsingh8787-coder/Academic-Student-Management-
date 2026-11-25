import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAccessToken } from '../services/api';
import type { AuthUser, InstitutionSettings } from '../types';

interface AuthContextValue {
  user: AuthUser | null;
  needsSetup: boolean;
  loading: boolean;
  settings: InstitutionSettings | null;
  login: (email: string, password: string) => Promise<void>;
  setupFirstAdmin: (payload: {
    name: string;
    email: string;
    password: string;
    seedSampleData: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InstitutionSettings | null>(null);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiRequest<{ settings: InstitutionSettings }>('/api/settings');
      setSettings(res.settings);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const status = await apiRequest<{ needsSetup: boolean; hasSession?: boolean }>('/api/auth/status', {
          skipAuthRefresh: true,
        });
        if (!active) return;
        setNeedsSetup(status.needsSetup);
        if (!status.needsSetup && status.hasSession) {
          try {
            const refreshed = await apiRequest<{ accessToken: string; user: AuthUser }>('/api/auth/refresh', {
              method: 'POST',
              skipAuthRefresh: true,
            });
            if (!active) return;
            setAccessToken(refreshed.accessToken);
            setUser(refreshed.user);
            const sRes = await apiRequest<{ settings: InstitutionSettings }>('/api/settings');
            if (active) setSettings(sRes.settings);
          } catch {
            setAccessToken(null);
            if (active) setUser(null);
          }
        }
      } catch {
        // ignore network error on initial probe
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiRequest<{ accessToken: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setNeedsSetup(false);
    await refreshSettings();
  };

  const setupFirstAdmin = async (payload: {
    name: string;
    email: string;
    password: string;
    seedSampleData: boolean;
  }) => {
    const res = await apiRequest<{ accessToken: string; user: AuthUser }>('/api/auth/setup', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRefresh: true,
    });
    setAccessToken(res.accessToken);
    setUser(res.user);
    setNeedsSetup(false);
    await refreshSettings();
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipAuthRefresh: true });
    } catch {
      // proceed with local state clear
    }
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        needsSetup,
        loading,
        settings,
        login,
        setupFirstAdmin,
        logout,
        refreshUser,
        refreshSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
