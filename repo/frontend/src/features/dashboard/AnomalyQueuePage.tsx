import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { AlertOctagon, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';

interface AnomalyEvent {
  id: string;
  type: string;
  status: string;
  description: string;
  ipAddress: string | null;
  requestPath: string | null;
  userId: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  rate_limit_exceeded: 'Rate Limit Exceeded',
  unusual_access_pattern: 'Unusual Access Pattern',
  repeated_failed_login: 'Failed Logins',
  privilege_escalation_attempt: 'Privilege Escalation',
  bulk_data_export: 'Bulk Data Export',
  after_hours_access: 'After-Hours Access',
  suspicious_query: 'Suspicious Query',
};

export function AnomalyQueuePage() {
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['anomalies', statusFilter],
    queryFn: () =>
      apiClient
        .get('/anomalies', { params: statusFilter !== 'all' ? { status: statusFilter } : {} })
        .then((r) => r.data.data as AnomalyEvent[]),
  });

  const review = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/anomalies/${id}/review`, { status: 'reviewed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anomalies'] }),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/anomalies/${id}/review`, { status: 'dismissed' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anomalies'] }),
  });

  const columns: ColumnDef<AnomalyEvent>[] = [
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{TYPE_LABELS[row.original.type] ?? row.original.type}</span>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
          {row.original.description}
        </span>
      ),
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">
          {row.original.ipAddress ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'Detected',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.createdAt), 'MMM d, HH:mm')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'pending' ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); review.mutate(row.original.id); }}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Review
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); dismiss.mutate(row.original.id); }}
            >
              Dismiss
            </Button>
          </div>
        ) : null,
    },
  ];

  const events = data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Anomaly Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review suspicious activity flagged by the system.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setStatusFilter('pending')}
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setStatusFilter('all')}
          >
            All
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : error ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Failed to load anomaly events.
            </p>
          ) : events.length === 0 ? (
            <EmptyState
              icon={AlertOctagon}
              title={statusFilter === 'pending' ? 'No pending anomalies' : 'No anomaly events'}
              description={
                statusFilter === 'pending'
                  ? 'No suspicious activity requires your review.'
                  : 'No anomaly events have been recorded.'
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              searchColumn="description"
              searchPlaceholder="Search events..."
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
