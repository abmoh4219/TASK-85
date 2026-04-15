import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
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

import { RequestDetailPage } from '@/features/procurement/RequestDetailPage';
import { createTestQueryClient } from './test-helpers';

function renderAt(id = 'req1') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/procurement/requests/${id}`]}>
        <Routes>
          <Route path="/procurement/requests/:id" element={<RequestDetailPage />} />
          <Route path="/procurement" element={<div>procurement list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RequestDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders request details when found', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'req1',
            requestNumber: 'PR-001',
            status: 'submitted',
            createdAt: new Date().toISOString(),
            justification: 'Need supplies',
            items: [{ id: 'it1', itemId: 'itemA', quantity: 4, unitOfMeasure: 'EA' }],
          },
        ],
      },
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/purchase request pr-001/i)).toBeInTheDocument());
    expect(screen.getByText(/need supplies/i)).toBeInTheDocument();
    expect(screen.getByText(/4 EA/i)).toBeInTheDocument();
  });

  it('shows not-found when request missing', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderAt();
    await waitFor(() => expect(screen.getByText(/purchase request not found/i)).toBeInTheDocument());
  });
});
