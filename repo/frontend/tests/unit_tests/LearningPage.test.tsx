import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'hrlead', role: 'hr', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { LearningPage } from '@/features/learning/LearningPage';
import { renderWithProviders } from './test-helpers';

describe('LearningPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('shows empty state when no plans', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<LearningPage />);
    expect(screen.getByRole('heading', { name: /learning plans/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no learning plans/i)).toBeInTheDocument());
  });

  it('renders plan rows from API', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'lp1',
            title: 'Phlebotomy Basics',
            description: null,
            status: 'active',
            userId: 'u2',
            targetRole: 'technician',
            startDate: null,
            endDate: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<LearningPage />);
    await waitFor(() => expect(screen.getByText(/phlebotomy basics/i)).toBeInTheDocument());
  });

  it('opens the create plan form for HR user', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<LearningPage />);
    await waitFor(() => expect(screen.getByText(/no learning plans/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new plan/i }));
    await waitFor(() => expect(screen.getByText(/new learning plan/i)).toBeInTheDocument());
  });

  it('closes the create form after clicking X', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<LearningPage />);
    await waitFor(() => expect(screen.getByText(/no learning plans/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new plan/i }));
    const form = await screen.findByText(/new learning plan/i);
    const closeBtn = form.parentElement?.querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);
    await waitFor(() => expect(screen.queryByText(/new learning plan/i)).not.toBeInTheDocument());
  });
});
