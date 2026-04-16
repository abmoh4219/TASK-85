import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/features/auth/AuthContext';
import { createTestQueryClient } from './test-helpers';
import { clearAuth } from './test-helpers/real-api';

function renderPage() {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>dashboard landing</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage (real backend)', () => {
  beforeEach(() => {
    clearAuth();
    localStorage.clear();
  });
  afterEach(() => {
    clearAuth();
    localStorage.clear();
  });

  it('renders username, password, and submit button', () => {
    renderPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    renderPage();
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
    expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });

  it('successful login navigates to /dashboard', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'meridian2024' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    await waitFor(() => expect(screen.getByText(/dashboard landing/i)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('form action button has type=submit', () => {
    renderPage();
    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeInTheDocument();
  });

  it('username field accepts typed input', () => {
    renderPage();
    const username = screen.getByLabelText(/username/i) as HTMLInputElement;
    fireEvent.change(username, { target: { value: 'admin' } });
    expect(username.value).toBe('admin');
  });

  it('shows error message when login fails with wrong password', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'definitely-wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);

    expect(
      await screen.findByText(/invalid username or password/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    // Still on the login page, not the dashboard.
    expect(screen.queryByText(/dashboard landing/i)).not.toBeInTheDocument();
  });
});
