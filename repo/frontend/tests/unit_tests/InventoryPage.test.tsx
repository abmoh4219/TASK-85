import { screen, waitFor } from '@testing-library/react';
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

import { InventoryPage } from '@/features/inventory/InventoryPage';
import { renderWithProviders } from './test-helpers';

describe('InventoryPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders header and empty state when no items', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<InventoryPage />);
    expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no inventory items/i)).toBeInTheDocument());
  });

  it('renders alert summary strip and run-checks button for admin', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/inventory/items') return Promise.resolve({ data: { data: [] } });
      if (url === '/inventory/alerts')
        return Promise.resolve({
          data: {
            data: [
              { id: 'a1', itemId: 'i1', severity: 'critical', type: 'safety_stock', message: 'low' },
              { id: 'a2', itemId: 'i1', severity: 'warning', type: 'min_max', message: 'low' },
            ],
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<InventoryPage />);
    await waitFor(() => expect(screen.getByText(/1 critical/i)).toBeInTheDocument());
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run alert checks/i })).toBeInTheDocument();
  });

  it('renders inventory rows from API', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/inventory/items') {
        return Promise.resolve({
          data: {
            data: [
              {
                itemId: 'item-1',
                currentStock: 50,
                minLevel: 20,
                maxLevel: 200,
                safetyStockLevel: 10,
                avgDailyUsage: 5,
                item: { name: 'Syringe 10ml', sku: 'SYR-10' },
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
    renderWithProviders(<InventoryPage />);
    await waitFor(() => expect(screen.getByText('Syringe 10ml')).toBeInTheDocument());
    expect(screen.getByText('SYR-10')).toBeInTheDocument();
  });
});
