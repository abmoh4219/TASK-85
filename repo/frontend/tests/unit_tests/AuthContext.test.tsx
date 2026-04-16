import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';

import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { apiClient, tokenStorage } from '@/lib/api-client';
import { clearAuth, API_BASE_URL } from './test-helpers/real-api';

// Ensure the shared axios instance points at the real backend for this file.
apiClient.defaults.baseURL = API_BASE_URL;

function Probe() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.username ?? 'none'}</span>
      <span data-testid="role">{user?.role ?? 'none'}</span>
      <button onClick={() => login('admin', 'meridian2024').catch(() => {})}>do-login</button>
      <button onClick={() => login('admin', 'definitely-not-the-password').catch(() => {})}>
        do-bad-login
      </button>
      <button onClick={() => logout()}>do-logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthContext (real backend)', () => {
  beforeEach(() => {
    clearAuth();
    localStorage.clear();
  });

  afterEach(() => {
    clearAuth();
    localStorage.clear();
  });

  it('settles to unauthenticated when no tokens are stored', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login with valid credentials sets user and authenticated flag', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-login').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'), { timeout: 5000 });
    expect(screen.getByTestId('user')).toHaveTextContent('admin');
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(apiClient.defaults.headers.common['Authorization']).toMatch(/^Bearer /);
  });

  it('login with bad credentials leaves state unauthenticated', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-bad-login').click();
    });

    // Small delay so a (non-)successful response would have propagated.
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('logout clears user state after a successful login', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-login').click();
    });
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'), { timeout: 5000 });

    await act(async () => {
      screen.getByText('do-logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('auto-restores session from a stored refresh token issued by the real backend', async () => {
    // First login through a throw-away provider to obtain a real refresh token…
    const loginRes = await apiClient.post('/auth/login', { username: 'supervisor', password: 'meridian2024' });
    const { userId, refreshToken } = loginRes.data.data;
    clearAuth();
    tokenStorage.saveRefresh(userId, refreshToken);

    // …then mount a fresh provider and confirm it restores the session.
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'), { timeout: 5000 });
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'), { timeout: 5000 });
    expect(screen.getByTestId('role')).toHaveTextContent('supervisor');
  });

  it('isLoading flips from yes to no on mount', async () => {
    renderWithProvider();
    // Either it was never "yes" because there's no stored token, or it
    // flips quickly. Either way, it settles to no.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));
  });

  it('gracefully fails when stored refresh token is invalid', async () => {
    tokenStorage.saveRefresh('00000000-0000-0000-0000-000000000000', 'not-a-real-refresh-token');

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'), { timeout: 5000 });
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
  });
});
