import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthContext';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends RenderOptions {
  route?: string;
  initialEntries?: string[];
  queryClient?: QueryClient;
  /**
   * Skip wrapping in AuthProvider. Useful for rare tests that want to
   * observe the bare context-less behavior of a component. Defaults to
   * `false` — every test wraps in the real AuthProvider.
   */
  skipAuthProvider?: boolean;
}

/**
 * Render a React tree with the real QueryClient, MemoryRouter, and
 * AuthProvider. This intentionally uses the REAL AuthProvider so tests
 * exercise the same auth flow the user does. Tests that need a
 * pre-logged-in user should call `loginAs(...)` from `./test-helpers/real-api`
 * before rendering — the real axios instance will already carry the
 * bearer token, and the component tree will make real HTTP calls.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  {
    route = '/',
    initialEntries,
    queryClient = createTestQueryClient(),
    skipAuthProvider = false,
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const entries = initialEntries ?? [route];
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
    return skipAuthProvider ? tree : <AuthProvider>{tree}</AuthProvider>;
  };
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/**
 * Render a component at a specific route pattern so `useParams` resolves
 * correctly. Used by all detail-page tests that need `:id` bindings.
 */
export function renderAtRoute(
  ui: React.ReactElement,
  {
    path,
    at,
    queryClient = createTestQueryClient(),
    skipAuthProvider = false,
  }: { path: string; at: string; queryClient?: QueryClient; skipAuthProvider?: boolean },
) {
  const tree = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<div>redirect-target</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const wrapped = skipAuthProvider ? tree : <AuthProvider>{tree}</AuthProvider>;
  return { queryClient, ...render(wrapped) };
}
