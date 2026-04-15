import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
  postMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
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

import { OrdersPage, OrderDetailPage } from '@/features/procurement/OrdersPage';
import { createTestQueryClient, renderWithProviders } from './test-helpers';

describe('OrdersPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockClear();
  });

  it('renders heading and empty state', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<OrdersPage />);
    expect(screen.getByRole('heading', { name: /purchase orders/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no purchase orders/i)).toBeInTheDocument());
  });

  it('renders orders and approves a draft', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            status: 'draft',
            vendor: { name: 'Acme' },
            lines: [{ id: 'l1', itemId: 'i1', quantity: 2, unitPrice: 10, unitOfMeasure: 'EA', item: { name: 'Item1' } }],
            priceLockedUntil: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<OrdersPage />);
    await waitFor(() => expect(screen.getByText('Acme')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith('/procurement/orders/11111111-2222-3333-4444-555555555555/approve'),
    );
  });
});

describe('OrderDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  function renderDetail() {
    const qc = createTestQueryClient();
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/procurement/orders/po1']}>
          <Routes>
            <Route path="/procurement/orders/:id" element={<OrderDetailPage />} />
            <Route path="/procurement/orders" element={<div>orders list</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it.skip('renders PO lines and workflow tabs for non-draft status', async () => {
    getMock.mockResolvedValue({
      data: {
        data: {
          id: 'po1',
          status: 'approved',
          vendor: { name: 'Acme' },
          lines: [{ id: 'l1', itemId: 'i1', quantity: 3, unitPrice: 15, unitOfMeasure: 'EA', item: { name: 'Mask' } }],
          receipts: [],
          priceLockedUntil: null,
          createdAt: new Date().toISOString(),
        },
      },
    });
    renderDetail();
    await waitFor(() => expect(screen.getByText('Mask')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /receive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconcile/i })).toBeInTheDocument();
  });

  it('shows not found when API returns null', async () => {
    getMock.mockResolvedValue({ data: { data: null } });
    renderDetail();
    await waitFor(() => expect(screen.getByText(/order not found/i)).toBeInTheDocument());
  });
});
