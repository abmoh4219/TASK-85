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
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Plus, X } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

const STATUS_OPTIONS = ['all', 'initiation', 'change', 'inspection', 'final_acceptance', 'archive'];

export function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '' });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then((r) => r.data.data as Project[]),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/projects', {
        title: form.title,
        description: form.description || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setShowCreate(false);
      setForm({ title: '', description: '', startDate: '', endDate: '' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(typeof msg === 'string' ? msg : 'Failed to create project.');
    },
  });

  const canCreate = user?.role === 'admin' || user?.role === 'supervisor';

  const projects = (data ?? []).filter((p) => filter === 'all' || p.status === filter);

  const columns: ColumnDef<Project>[] = [
    {
      accessorKey: 'title',
      header: 'Project',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.title}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 140,
    },
    {
      accessorKey: 'startDate',
      header: 'Start',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.startDate ? format(new Date(row.original.startDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: 'endDate',
      header: 'End',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.endDate ? format(new Date(row.original.endDate), 'MMM d, yyyy') : '—'}
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
          onClick={(e) => { e.stopPropagation(); navigate(`/projects/${row.original.id}`); }}
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
          <h1 className="text-xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Work tracking and task management.</p>
        </div>
        {canCreate && (
          <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Project
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">New Project</h2>
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
                placeholder="Project title"
                className="h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">End Date</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
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
            {create.isPending ? 'Creating…' : 'Create Project'}
          </Button>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 mb-4">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors capitalize ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : projects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={filter === 'all' ? 'No projects yet' : `No ${filter.replace(/_/g, ' ')} projects`}
              description={canCreate ? 'Create your first project to get started.' : ''}
            />
          ) : (
            <DataTable
              columns={columns}
              data={projects}
              searchColumn="title"
              searchPlaceholder="Search projects..."
              onRowClick={(row) => navigate(`/projects/${row.id}`)}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
