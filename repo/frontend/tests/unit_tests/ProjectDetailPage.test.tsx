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
    user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { createTestQueryClient } from './test-helpers';

function renderAt(id = 'p1') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/projects/${id}`]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/projects" element={<div>projects list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockClear();
    patchMock.mockClear();
  });

  it('renders project header and tasks empty state', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/projects/p1')
        return Promise.resolve({
          data: {
            data: {
              id: 'p1',
              title: 'Warehouse',
              description: 'Retrofit',
              status: 'initiation',
              ownerId: 'u1',
              startDate: null,
              endDate: null,
            },
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('Warehouse')).toBeInTheDocument());
    expect(screen.getByText('Retrofit')).toBeInTheDocument();
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
  });

  it('switches to milestones tab and shows empty state', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/projects/p1')
        return Promise.resolve({
          data: { data: { id: 'p1', title: 'P', description: null, status: 'initiation', ownerId: 'u1', startDate: null, endDate: null } },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText('P')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^milestones$/i }));
    await waitFor(() => expect(screen.getByText(/no milestones/i)).toBeInTheDocument());
  });

  it('opens add-task form', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/projects/p1')
        return Promise.resolve({
          data: { data: { id: 'p1', title: 'P', description: null, status: 'initiation', ownerId: 'u1', startDate: null, endDate: null } },
        });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/no tasks/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /add task/i }));
    await waitFor(() => expect(screen.getByPlaceholderText(/task title/i)).toBeInTheDocument());
  });

  it('shows not-found when project missing', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/projects/p1') return Promise.resolve({ data: { data: null } });
      return Promise.resolve({ data: { data: [] } });
    });
    renderAt();
    await waitFor(() => expect(screen.getByText(/project not found/i)).toBeInTheDocument());
  });
});
