import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: [] } }),
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

import { CreateSamplePage } from '@/features/lab/CreateSamplePage';
import { createTestQueryClient } from './test-helpers';

function renderPage() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/lab/new']}>
        <Routes>
          <Route path="/lab/new" element={<CreateSamplePage />} />
          <Route path="/lab" element={<div>lab list</div>} />
          <Route path="/lab/:id" element={<div>sample detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CreateSamplePage', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('renders form fields', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /new lab sample/i })).toBeInTheDocument();
    expect(screen.getByText(/sample type/i)).toBeInTheDocument();
    expect(screen.getByText(/collection date/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /submit sample/i }));
    await waitFor(() =>
      expect(screen.getByText(/sample type is required/i)).toBeInTheDocument(),
    );
  });

  it('submits form with valid values and calls api', async () => {
    postMock.mockResolvedValue({ data: { data: { id: 's1' } } });
    renderPage();
    const inputs = screen.getAllByRole('textbox');
    // sampleType first, patientIdentifier third (date is not textbox), notes is textarea
    fireEvent.change(inputs[0], { target: { value: 'Blood' } });
    // collection date is type=date — find by container
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-15' } });
    fireEvent.click(screen.getByRole('button', { name: /submit sample/i }));
    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        '/lab/samples',
        expect.objectContaining({ sampleType: 'Blood' }),
      ),
    );
  });

  it('shows server error on failed submit', async () => {
    postMock.mockRejectedValue({ response: { data: { message: 'Server said no' } } });
    renderPage();
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Urine' } });
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-03-15' } });
    fireEvent.click(screen.getByRole('button', { name: /submit sample/i }));
    await waitFor(() => expect(screen.getByText(/server said no/i)).toBeInTheDocument());
  });
});
