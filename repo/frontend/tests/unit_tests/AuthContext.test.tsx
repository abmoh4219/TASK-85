import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const { getMock, postMock, headers } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  headers: {} as Record<string, string>,
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    defaults: { headers: { common: headers } },
  },
  tokenStorage: {
    saveRefresh: vi.fn((userId: string, token: string) => {
      localStorage.setItem('mm_user_id', userId);
      localStorage.setItem('mm_refresh_token', token);
    }),
    getRefresh: () => ({
      userId: localStorage.getItem('mm_user_id'),
      refreshToken: localStorage.getItem('mm_refresh_token'),
    }),
    clear: vi.fn(() => {
      localStorage.removeItem('mm_user_id');
      localStorage.removeItem('mm_refresh_token');
    }),
  },
}));

import { AuthProvider, useAuth } from '@/features/auth/AuthContext';

function Probe() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="auth">{isAuthenticated ? 'yes' : 'no'}</span>
      <span data-testid="user">{user?.username ?? 'none'}</span>
      <button onClick={() => login('admin', 'pw').catch(() => {})}>do-login</button>
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

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    getMock.mockReset();
    postMock.mockReset();
    for (const k of Object.keys(headers)) delete headers[k];
  });

  it('settles to unauthenticated when no tokens are stored', async () => {
    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login sets user and authenticated flag', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'acc', refreshToken: 'ref', userId: 'u1' } },
    });
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u1', username: 'admin', role: 'admin', isActive: true } },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-login').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));
    expect(screen.getByTestId('user')).toHaveTextContent('admin');
    expect(headers.Authorization).toBe('Bearer acc');
  });

  it('login failure leaves state unauthenticated', async () => {
    postMock.mockRejectedValueOnce(new Error('bad creds'));

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-login').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('logout clears user state', async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'acc', refreshToken: 'ref', userId: 'u1' } },
    });
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u1', username: 'admin', role: 'admin', isActive: true } },
    });
    // logout post
    postMock.mockResolvedValueOnce({ data: { data: {} } });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));

    await act(async () => {
      screen.getByText('do-login').click();
    });
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('yes'));

    await act(async () => {
      screen.getByText('do-logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('no'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('auto-restores session from stored refresh token', async () => {
    localStorage.setItem('mm_user_id', 'u1');
    localStorage.setItem('mm_refresh_token', 'ref');
    postMock.mockResolvedValueOnce({
      data: { data: { accessToken: 'acc', refreshToken: 'ref2' } },
    });
    getMock.mockResolvedValueOnce({
      data: { data: { id: 'u1', username: 'supervisor', role: 'supervisor', isActive: true } },
    });

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('auth')).toHaveTextContent('yes');
    expect(screen.getByTestId('user')).toHaveTextContent('supervisor');
  });

  it('gracefully fails when stored refresh token is rejected', async () => {
    localStorage.setItem('mm_user_id', 'u1');
    localStorage.setItem('mm_refresh_token', 'ref');
    postMock.mockRejectedValueOnce(new Error('expired'));

    renderWithProvider();
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('no'));
    expect(screen.getByTestId('auth')).toHaveTextContent('no');
  });
});
