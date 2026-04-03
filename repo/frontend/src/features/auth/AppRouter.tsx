import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

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

// Placeholder dashboard — replaced in Phase 8
function DashboardPlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="font-semibold text-foreground">MeridianMed</div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user?.username} ({user?.role})
          </span>
          <button
            onClick={logout}
            className="text-sm text-destructive hover:underline"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex items-center justify-center h-[calc(100vh-65px)]">
        <p className="text-muted-foreground">Dashboard — coming in Phase 8</p>
      </main>
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

      {/* All authenticated users */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPlaceholder />} />
      </Route>

      {/* Admin-only routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/*" element={<div className="p-8 text-muted-foreground">Admin — Phase 13</div>} />
        <Route path="/rules-engine/*" element={<div className="p-8 text-muted-foreground">Rules Engine — Phase 9</div>} />
      </Route>

      {/* Admin + Supervisor */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'supervisor']} />}>
        <Route path="/procurement/*" element={<div className="p-8 text-muted-foreground">Procurement — Phase 4</div>} />
        <Route path="/inventory/*" element={<div className="p-8 text-muted-foreground">Inventory — Phase 5</div>} />
      </Route>

      {/* HR */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
        <Route path="/learning/*" element={<div className="p-8 text-muted-foreground">Learning — Phase 7</div>} />
      </Route>

      {/* All roles */}
      <Route element={<ProtectedRoute />}>
        <Route path="/lab/*" element={<div className="p-8 text-muted-foreground">Lab — Phase 6</div>} />
        <Route path="/projects/*" element={<div className="p-8 text-muted-foreground">Projects — Phase 7</div>} />
      </Route>

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}
