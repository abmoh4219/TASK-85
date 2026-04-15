import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
  patchMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
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
    user: { id: '1', username: 'hr', role: 'hr', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { LearningPlanDetailPage } from '@/features/learning/LearningPlanDetailPage';
import { createTestQueryClient } from './test-helpers';

function renderAt(id = 'lp1') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/learning/${id}`]}>
        <Routes>
          <Route path="/learning/:id" element={<LearningPlanDetailPage />} />
          <Route path="/learning" element={<div>learning list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LearningPlanDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockClear();
    patchMock.mockClear();
  });

  it('renders plan header and goals empty state', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/learning/plans/lp1')
        return Promise.resolve({
          data: {
            data: {
              id: 'lp1',
              title: 'Phlebotomy',
              description: 'desc',
              status: 'active',
              userId: 'u1',
              targetRole: 'technician',
            },
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('Phlebotomy')).toBeInTheDocument());
    expect(screen.getByText(/target role: technician/i)).toBeInTheDocument();
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument();
  });

  it('opens add-goal form', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/learning/plans/lp1')
        return Promise.resolve({
          data: { data: { id: 'lp1', title: 'P', description: null, status: 'active', userId: 'u1', targetRole: null } },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('P')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add goal/i }));
    await waitFor(() => expect(screen.getByText(/new goal/i)).toBeInTheDocument());
  });

  it('switches to lifecycle tab and shows empty state', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/learning/plans/lp1')
        return Promise.resolve({
          data: { data: { id: 'lp1', title: 'P', description: null, status: 'active', userId: 'u1', targetRole: null } },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('P')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /status history/i }));
    await waitFor(() => expect(screen.getByText(/no status changes yet/i)).toBeInTheDocument());
  });

  it('shows not found when plan missing', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/learning/plans/lp1') return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/plan not found/i)).toBeInTheDocument());
  });
});
