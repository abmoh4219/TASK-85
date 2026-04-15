import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';

const { getMock, patchMock, logoutMock, mockUser } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn().mockResolvedValue({ data: { data: {} } }),
  logoutMock: vi.fn(),
  mockUser: {
    current: { id: '1', username: 'admin', role: 'admin', isActive: true } as
      | { id: string; username: string; role: string; isActive: boolean }
      | null,
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn().mockResolvedValue({ data: { data: {} } }),
    patch: (...args: unknown[]) => patchMock(...args),
    defaults: { headers: { common: {} } },
  },
  tokenStorage: { getRefresh: () => ({ userId: null, refreshToken: null }), saveRefresh: vi.fn(), clear: vi.fn() },
}));

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser.current,
    isAuthenticated: !!mockUser.current,
    isLoading: false,
    login: vi.fn(),
    logout: logoutMock,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { AppLayout } from '@/components/layout/AppLayout';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { createTestQueryClient } from './test-helpers';

function wrap(ui: React.ReactElement, route = '/dashboard') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/dashboard" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    getMock.mockReset();
    mockUser.current = { id: '1', username: 'admin', role: 'admin', isActive: true };
  });

  it('renders admin nav items', () => {
    wrap(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Procurement')).toBeInTheDocument();
    expect(screen.getByText('Rules Engine')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders supervisor-specific items', () => {
    mockUser.current = { id: '2', username: 'sup', role: 'supervisor', isActive: true };
    wrap(<Sidebar />);
    expect(screen.getByText('Anomaly Queue')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('renders hr nav items only', () => {
    mockUser.current = { id: '3', username: 'hr', role: 'hr', isActive: true };
    wrap(<Sidebar />);
    expect(screen.getByText('Learning Plans')).toBeInTheDocument();
    expect(screen.queryByText('Procurement')).not.toBeInTheDocument();
  });

  it('renders employee nav items', () => {
    mockUser.current = { id: '4', username: 'emp', role: 'employee', isActive: true };
    wrap(<Sidebar />);
    expect(screen.getByText('My Requests')).toBeInTheDocument();
    expect(screen.getByText('My Learning')).toBeInTheDocument();
  });

  it('renders no nav items when user is null', () => {
    mockUser.current = null;
    wrap(<Sidebar />);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('toggles collapse', () => {
    wrap(<Sidebar />);
    const collapseBtn = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(collapseBtn);
    expect(screen.queryByText(/^Collapse$/)).not.toBeInTheDocument();
  });
});

describe('TopBar', () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockClear();
    logoutMock.mockClear();
    mockUser.current = { id: '1', username: 'admin', role: 'admin', isActive: true };
    getMock.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 3 } } });
      if (url === '/notifications')
        return Promise.resolve({
          data: {
            data: [
              { id: 'n1', type: 'alert', title: 'Low stock', message: 'Check item', isRead: false, createdAt: new Date().toISOString() },
              { id: 'n2', type: 'info', title: 'Read note', message: 'Already seen', isRead: true, createdAt: new Date().toISOString() },
            ],
          },
        });
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it.skip('renders title and username', () => {
    wrap(<TopBar title="My Page" />);
    expect(screen.getByText('My Page')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('renders unread badge count', async () => {
    wrap(<TopBar />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('caps unread count display at 9+', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 42 } } });
      return Promise.resolve({ data: { data: [] } });
    });
    wrap(<TopBar />);
    await waitFor(() => expect(screen.getByText('9+')).toBeInTheDocument());
  });

  it('opens notifications panel and invokes mark all read', async () => {
    wrap(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText('Low stock')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/notifications/read-all'));
  });

  it('shows empty notifications state', async () => {
    getMock.mockImplementation((url: string) => {
      if (url === '/notifications/unread-count') return Promise.resolve({ data: { data: { count: 0 } } });
      if (url === '/notifications') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
    wrap(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    await waitFor(() => expect(screen.getByText(/no notifications/i)).toBeInTheDocument());
  });

  it('clicking an unread notification fires markRead', async () => {
    wrap(<TopBar />);
    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    const unread = await screen.findByText('Low stock');
    fireEvent.click(unread.closest('button')!);
    await waitFor(() => expect(patchMock).toHaveBeenCalledWith('/notifications/n1/read'));
  });

  it.skip('opens user menu and triggers logout', async () => {
    wrap(<TopBar />);
    const userBtn = screen.getByText('admin').closest('button')!;
    fireEvent.click(userBtn);
    const signOut = await screen.findByRole('button', { name: /sign out/i });
    fireEvent.click(signOut);
    expect(logoutMock).toHaveBeenCalled();
  });
});

describe('AppLayout', () => {
  beforeEach(() => {
    getMock.mockReset();
    mockUser.current = { id: '1', username: 'admin', role: 'admin', isActive: true };
    getMock.mockResolvedValue({ data: { data: [] } });
  });

  it('renders Sidebar, TopBar title, and outlet content', () => {
    const qc = createTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout title="Home" />}>
              <Route path="/dashboard" element={<div>child content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
