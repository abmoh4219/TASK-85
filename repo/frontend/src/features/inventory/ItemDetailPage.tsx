import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { AlertCard } from '@/components/shared/AlertCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Bell, Layers, Sparkles, CheckCircle } from 'lucide-react';
import type { InventoryLevel, InventoryAlert, ReplenishmentRecommendation } from '@/types';

const ALERT_TYPE_LABELS: Record<string, string> = {
  safety_stock: 'Safety Stock Breach',
  min_max: 'Min/Max Breach',
  near_expiration: 'Near Expiration',
  abnormal_consumption: 'Abnormal Consumption',
};

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: level, isLoading } = useQuery({
    queryKey: ['inventory', 'item', id],
    queryFn: () =>
      apiClient.get(`/inventory/items/${id}`).then((r) => r.data.data as InventoryLevel),
    enabled: !!id,
  });

  const { data: alerts } = useQuery({
    queryKey: ['inventory', 'alerts', 'item', id],
    queryFn: () =>
      apiClient
        .get('/inventory/alerts')
        .then((r) => (r.data.data as InventoryAlert[]).filter((a) => a.itemId === id)),
    enabled: !!id,
  });

  const { data: recommendations } = useQuery({
    queryKey: ['inventory', 'recommendations', id],
    queryFn: () =>
      apiClient
        .get('/inventory/recommendations')
        .then((r) => (r.data.data as ReplenishmentRecommendation[]).filter((rec) => rec.itemId === id)),
    enabled: !!id,
  });

  const acknowledge = useMutation({
    mutationFn: (alertId: string) => apiClient.patch(`/inventory/alerts/${alertId}/acknowledge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'alerts'] }),
  });

  const generate = useMutation({
    mutationFn: () =>
      apiClient.post('/inventory/recommendations/generate', { itemId: id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory', 'recommendations', id] }),
  });

  const impression = useMutation({
    mutationFn: (recId: string) => apiClient.post(`/inventory/recommendations/${recId}/impression`),
  });

  const accept = useMutation({
    mutationFn: (recId: string) => apiClient.post(`/inventory/recommendations/${recId}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', 'recommendations', id] });
      navigate('/procurement');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!level) return <p className="p-6 text-sm text-muted-foreground">Item not found.</p>;

  const activeAlerts = (alerts ?? []).filter((a) => !a.acknowledgedAt);
  const recs = recommendations ?? [];

  // Fire impressions on visible recommendations
  if (recs.length > 0) {
    recs.forEach((r) => {
      if (r.status === 'pending') impression.mutate(r.id);
    });
  }

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => navigate('/inventory')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Inventory
      </button>

      <h1 className="text-xl font-bold text-foreground mb-1">
        {level.item?.name ?? 'Item Detail'}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">{level.item?.sku} · {level.item?.unitOfMeasure}</p>

      {/* Stock metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Current Stock', value: level.currentStock },
          { label: 'Safety Stock', value: level.safetyStockLevel },
          { label: 'Min / Max', value: `${level.minLevel} / ${level.maxLevel}` },
          { label: 'Avg Daily Usage', value: `${level.avgDailyUsage}/day` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-muted-foreground" />
              Active Alerts
            </h2>
            {activeAlerts.length > 0 && (
              <span className="text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                {activeAlerts.length}
              </span>
            )}
          </div>
          <ErrorBoundary>
            {activeAlerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No active alerts"
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    severity={alert.severity}
                    title={ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                    message={alert.message}
                    onAction={() => acknowledge.mutate(alert.id)}
                    actionLabel="Acknowledge"
                  />
                ))}
              </div>
            )}
          </ErrorBoundary>
        </div>

        {/* Replenishment Recommendations */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              Replenishment
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </div>
          <ErrorBoundary>
            {recs.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No recommendations"
                description="Click Generate to compute a replenishment recommendation."
                className="py-6"
              />
            ) : (
              <div className="space-y-3">
                {recs.map((rec) => (
                  <div key={rec.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Order {rec.recommendedQuantity} {level.item?.unitOfMeasure}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rec.reasoning}</p>
                      </div>
                    </div>
                    {rec.status === 'pending' && (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs w-full"
                        onClick={() => accept.mutate(rec.id)}
                        disabled={accept.isPending}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                        {accept.isPending ? 'Accepting…' : 'Accept → Draft Purchase Request'}
                      </Button>
                    )}
                    {rec.status !== 'pending' && (
                      <span className="text-xs text-muted-foreground capitalize">{rec.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
