import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn().mockResolvedValue({ data: { data: { id: 'req1' } } }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
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

import { CreateRequestPage } from '@/features/procurement/CreateRequestPage';
import { createTestQueryClient } from './test-helpers';

function renderPage() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/procurement/new']}>
        <Routes>
          <Route path="/procurement/new" element={<CreateRequestPage />} />
          <Route path="/procurement" element={<div>procurement list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateRequestPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockClear();
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Gauze', sku: 'GZ-1', unitOfMeasure: 'EA' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Syringe', sku: 'SYR-1', unitOfMeasure: 'EA' },
        ],
      },
    });
  });

  it('renders step 1 with item selector', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('heading', { name: /new purchase request/i })).toBeInTheDocument());
    expect(screen.getByText(/select the items/i)).toBeInTheDocument();
  });

  it('shows validation error when no item selected and next is clicked', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/select the items/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/add at least one item/i)).toBeInTheDocument());
  });

  it('advances through steps and submits', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/select the items/i)).toBeInTheDocument());
    const selects = document.querySelectorAll('select');
    fireEvent.change(selects[0], { target: { value: '11111111-1111-1111-1111-111111111111' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/provide a business justification/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => expect(screen.getByText(/review your request/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        '/procurement/requests',
        expect.objectContaining({ items: expect.any(Array) }),
      ),
    );
  });
});
