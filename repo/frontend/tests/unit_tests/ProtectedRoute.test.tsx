import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ProtectedRoute } from '../../src/features/auth/ProtectedRoute';

// Mock useAuth from AuthContext
const mockUseAuth = vi.fn();
vi.mock('../../src/features/auth/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  // Re-export UserRole type values for allowedRoles prop
}));

function renderWithRouter(
  initialRoute: string,
  allowedRoles?: string[],
) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
        <Route element={<ProtectedRoute allowedRoles={allowedRoles as any} />}>
          <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
          <Route path="/admin" element={<div data-testid="admin-page">Admin</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    renderWithRouter('/dashboard');
    // Should show spinner, not redirect
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to /login', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    renderWithRouter('/dashboard');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders child route for authenticated user', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    });

    renderWithRouter('/dashboard');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('redirects to /unauthorized when user role is not in allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '2', username: 'employee', role: 'employee', isActive: true },
    });

    renderWithRouter('/admin', ['admin']);
    expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
  });

  it('allows access when user role matches allowedRoles', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', username: 'admin', role: 'admin', isActive: true },
    });

    renderWithRouter('/admin', ['admin']);
    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
  });

  it('allows access when no allowedRoles specified (any authenticated user)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '3', username: 'hr', role: 'hr', isActive: true },
    });

    renderWithRouter('/dashboard');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });
});
