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

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { ProcurementPage } from '@/features/procurement/ProcurementPage';
import { renderWithProviders } from './test-helpers';

describe('ProcurementPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders header and empty state when no requests', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<ProcurementPage />);
    expect(screen.getByRole('heading', { name: /procurement/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no purchase requests/i)).toBeInTheDocument());
  });

  it('renders request data rows', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            status: 'submitted',
            justification: 'Urgent restock',
            items: [{}, {}],
            createdAt: new Date('2026-01-15').toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<ProcurementPage />);
    await waitFor(() => expect(screen.getByText(/urgent restock/i)).toBeInTheDocument());
    expect(screen.getByText(/2 item/i)).toBeInTheDocument();
  });

  it('renders submit button for a draft request', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            status: 'draft',
            justification: 'Restock',
            items: [{}],
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<ProcurementPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument());
  });

  it('renders approve button for submitted request with admin role', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            status: 'submitted',
            justification: 'Restock',
            items: [{}],
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<ProcurementPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument());
  });
});
