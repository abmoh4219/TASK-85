import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// ── Stub every heavy page/layout so the router is the only thing under test ──
const { stub } = vi.hoisted(() => ({
  stub: (label: string) => () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require('react');
    return React.createElement('div', { 'data-testid': label }, label);
  },
}));

vi.mock('@/components/layout/AppLayout', async () => {
  const { Outlet } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { AppLayout: () => <div data-testid="app-layout"><Outlet /></div> };
});
vi.mock('@/components/shared/LoadingSpinner', () => ({
  PageLoader: () => <div data-testid="page-loader">loading</div>,
  LoadingSpinner: () => <div>spinner</div>,
}));
vi.mock('@/components/shared/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/features/auth/LoginPage', () => ({ LoginPage: stub('login-page') }));
vi.mock('@/features/dashboard/DashboardPage', () => ({ DashboardPage: stub('dashboard-page') }));
vi.mock('@/features/dashboard/AnomalyQueuePage', () => ({ AnomalyQueuePage: stub('anomaly-page') }));
vi.mock('@/features/procurement/ProcurementPage', () => ({ ProcurementPage: stub('procurement-page') }));
vi.mock('@/features/procurement/CreateRequestPage', () => ({ CreateRequestPage: stub('create-req-page') }));
vi.mock('@/features/procurement/RFQPage', () => ({
  RFQPage: stub('rfq-page'),
  RFQDetailPage: stub('rfq-detail-page'),
}));
vi.mock('@/features/procurement/OrdersPage', () => ({
  OrdersPage: stub('orders-page'),
  OrderDetailPage: stub('order-detail-page'),
}));
vi.mock('@/features/procurement/RequestDetailPage', () => ({ RequestDetailPage: stub('req-detail-page') }));
vi.mock('@/features/inventory/InventoryPage', () => ({ InventoryPage: stub('inventory-page') }));
vi.mock('@/features/inventory/ItemDetailPage', () => ({ ItemDetailPage: stub('item-detail-page') }));
vi.mock('@/features/lab/LabPage', () => ({ LabPage: stub('lab-page') }));
vi.mock('@/features/lab/CreateSamplePage', () => ({ CreateSamplePage: stub('create-sample-page') }));
vi.mock('@/features/lab/SampleDetailPage', () => ({ SampleDetailPage: stub('sample-detail-page') }));
vi.mock('@/features/projects/ProjectsPage', () => ({ ProjectsPage: stub('projects-page') }));
vi.mock('@/features/projects/ProjectDetailPage', () => ({ ProjectDetailPage: stub('project-detail-page') }));
vi.mock('@/features/learning/LearningPage', () => ({ LearningPage: stub('learning-page') }));
vi.mock('@/features/learning/LearningPlanDetailPage', () => ({ LearningPlanDetailPage: stub('learning-detail-page') }));
vi.mock('@/features/rules-engine/RulesEnginePage', () => ({ RulesEnginePage: stub('rules-page') }));
vi.mock('@/features/rules-engine/RuleDetailPage', () => ({ RuleDetailPage: stub('rule-detail-page') }));
vi.mock('@/features/admin/UsersPage', () => ({ UsersPage: stub('users-page') }));
vi.mock('@/features/admin/SettingsPage', () => ({ SettingsPage: stub('settings-page') }));

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

import { AppRouter } from '@/features/auth/AppRouter';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe('AppRouter', () => {
  it('shows loading screen while auth is resolving', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true, user: null });
    renderAt('/dashboard');
    expect(screen.getByText(/loading meridianmed/i)).toBeInTheDocument();
  });

  it('redirects unauthenticated user from a protected route to /login', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
    renderAt('/dashboard');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders DashboardPage for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    });
    renderAt('/dashboard');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('renders the admin-only rules-engine page for admins', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    });
    renderAt('/rules-engine');
    expect(screen.getByTestId('rules-page')).toBeInTheDocument();
  });

  it('denies non-admins access to rules-engine', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '2', username: 'emp', role: 'employee', isActive: true },
    });
    renderAt('/rules-engine');
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('redirects /login to /dashboard when already authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    });
    renderAt('/login');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });
});
