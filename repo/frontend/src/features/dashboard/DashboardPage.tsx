import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { AlertsPanel } from './AlertsPanel';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import {
  ShoppingCart,
  Bell,
  Settings2,
  GraduationCap,
  CheckSquare,
  FlaskConical,
  Users,
  FolderOpen,
} from 'lucide-react';

// ── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.FC<{ className?: string }>;
  iconClass?: string;
  sub?: string;
}

function StatCard({ label, value, icon: Icon, iconClass, sub }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconClass ?? 'bg-primary/10'}`}>
        <Icon className={`w-5 h-5 ${iconClass ? 'text-white' : 'text-primary'}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs font-medium text-muted-foreground mt-1">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Role dashboards ───────────────────────────────────────────────────────────

function AdminDashboard() {
  const { data: alerts } = useQuery({
    queryKey: ['inventory', 'alerts'],
    queryFn: () => apiClient.get('/inventory/alerts').then((r) => r.data.data as unknown[]),
  });
  const { data: rules } = useQuery({
    queryKey: ['rules'],
    queryFn: () => apiClient.get('/rules').then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: orders } = useQuery({
    queryKey: ['procurement', 'orders'],
    queryFn: () =>
      apiClient.get('/procurement/orders').then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: plans } = useQuery({
    queryKey: ['learning', 'plans'],
    queryFn: () =>
      apiClient
        .get('/learning/plans')
        .then((r) => r.data.data as Array<{ status: string }>),
  });

  const alertCount = (alerts as unknown[])?.length ?? 0;
  const pendingRules = (rules ?? []).filter((r) => r.status === 'draft').length;
  const openOrders = (orders ?? []).filter((o) =>
    ['approved', 'partially_received'].includes(o.status),
  ).length;
  const activePlans = (plans ?? []).filter((p) => p.status === 'active').length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Active Alerts" value={alertCount} icon={Bell} iconClass="bg-red-500" />
        <StatCard label="Open Orders" value={openOrders} icon={ShoppingCart} iconClass="bg-blue-500" />
        <StatCard label="Pending Rules" value={pendingRules} icon={Settings2} iconClass="bg-amber-500" />
        <StatCard label="Active Learning Plans" value={activePlans} icon={GraduationCap} iconClass="bg-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Inventory Alerts</h2>
          <ErrorBoundary>
            <AlertsPanel />
          </ErrorBoundary>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Quick Stats</h2>
          <div className="space-y-3">
            <QuickStat label="Business Rules" value={(rules ?? []).length} sub={`${pendingRules} in draft`} />
            <QuickStat label="Learning Plans" value={(plans ?? []).length} sub={`${activePlans} active`} />
            <QuickStat label="Purchase Orders" value={(orders ?? []).length} sub={`${openOrders} open`} />
          </div>
        </div>
      </div>
    </>
  );
}

function SupervisorDashboard() {
  const { data: requests } = useQuery({
    queryKey: ['procurement', 'requests'],
    queryFn: () =>
      apiClient
        .get('/procurement/requests')
        .then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      apiClient.get('/projects').then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: anomalies } = useQuery({
    queryKey: ['anomalies'],
    queryFn: () =>
      apiClient
        .get('/anomalies', { params: { status: 'pending' } })
        .then((r) => r.data.data as unknown[]),
  });

  const pendingApprovals = (requests ?? []).filter((r) => r.status === 'submitted').length;
  const openAnomalies = (anomalies as unknown[])?.length ?? 0;
  const activeProjects = (projects ?? []).filter((p) =>
    ['initiation', 'change', 'inspection'].includes(p.status),
  ).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="Pending Approvals" value={pendingApprovals} icon={CheckSquare} iconClass="bg-amber-500" />
        <StatCard label="Open Anomalies" value={openAnomalies} icon={Bell} iconClass="bg-red-500" />
        <StatCard label="Active Projects" value={activeProjects} icon={FolderOpen} iconClass="bg-blue-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Inventory Alerts</h2>
          <ErrorBoundary>
            <AlertsPanel />
          </ErrorBoundary>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Project Overview</h2>
          <div className="space-y-3">
            <QuickStat label="Total Projects" value={(projects ?? []).length} sub={`${activeProjects} in progress`} />
            <QuickStat label="Purchase Requests" value={(requests ?? []).length} sub={`${pendingApprovals} need approval`} />
          </div>
        </div>
      </div>
    </>
  );
}

function HrDashboard() {
  const { data: plans } = useQuery({
    queryKey: ['learning', 'plans'],
    queryFn: () =>
      apiClient
        .get('/learning/plans')
        .then((r) => r.data.data as Array<{ status: string }>),
  });

  const total = (plans ?? []).length;
  const active = (plans ?? []).filter((p) => p.status === 'active').length;
  const completed = (plans ?? []).filter((p) => p.status === 'completed').length;
  const notStarted = (plans ?? []).filter((p) => p.status === 'not_started').length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Plans" value={total} icon={GraduationCap} iconClass="bg-primary/10" />
        <StatCard label="Active" value={active} icon={GraduationCap} iconClass="bg-green-500" />
        <StatCard label="Completed" value={completed} icon={CheckSquare} iconClass="bg-blue-500" />
        <StatCard label="Not Started" value={notStarted} icon={Users} iconClass="bg-amber-500" />
      </div>
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Learning Plan Status</h2>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No learning plans found.</p>
        ) : (
          <div className="space-y-3">
            {[
              { label: 'Active', count: active, color: 'bg-green-500' },
              { label: 'Not Started', count: notStarted, color: 'bg-amber-400' },
              { label: 'Completed', count: completed, color: 'bg-blue-500' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24">{label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium text-foreground w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function EmployeeDashboard() {
  const { data: requests } = useQuery({
    queryKey: ['procurement', 'requests', 'mine'],
    queryFn: () =>
      apiClient
        .get('/procurement/requests')
        .then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: samples } = useQuery({
    queryKey: ['lab', 'samples', 'mine'],
    queryFn: () =>
      apiClient
        .get('/lab/samples')
        .then((r) => r.data.data as Array<{ status: string }>),
  });
  const { data: projects } = useQuery({
    queryKey: ['projects', 'mine'],
    queryFn: () =>
      apiClient.get('/projects').then((r) => r.data.data as Array<{ status: string }>),
  });

  const openRequests = (requests ?? []).filter((r) =>
    ['draft', 'submitted', 'under_review'].includes(r.status),
  ).length;
  const activeSamples = (samples ?? []).filter((s) =>
    ['submitted', 'in_progress', 'in-progress'].includes(s.status),
  ).length;
  const myProjects = (projects ?? []).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatCard label="My Open Requests" value={openRequests} icon={ShoppingCart} iconClass="bg-blue-500" />
        <StatCard label="Active Lab Samples" value={activeSamples} icon={FlaskConical} iconClass="bg-purple-500" />
        <StatCard label="My Projects" value={myProjects} icon={FolderOpen} iconClass="bg-green-500" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Purchase Requests</h2>
          <div className="space-y-3">
            <QuickStat label="Total Requests" value={(requests ?? []).length} sub={`${openRequests} open`} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Lab Samples</h2>
          <div className="space-y-3">
            <QuickStat label="Total Samples" value={(samples ?? []).length} sub={`${activeSamples} in progress`} />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function QuickStat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const GREETING: Record<string, string> = {
  admin: 'Administrator Overview',
  supervisor: 'Supervisor Dashboard',
  hr: 'HR Dashboard',
  employee: 'My Workspace',
};

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return <PageLoader />;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">{GREETING[user.role] ?? 'Dashboard'}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Welcome back, {user.username}.
        </p>
      </div>

      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          {user.role === 'admin' && <AdminDashboard />}
          {user.role === 'supervisor' && <SupervisorDashboard />}
          {user.role === 'hr' && <HrDashboard />}
          {user.role === 'employee' && <EmployeeDashboard />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
