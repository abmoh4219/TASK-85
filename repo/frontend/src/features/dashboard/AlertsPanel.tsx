import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AlertCard } from '@/components/shared/AlertCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  itemId?: string;
  acknowledgedAt?: string | null;
  createdAt: string;
  metadata?: {
    itemName?: string;
    currentStock?: number;
    expiresAt?: string;
  };
}

const TYPE_LABELS: Record<string, string> = {
  safety_stock: 'Safety Stock Breach',
  min_max: 'Min/Max Breach',
  near_expiration: 'Near Expiration',
  abnormal_consumption: 'Abnormal Consumption',
};

export function AlertsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['inventory', 'alerts', 'active'],
    queryFn: () =>
      apiClient
        .get('/inventory/alerts', { params: { status: 'active' } })
        .then((r) => r.data.data as Alert[]),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        Unable to load alerts.
      </p>
    );
  }

  const alerts = data ?? [];
  const active = alerts.filter((a) => !a.acknowledgedAt);

  if (active.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No active alerts"
        description="All inventory levels are within normal thresholds."
        className="py-8"
      />
    );
  }

  return (
    <div className="space-y-1.5">
      {active.slice(0, 8).map((alert) => (
        <AlertCard
          key={alert.id}
          severity={alert.severity}
          title={TYPE_LABELS[alert.type] ?? alert.type}
          message={alert.message}
          meta={alert.metadata?.itemName}
        />
      ))}
      {active.length > 8 && (
        <Button variant="ghost" size="sm" className="w-full text-xs h-7 mt-1">
          View all {active.length} alerts →
        </Button>
      )}
    </div>
  );
}
