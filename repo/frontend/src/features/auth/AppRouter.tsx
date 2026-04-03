import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AnomalyQueuePage } from '@/features/dashboard/AnomalyQueuePage';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">Loading MeridianMed...</p>
      </div>
    </div>
  );
}

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-md">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
        <a href="/dashboard" className="text-primary hover:underline text-sm">
          Return to dashboard
        </a>
      </div>
    </div>
  );
}

function PlaceholderPage({ label }: { label: string }) {
  return (
    <div className="p-6">
      <div className="bg-card border border-border rounded-xl p-12 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">{label} — coming in the next phase</p>
      </div>
    </div>
  );
}

export function AppRouter() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* All authenticated users — wrapped in AppLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path="/dashboard"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
          <Route path="/lab/*" element={<PlaceholderPage label="Lab Operations" />} />
          <Route path="/projects/*" element={<PlaceholderPage label="Projects" />} />
          <Route path="/procurement/*" element={<PlaceholderPage label="Procurement" />} />
          <Route path="/inventory/*" element={<PlaceholderPage label="Inventory" />} />
          <Route path="/learning/*" element={<PlaceholderPage label="Learning Plans" />} />
        </Route>
      </Route>

      {/* Admin + Supervisor only */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'supervisor']} />}>
        <Route element={<AppLayout />}>
          <Route
            path="/anomalies"
            element={
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <AnomalyQueuePage />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Route>
      </Route>

      {/* Admin only */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/rules-engine/*" element={<PlaceholderPage label="Rules Engine" />} />
          <Route path="/admin/*" element={<PlaceholderPage label="Admin" />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}
