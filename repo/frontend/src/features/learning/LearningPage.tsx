import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GraduationCap, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';

interface LearningPlan {
  id: string;
  title: string;
  description: string | null;
  status: string;
  userId: string;
  targetRole: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export function LearningPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', userId: '', targetRole: '' });
  const [formError, setFormError] = useState('');

  const canCreate = user?.role === 'admin' || user?.role === 'hr';

  const { data, isLoading } = useQuery({
    queryKey: ['learning', 'plans'],
    queryFn: () =>
      apiClient.get('/learning/plans').then((r) => r.data.data as LearningPlan[]),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/learning/plans', {
        title: form.title,
        description: form.description || undefined,
        userId: form.userId || undefined,
        targetRole: form.targetRole || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['learning', 'plans'] });
      setShowCreate(false);
      setForm({ title: '', description: '', userId: '', targetRole: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Failed to create plan.');
    },
  });

  const plans = data ?? [];

  const columns: ColumnDef<LearningPlan>[] = [
    {
      accessorKey: 'title',
      header: 'Plan',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.title}</p>
          {row.original.targetRole && (
            <p className="text-xs text-muted-foreground capitalize">Target: {row.original.targetRole}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 120,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
      size: 100,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/learning/${row.original.id}`); }}
        >
          View →
        </Button>
      ),
      size: 70,
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Learning Plans</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canCreate ? 'Manage employee learning plans.' : 'Your learning plans.'}
          </p>
        </div>
        {canCreate && (
          <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Plan
          </Button>
        )}
      </div>

      {showCreate && canCreate && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">New Learning Plan</h2>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Plan title"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Employee User ID</Label>
              <Input
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                placeholder="UUID of the employee"
                className="h-9 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Target Role</Label>
              <Input
                value={form.targetRole}
                onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
                placeholder="e.g. Senior Technician"
                className="h-9 text-sm"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-destructive mb-2">{formError}</p>}
          <Button
            size="sm"
            className="h-8"
            onClick={() => create.mutate()}
            disabled={!form.title || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create Plan'}
          </Button>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No learning plans"
              description={canCreate ? 'Create a learning plan to get started.' : 'You have no learning plans yet.'}
            />
          ) : (
            <DataTable
              columns={columns}
              data={plans}
              searchColumn="title"
              searchPlaceholder="Search plans..."
              onRowClick={(row) => navigate(`/learning/${row.id}`)}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
