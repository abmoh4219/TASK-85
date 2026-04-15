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

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { renderWithProviders } from './test-helpers';

describe('ProjectsPage', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders header and empty state', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<ProjectsPage />);
    expect(screen.getByRole('heading', { name: /^projects$/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no projects yet/i)).toBeInTheDocument());
  });

  it('renders project data from API', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            id: 'p1',
            title: 'Warehouse Retrofit',
            description: null,
            status: 'initiation',
            ownerId: 'u1',
            startDate: null,
            endDate: null,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText(/warehouse retrofit/i)).toBeInTheDocument());
  });

  it('filters projects by status pill', async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          { id: 'p1', title: 'A', description: null, status: 'initiation', ownerId: 'u1', startDate: null, endDate: null, createdAt: new Date().toISOString() },
          { id: 'p2', title: 'B', description: null, status: 'inspection', ownerId: 'u1', startDate: null, endDate: null, createdAt: new Date().toISOString() },
        ],
      },
    });
    renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText('A')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /^inspection$/i }));
    await waitFor(() => {
      expect(screen.queryByText('A')).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });

  it('opens create form when New Project clicked', async () => {
    getMock.mockResolvedValue({ data: { data: [] } });
    renderWithProviders(<ProjectsPage />);
    await waitFor(() => expect(screen.getByText(/no projects yet/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new project/i }));
    expect(screen.getByPlaceholderText(/project title/i)).toBeInTheDocument();
  });
});
