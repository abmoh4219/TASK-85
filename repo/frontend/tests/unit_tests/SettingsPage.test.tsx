import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

import { SettingsPage } from '@/features/admin/SettingsPage';
import { renderWithProviders } from './test-helpers';

describe('SettingsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('shows loading then renders policy cards', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'p1',
            key: 'rate-limiting',
            value: { limit: 10, ttlSeconds: 60, sensitiveEndpoints: ['/auth'], enabled: true },
            description: null,
          },
          {
            id: 'p2',
            key: 'jwt-config',
            value: {
              accessTokenExpiry: '15m',
              refreshTokenExpiry: '8h',
              serverSideStorage: true,
              tokenRotation: true,
            },
            description: null,
          },
        ],
      },
    });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('heading', { name: /security settings/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/rate limiting/i)).toBeInTheDocument());
    expect(screen.getByText(/jwt configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/10 requests \/ 60s \/ user/i)).toBeInTheDocument();
  });

  it('shows failure state on error', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText(/failed to load settings/i)).toBeInTheDocument());
  });

  it('renders export-permissions card and opens editor', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'p3',
            key: 'export-permissions',
            value: {
              admin: { scope: 'all' },
              supervisor: { scope: 'procurement,inventory' },
              hr: { scope: 'learning' },
              employee: { scope: 'own-records' },
            },
            description: null,
          },
        ],
      },
    });
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText(/export permissions/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    await waitFor(() => expect(screen.getByText(/edit export permissions/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('renders data-security policy items', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'p4',
            key: 'data-security',
            value: {
              encryptionAlgorithm: 'aes-256-gcm',
              passwordHashing: 'bcrypt-12',
              identifierMasking: true,
              softDeletesOnly: true,
            },
            description: null,
          },
        ],
      },
    });
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(screen.getByText(/data security/i)).toBeInTheDocument());
    expect(screen.getByText(/aes-256-gcm/i)).toBeInTheDocument();
    expect(screen.getByText(/last 4 chars only/i)).toBeInTheDocument();
  });
});
