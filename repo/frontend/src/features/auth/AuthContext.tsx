import React, { createContext, useContext, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'supervisor' | 'hr' | 'employee';
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setTokens: (accessToken: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setTokens = useCallback((token: string, userData: User) => {
    setAccessToken(token);
    setUser(userData);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', { username, password });
      const { accessToken: token, user: userData } = response.data.data;
      setTokens(token, userData);
    } finally {
      setIsLoading(false);
    }
  }, [setTokens]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // ignore errors on logout
    } finally {
      setUser(null);
      setAccessToken(null);
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        setTokens,
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
