import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Suspense } from 'react';
import { useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AnomalyQueuePage } from '@/features/dashboard/AnomalyQueuePage';
import { ProcurementPage } from '@/features/procurement/ProcurementPage';
import { CreateRequestPage } from '@/features/procurement/CreateRequestPage';
import { RFQPage, RFQDetailPage } from '@/features/procurement/RFQPage';
import { OrdersPage, OrderDetailPage } from '@/features/procurement/OrdersPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { ItemDetailPage } from '@/features/inventory/ItemDetailPage';
import { LabPage } from '@/features/lab/LabPage';
import { CreateSamplePage } from '@/features/lab/CreateSamplePage';
import { SampleDetailPage } from '@/features/lab/SampleDetailPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { LearningPage } from '@/features/learning/LearningPage';
import { LearningPlanDetailPage } from '@/features/learning/LearningPlanDetailPage';
import { RulesEnginePage } from '@/features/rules-engine/RulesEnginePage';
import { RuleDetailPage } from '@/features/rules-engine/RuleDetailPage';
import { RequestDetailPage } from '@/features/procurement/RequestDetailPage';
import { UsersPage } from '@/features/admin/UsersPage';
import { SettingsPage } from '@/features/admin/SettingsPage';
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
        <a href="/dashboard" className="text-primary hover:underline text-sm">Return to dashboard</a>
      </div>
    </div>
  );
}

function wrap(el: React.ReactNode) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{el}</Suspense>
    </ErrorBoundary>
  );
}

function RFQDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-foreground mb-6">RFQ Detail</h1>
      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <RFQDetailPage rfqId={id!} />
          </Suspense>
        </ErrorBoundary>
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
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* All authenticated */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={wrap(<DashboardPage />)} />
          <Route path="/lab" element={wrap(<LabPage />)} />
          <Route path="/lab/new" element={wrap(<CreateSamplePage />)} />
          <Route path="/lab/:id" element={wrap(<SampleDetailPage />)} />
          <Route path="/projects" element={wrap(<ProjectsPage />)} />
          <Route path="/projects/:id" element={wrap(<ProjectDetailPage />)} />
          <Route path="/learning" element={wrap(<LearningPage />)} />
          <Route path="/learning/:id" element={wrap(<LearningPlanDetailPage />)} />
        </Route>
      </Route>

      {/* Admin + Supervisor */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'supervisor']} />}>
        <Route element={<AppLayout />}>
          <Route path="/anomalies" element={wrap(<AnomalyQueuePage />)} />
          <Route path="/procurement/rfq" element={wrap(<RFQPage />)} />
          <Route path="/procurement/rfq/:id" element={wrap(<RFQDetailWrapper />)} />
          <Route path="/procurement/orders" element={wrap(<OrdersPage />)} />
          <Route path="/procurement/orders/:id" element={wrap(<OrderDetailPage />)} />
          <Route path="/inventory" element={wrap(<InventoryPage />)} />
          <Route path="/inventory/:id" element={wrap(<ItemDetailPage />)} />
        </Route>
      </Route>

      {/* All authenticated: procurement (role scoping in backend + ProcurementPage) */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/procurement" element={wrap(<ProcurementPage />)} />
          <Route path="/procurement/new" element={wrap(<CreateRequestPage />)} />
          <Route path="/procurement/requests/:id" element={wrap(<RequestDetailPage />)} />
        </Route>
      </Route>

      {/* Admin only */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/rules-engine" element={wrap(<RulesEnginePage />)} />
          <Route path="/rules-engine/:id" element={wrap(<RuleDetailPage />)} />
          <Route path="/admin/settings" element={wrap(<SettingsPage />)} />
        </Route>
      </Route>

      {/* Admin + HR: user management (HR has read-only access via backend) */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin/users" element={wrap(<UsersPage />)} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
