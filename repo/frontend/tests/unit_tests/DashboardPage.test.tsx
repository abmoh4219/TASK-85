import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: vi.fn().mockResolvedValue({ data: { data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { data: {} } }),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

const { currentRole } = vi.hoisted(() => ({ currentRole: { value: 'admin' as string } }));
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: currentRole.value, role: currentRole.value, isActive: true },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { renderWithProviders } from './test-helpers';

describe('DashboardPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockImplementation((url: string) => {
      if (url === '/inventory/alerts') return Promise.resolve({ data: { data: [{ id: 'a1', severity: 'critical' }] } });
      if (url === '/rules') return Promise.resolve({ data: { data: [{ status: 'draft' }, { status: 'active' }] } });
      if (url === '/procurement/orders') return Promise.resolve({ data: { data: [{ status: 'approved' }] } });
      if (url === '/learning/plans') return Promise.resolve({ data: { data: [{ status: 'active' }] } });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('renders the admin greeting and username', async () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText(/administrator overview/i)).toBeInTheDocument();
    expect(screen.getByText(/welcome back, admin/i)).toBeInTheDocument();
  });

  it('renders admin stat cards with counts from API', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/active alerts/i)).toBeInTheDocument();
      expect(screen.getByText(/open orders/i)).toBeInTheDocument();
      expect(screen.getByText(/pending rules/i)).toBeInTheDocument();
    });
  });

  it('renders supervisor dashboard with anomaly and project cards', async () => {
    currentRole.value = 'supervisor';
    getMock.mockImplementation((url: string) => {
      if (url === '/procurement/requests') return Promise.resolve({ data: { data: [{ status: 'submitted' }] } });
      if (url === '/projects') return Promise.resolve({ data: { data: [{ status: 'initiation' }] } });
      if (url === '/anomalies') return Promise.resolve({ data: { data: [{}, {}] } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/supervisor dashboard/i)).toBeInTheDocument());
    expect(screen.getByText(/pending approvals/i)).toBeInTheDocument();
    expect(screen.getByText(/open anomalies/i)).toBeInTheDocument();
    currentRole.value = 'admin';
  });

  it('renders HR dashboard with learning plan breakdown', async () => {
    currentRole.value = 'hr';
    getMock.mockImplementation((url: string) => {
      if (url === '/learning/plans')
        return Promise.resolve({
          data: {
            data: [
              { status: 'active' },
              { status: 'completed' },
              { status: 'not_started' },
            ],
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/hr dashboard/i)).toBeInTheDocument());
    expect(screen.getByText(/total plans/i)).toBeInTheDocument();
    expect(screen.getByText(/learning plan status/i)).toBeInTheDocument();
    currentRole.value = 'admin';
  });

  it('renders HR dashboard empty state when no plans', async () => {
    currentRole.value = 'hr';
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/no learning plans found/i)).toBeInTheDocument());
    currentRole.value = 'admin';
  });

  it('renders employee dashboard with my workspace', async () => {
    currentRole.value = 'employee';
    getMock.mockImplementation((url: string) => {
      if (url === '/procurement/requests') return Promise.resolve({ data: { data: [{ status: 'draft' }] } });
      if (url === '/lab/samples') return Promise.resolve({ data: { data: [{ status: 'submitted' }] } });
      if (url === '/projects') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/my workspace/i)).toBeInTheDocument());
    expect(screen.getByText(/my open requests/i)).toBeInTheDocument();
    expect(screen.getByText(/active lab samples/i)).toBeInTheDocument();
    currentRole.value = 'admin';
  });
});
