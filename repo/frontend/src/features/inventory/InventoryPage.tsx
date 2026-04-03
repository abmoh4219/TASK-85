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
import { Badge } from '@/components/ui/badge';
import { Package, AlertTriangle, RefreshCw } from 'lucide-react';
import { ColumnDef } from '@tanstack/react-table';
import type { InventoryLevel, InventoryAlert } from '@/types';

// ── Main inventory catalog ────────────────────────────────────────────────────

export function InventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: levels, isLoading } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () =>
      apiClient.get('/inventory/items').then((r) => r.data.data as InventoryLevel[]),
  });

  const { data: alerts } = useQuery({
    queryKey: ['inventory', 'alerts', 'active'],
    queryFn: () =>
      apiClient
        .get('/inventory/alerts', { params: { status: 'active' } })
        .then((r) => r.data.data as InventoryAlert[]),
  });

  const runChecks = useMutation({
    mutationFn: () => apiClient.post('/inventory/alerts/run-checks'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'alerts'] });
      qc.invalidateQueries({ queryKey: ['inventory', 'items'] });
    },
  });

  const alertsByItem = (alerts ?? []).reduce<Record<string, InventoryAlert[]>>((acc, a) => {
    if (a.itemId) {
      acc[a.itemId] = [...(acc[a.itemId] ?? []), a];
    }
    return acc;
  }, {});

  const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const worstSeverity = (itemAlerts: InventoryAlert[]): InventoryAlert['severity'] | null => {
    if (!itemAlerts?.length) return null;
    return itemAlerts.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))[0].severity;
  };

  const columns: ColumnDef<InventoryLevel>[] = [
    {
      accessorKey: 'item.name',
      header: 'Item',
      cell: ({ row }) => (
        <div>
          <span className="text-sm font-medium">{row.original.item?.name ?? 'Unknown'}</span>
          <span className="text-xs text-muted-foreground ml-2">{row.original.item?.sku}</span>
        </div>
      ),
    },
    {
      accessorKey: 'currentStock',
      header: 'Stock',
      cell: ({ row }) => {
        const stock = row.original.currentStock;
        const min = row.original.minLevel;
        const safety = row.original.safetyStockLevel;
        const isCritical = stock < safety;
        const isLow = stock < min;
        return (
          <span className={`text-sm font-mono font-medium ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-foreground'}`}>
            {stock}
          </span>
        );
      },
    },
    {
      accessorKey: 'safetyStockLevel',
      header: 'Safety / Min / Max',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">
          {row.original.safetyStockLevel} / {row.original.minLevel} / {row.original.maxLevel}
        </span>
      ),
    },
    {
      accessorKey: 'avgDailyUsage',
      header: 'Avg Daily',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.avgDailyUsage}/day</span>
      ),
    },
    {
      id: 'alerts',
      header: 'Alerts',
      cell: ({ row }) => {
        const itemAlerts = alertsByItem[row.original.itemId] ?? [];
        const severity = worstSeverity(itemAlerts);
        if (!severity) return null;
        return (
          <Badge
            variant={severity === 'critical' ? 'destructive' : severity === 'warning' ? 'warning' : 'info'}
            className="gap-1 text-[10px]"
          >
            <AlertTriangle className="w-2.5 h-2.5" />
            {itemAlerts.length} {severity}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/inventory/${row.original.itemId}`); }}
        >
          Detail →
        </Button>
      ),
    },
  ];

  const items = levels ?? [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Item catalog with stock levels and alerts.</p>
        </div>
        {(user?.role === 'admin') && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => runChecks.mutate()}
            disabled={runChecks.isPending}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${runChecks.isPending ? 'animate-spin' : ''}`} />
            Run Alert Checks
          </Button>
        )}
      </div>

      {/* Alert summary strip */}
      {(alerts ?? []).length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {(['critical', 'warning', 'info'] as const).map((sev) => {
            const count = (alerts ?? []).filter((a) => a.severity === sev).length;
            if (count === 0) return null;
            return (
              <div
                key={sev}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  sev === 'critical'
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : sev === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium capitalize">{count} {sev}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : items.length === 0 ? (
            <EmptyState icon={Package} title="No inventory items" description="Items will appear here after setup." />
          ) : (
            <DataTable
              columns={columns}
              data={items}
              searchColumn="name"
              searchPlaceholder="Search items..."
              onRowClick={(row) => navigate(`/inventory/${row.itemId}`)}
            />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
