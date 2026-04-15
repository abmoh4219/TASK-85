import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: (...args: unknown[]) => patchMock(...args),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'sup', role: 'supervisor', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { AnomalyQueuePage } from '@/features/dashboard/AnomalyQueuePage';
import { renderWithProviders } from './test-helpers';

describe('AnomalyQueuePage', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockClear();
  });

  it('renders heading and pending empty state', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<AnomalyQueuePage />);
    expect(screen.getByRole('heading', { name: /anomaly queue/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no pending anomalies/i)).toBeInTheDocument());
  });

  it.skip('switches to "All" filter and shows alternate empty state', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<AnomalyQueuePage />);
    await waitFor(() => expect(screen.getByText(/no pending anomalies/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }));
    await waitFor(() => expect(screen.getByText(/no anomaly events/i)).toBeInTheDocument());
  });

  it('renders events and review action invokes patch', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'a1',
            type: 'rate_limit_exceeded',
            status: 'pending',
            description: 'Too many requests',
            ipAddress: '10.0.0.1',
            requestPath: '/api/x',
            userId: 'u1',
            createdAt: new Date().toISOString(),
            reviewedAt: null,
            reviewNotes: null,
          },
        ],
      },
    });
    renderWithProviders(<AnomalyQueuePage />);
    await waitFor(() => expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /review/i }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/anomalies/a1/review', { status: 'reviewed' }));
  });

  it('dismiss action invokes patch with dismissed', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'a2',
            type: 'unusual_access_pattern',
            status: 'pending',
            description: 'Odd access',
            ipAddress: null,
            requestPath: null,
            userId: null,
            createdAt: new Date().toISOString(),
            reviewedAt: null,
            reviewNotes: null,
          },
        ],
      },
    });
    renderWithProviders(<AnomalyQueuePage />);
    await waitFor(() => expect(screen.getByText(/unusual access pattern/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/anomalies/a2/review', { status: 'dismissed' }));
  });
});
