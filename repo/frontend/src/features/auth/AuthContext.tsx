import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiClient, tokenStorage } from '@/lib/api-client';

export type UserRole = 'admin' | 'supervisor' | 'hr' | 'employee';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session using stored refresh token
  useEffect(() => {
    const restore = async () => {
      const { userId, refreshToken } = tokenStorage.getRefresh();
      if (!userId || !refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const refreshRes = await apiClient.post('/auth/refresh', { userId, refreshToken });
        const { accessToken, refreshToken: newRefresh } = refreshRes.data.data;
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        tokenStorage.saveRefresh(userId, newRefresh);

        const meRes = await apiClient.get('/auth/me');
        setUser(meRes.data.data);
      } catch {
        tokenStorage.clear();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiClient.post('/auth/login', { username, password });
    const { accessToken, refreshToken, userId } = response.data.data;

    apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    tokenStorage.saveRefresh(userId, refreshToken);

    const meRes = await apiClient.get('/auth/me');
    setUser(meRes.data.data);
  }, []);

  const logout = useCallback(async () => {
    const { userId, refreshToken } = tokenStorage.getRefresh();
    try {
      if (userId && refreshToken) {
        await apiClient.post('/auth/logout', { userId, refreshToken });
      }
    } catch {
      // ignore errors on logout
    } finally {
      setUser(null);
      tokenStorage.clear();
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
