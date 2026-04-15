import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: vi.fn(),
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

import { RFQPage } from '@/features/procurement/RFQPage';
import { renderWithProviders } from './test-helpers';

describe('RFQPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockClear();
  });

  it('renders heading and empty state when no RFQs', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<RFQPage />);
    expect(screen.getByRole('heading', { name: /rfq management/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no rfqs yet/i)).toBeInTheDocument());
  });

  it('renders RFQs and opens create panel', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/procurement/rfq')
        return Promise.resolve({
          data: {
            data: [
              {
                id: 'rfq-1',
                purchaseRequestId: 'pr-1',
                status: 'open',
                dueDate: null,
              },
            ],
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<RFQPage />);
    await waitFor(() => expect(screen.getByText(/view comparison/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /create rfq/i }));
    await waitFor(() => expect(screen.getByText(/new rfq/i)).toBeInTheDocument());
  });
});
