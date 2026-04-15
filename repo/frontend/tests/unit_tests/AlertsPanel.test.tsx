import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

import { AlertsPanel } from '@/features/dashboard/AlertsPanel';
import { renderWithProviders } from './test-helpers';

describe('AlertsPanel', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders empty state when there are no active alerts', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<AlertsPanel />);
    await waitFor(() => expect(screen.getByText(/no active alerts/i)).toBeInTheDocument());
  });

  it('renders alert cards for each active alert', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'a1',
            type: 'safety_stock',
            severity: 'critical',
            message: 'Stock below safety level',
            createdAt: new Date().toISOString(),
            metadata: { itemName: 'Gauze Pads' },
          },
          {
            id: 'a2',
            type: 'near_expiration',
            severity: 'warning',
            message: 'Expires in 10 days',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<AlertsPanel />);
    await waitFor(() => expect(screen.getByText(/safety stock breach/i)).toBeInTheDocument());
    expect(screen.getByText(/near expiration/i)).toBeInTheDocument();
    expect(screen.getByText(/gauze pads/i)).toBeInTheDocument();
  });

  it('shows fallback text on error', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    renderWithProviders(<AlertsPanel />);
    await waitFor(() => expect(screen.getByText(/unable to load alerts/i)).toBeInTheDocument());
  });
});
