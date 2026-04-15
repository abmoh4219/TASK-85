import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

import { UsersPage } from '@/features/admin/UsersPage';
import { renderWithProviders } from './test-helpers';

describe('UsersPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders heading and empty state with no users', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<UsersPage />);
    expect(screen.getByRole('heading', { name: /user management/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^no users$/i)).toBeInTheDocument());
  });

  it('renders user rows from API', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'u1',
            username: 'alice',
            role: 'supervisor',
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
    expect(screen.getByText(/never/i)).toBeInTheDocument();
  });

  it('opens new-user form', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /new user/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new user/i }));
    expect(screen.getByPlaceholderText('username')).toBeInTheDocument();
  });

  it('opens edit-role panel when Edit Role is clicked', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 'u1', username: 'bob', role: 'employee', isActive: true, lastLoginAt: null, createdAt: new Date().toISOString() },
        ],
      },
    });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(screen.getByText('bob')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /edit role/i }));
    await waitFor(() => expect(screen.getByText(/edit role: bob/i)).toBeInTheDocument());
  });

  it('shows Reactivate button for inactive user', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 'u1', username: 'carol', role: 'hr', isActive: false, lastLoginAt: null, createdAt: new Date().toISOString() },
        ],
      },
    });
    renderWithProviders(<UsersPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /reactivate/i })).toBeInTheDocument());
  });
});
