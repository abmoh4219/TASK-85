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
import { ShoppingCart, Plus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import type { PurchaseRequest } from '@/types';
import { maskId } from '@/lib/mask-id';

/** Extracted as a proper component to avoid hook-rule violations in cell callbacks */
function RequestActions({ request }: { request: PurchaseRequest }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const submit = useMutation({
    mutationFn: () => apiClient.patch(`/procurement/requests/${request.id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'requests'] }),
  });
  const approve = useMutation({
    mutationFn: () => apiClient.patch(`/procurement/requests/${request.id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'requests'] }),
  });

  return (
    <div className="flex items-center gap-1 justify-end">
      {request.status === 'draft' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); submit.mutate(); }}
          disabled={submit.isPending}
        >
          Submit
        </Button>
      )}
      {request.status === 'submitted' && (user?.role === 'admin' || user?.role === 'supervisor') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
          onClick={(e) => { e.stopPropagation(); approve.mutate(); }}
          disabled={approve.isPending}
        >
          Approve
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={(e) => { e.stopPropagation(); navigate(`/procurement/requests/${request.id}`); }}
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

const COLUMNS: ColumnDef<PurchaseRequest>[] = [
  {
    accessorKey: 'id',
    header: 'Request ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {maskId(row.original.id)}
      </span>
    ),
    size: 120,
  },
  {
    accessorKey: 'items',
    header: 'Items',
    cell: ({ row }) => (
      <span className="text-sm">{row.original.items?.length ?? 0} item(s)</span>
    ),
    size: 80,
  },
  {
    accessorKey: 'justification',
    header: 'Justification',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
        {row.original.justification ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    size: 130,
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
    cell: ({ row }) => <RequestActions request={row.original} />,
    size: 120,
  },
];

export function ProcurementPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'requests' | 'rfq' | 'orders'>('requests');

  const { data, isLoading } = useQuery({
    queryKey: ['procurement', 'requests'],
    queryFn: () =>
      apiClient.get('/procurement/requests').then((r) => r.data.data as PurchaseRequest[]),
  });

  const requests = data ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Procurement</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage purchase requests, RFQs, and purchase orders.
          </p>
        </div>
        <Button size="sm" className="h-8" onClick={() => navigate('/procurement/new')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Request
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        {(['requests', 'rfq', 'orders'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              if (t === 'rfq') navigate('/procurement/rfq');
              else if (t === 'orders') navigate('/procurement/orders');
              else setTab(t);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'rfq' ? 'RFQs' : t === 'orders' ? 'Purchase Orders' : 'Requests'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No purchase requests"
              description="Create your first purchase request to get started."
              action={
                <Button size="sm" onClick={() => navigate('/procurement/new')}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New Request
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={COLUMNS}
              data={requests}
              searchColumn="justification"
              searchPlaceholder="Search requests..."
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
