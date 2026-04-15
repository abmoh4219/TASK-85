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

import { RulesEnginePage } from '@/features/rules-engine/RulesEnginePage';
import { renderWithProviders } from './test-helpers';

describe('RulesEnginePage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders header and empty state with no rules', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<RulesEnginePage />);
    expect(screen.getByRole('heading', { name: /rules engine/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no business rules/i)).toBeInTheDocument());
  });

  it('renders rules in the table', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'r1',
            name: 'Price Lock 30 Days',
            description: 'Immutable after PO approval',
            category: 'pricing',
            status: 'active',
            currentVersion: 2,
            isAbTest: false,
            rolloutPercentage: 100,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<RulesEnginePage />);
    await waitFor(() => expect(screen.getByText(/price lock 30 days/i)).toBeInTheDocument());
    expect(screen.getByText('v2')).toBeInTheDocument();
  });

  it('shows rollback action for active rule with version > 1', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'r1',
            name: 'R1',
            description: null,
            category: 'pricing',
            status: 'active',
            currentVersion: 3,
            isAbTest: false,
            rolloutPercentage: 100,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<RulesEnginePage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /rollback/i })).toBeInTheDocument());
  });

  it('shows stage action for draft rule and opens create panel', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'r1',
            name: 'DraftRule',
            description: null,
            category: 'custom',
            status: 'draft',
            currentVersion: 1,
            isAbTest: false,
            rolloutPercentage: 100,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<RulesEnginePage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /^stage$/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new rule/i }));
    expect(screen.getByText(/new business rule/i)).toBeInTheDocument();
  });

  it('shows activate action for staged rule', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'r1',
            name: 'Stg',
            description: null,
            category: 'custom',
            status: 'staged',
            currentVersion: 1,
            isAbTest: false,
            rolloutPercentage: 50,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<RulesEnginePage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /activate/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /impact/i })).toBeInTheDocument();
  });
});
