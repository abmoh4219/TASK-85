import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ── Token storage helpers ─────────────────────────────────────────────────
const REFRESH_TOKEN_KEY = 'mm_refresh_token';
const USER_ID_KEY = 'mm_user_id';

export const tokenStorage = {
  saveRefresh: (userId: string, token: string) => {
    localStorage.setItem(USER_ID_KEY, userId);
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  getRefresh: () => ({
    userId: localStorage.getItem(USER_ID_KEY),
    refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  }),
  clear: () => {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

// ── Auto-refresh interceptor ──────────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for auth endpoints to avoid loops
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { userId, refreshToken } = tokenStorage.getRefresh();
        if (!userId || !refreshToken) throw new Error('No refresh token stored');

        const response = await apiClient.post('/auth/refresh', { userId, refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
        tokenStorage.saveRefresh(userId, newRefreshToken);
        processQueue(null, accessToken);
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err, null);
        tokenStorage.clear();
        delete apiClient.defaults.headers.common['Authorization'];
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
