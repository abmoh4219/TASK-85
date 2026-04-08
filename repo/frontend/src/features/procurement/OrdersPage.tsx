import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, ChevronLeft, Lock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import type { PurchaseOrder } from '@/types';
import { maskId } from '@/lib/mask-id';

// ── PO List ───────────────────────────────────────────────────────────────────

export function OrdersPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['procurement', 'orders'],
    queryFn: () =>
      apiClient.get('/procurement/orders').then((r) => r.data.data as PurchaseOrder[]),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/procurement/orders/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'orders'] }),
  });

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: 'id',
      header: 'PO Number',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{maskId(row.original.id)}</span>
      ),
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor',
      cell: ({ row }) => (
        <span className="text-sm font-medium">{row.original.vendor?.name ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'lines',
      header: 'Lines',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.lines?.length ?? 0}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'priceLockedUntil',
      header: 'Price Lock',
      cell: ({ row }) => {
        const locked = row.original.priceLockedUntil;
        if (!locked) return <span className="text-xs text-muted-foreground">—</span>;
        const daysLeft = differenceInDays(new Date(locked), new Date());
        return (
          <span className={`flex items-center gap-1 text-xs ${daysLeft > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            <Lock className="w-3 h-3" />
            {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
          </span>
        );
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          {row.original.status === 'draft' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
              onClick={(e) => { e.stopPropagation(); approve.mutate(row.original.id); }}
              disabled={approve.isPending}
            >
              Approve
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); navigate(`/procurement/orders/${row.original.id}`); }}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  const orders = data ?? [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-foreground mb-6">Purchase Orders</h1>
      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingCart} title="No purchase orders" description="Purchase orders will appear here after approval." />
          ) : (
            <DataTable columns={columns} data={orders} searchColumn="status" searchPlaceholder="Filter orders..." />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

// ── PO Detail: Receive / Inspect / Put-Away / Reconcile ───────────────────────

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'receive' | 'inspect' | 'putaway' | 'reconcile'>('receive');
  const [receiptLines, setReceiptLines] = useState<Array<{ poLineId: string; receivedQuantity: number; lotNumber: string; expiryDate: string }>>([]);
  const [inspectLines, setInspectLines] = useState<Array<{ receiptLineId: string; result: string; notes: string }>>([]);
  const [putAwayLines, setPutAwayLines] = useState<Array<{ receiptLineId: string; location: string; quantityStored: number }>>([]);
  const [error, setError] = useState('');

  const { data: po, isLoading } = useQuery({
    queryKey: ['procurement', 'orders', id],
    queryFn: () =>
      apiClient.get(`/procurement/orders/${id}`).then((r) => r.data.data as PurchaseOrder),
    enabled: !!id,
  });

  const receive = useMutation({
    mutationFn: () =>
      apiClient.post(`/procurement/orders/${id}/receipts`, { lines: receiptLines }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement', 'orders', id] });
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to receive order.');
    },
  });

  const inspect = useMutation({
    mutationFn: (receiptId: string) =>
      apiClient.patch(`/procurement/receipts/${receiptId}/inspect`, { lines: inspectLines }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'orders', id] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to inspect receipt.');
    },
  });

  const putAway = useMutation({
    mutationFn: (receiptId: string) =>
      apiClient.post(`/procurement/receipts/${receiptId}/putaway`, { lines: putAwayLines }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'orders', id] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to put away items.');
    },
  });

  const reconcile = useMutation({
    mutationFn: () => apiClient.post(`/procurement/orders/${id}/reconcile`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procurement', 'orders', id] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to reconcile order.');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!po) return <p className="p-6 text-sm text-muted-foreground">Order not found.</p>;

  const latestReceipt = po.receipts?.[po.receipts.length - 1];

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => navigate('/procurement/orders')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Orders
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground">PO {maskId(po.id)}</h1>
        <StatusBadge status={po.status} />
        {po.priceLockedUntil && differenceInDays(new Date(po.priceLockedUntil), new Date()) > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3" />
            Price locked {differenceInDays(new Date(po.priceLockedUntil), new Date())}d
          </span>
        )}
      </div>

      {/* PO Lines */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-3">Order Lines</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr>
              <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Item</th>
              <th className="text-right pb-2 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-right pb-2 text-xs font-medium text-muted-foreground">Unit Price</th>
              <th className="text-left pb-2 text-xs font-medium text-muted-foreground pl-3">UOM</th>
            </tr>
          </thead>
          <tbody>
            {(po.lines ?? []).map((line) => (
              <tr key={line.id} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 font-medium">{line.item?.name ?? maskId(line.itemId)}</td>
                <td className="py-2.5 text-right">{line.quantity}</td>
                <td className="py-2.5 text-right font-mono">${Number(line.unitPrice).toFixed(2)}</td>
                <td className="py-2.5 pl-3 text-muted-foreground">{line.unitOfMeasure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Workflow tabs */}
      {po.status !== 'draft' && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
            {(['receive', 'inspect', 'putaway', 'reconcile'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(''); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                  tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t === 'putaway' ? 'Put Away' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-destructive mb-3">{error}</p>}

          {tab === 'receive' && (
            <ReceiveTab
              po={po}
              lines={receiptLines}
              onChange={setReceiptLines}
              onSubmit={() => receive.mutate()}
              isLoading={receive.isPending}
            />
          )}
          {tab === 'inspect' && latestReceipt && (
            <InspectTab
              receipt={latestReceipt}
              lines={inspectLines}
              onChange={setInspectLines}
              onSubmit={() => inspect.mutate(latestReceipt.id)}
              isLoading={inspect.isPending}
            />
          )}
          {tab === 'putaway' && latestReceipt && (
            <PutAwayTab
              receipt={latestReceipt}
              lines={putAwayLines}
              onChange={setPutAwayLines}
              onSubmit={() => putAway.mutate(latestReceipt.id)}
              isLoading={putAway.isPending}
            />
          )}
          {tab === 'reconcile' && (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Reconcile this order to match received quantities against the original order.
              </p>
              <Button
                size="sm"
                onClick={() => reconcile.mutate()}
                disabled={reconcile.isPending || po.status === 'reconciled'}
              >
                {po.status === 'reconciled' ? 'Already Reconciled' : reconcile.isPending ? 'Reconciling…' : 'Reconcile Order'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReceiveTab({
  po, lines, onChange, onSubmit, isLoading,
}: {
  po: PurchaseOrder;
  lines: Array<{ poLineId: string; receivedQuantity: number; lotNumber: string; expiryDate: string }>;
  onChange: (l: typeof lines) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Record received quantities for each line.</p>
      <div className="space-y-3 mb-4">
        {po.lines.map((poLine) => {
          const entry = lines.find((l) => l.poLineId === poLine.id) ?? {
            poLineId: poLine.id, receivedQuantity: poLine.quantity, lotNumber: '', expiryDate: '',
          };
          const update = (patch: Partial<typeof entry>) => {
            const next = lines.filter((l) => l.poLineId !== poLine.id);
            onChange([...next, { ...entry, ...patch }]);
          };
          return (
            <div key={poLine.id} className="grid grid-cols-4 gap-2 items-end">
              <div className="col-span-1">
                <Label className="text-xs mb-1 block">{poLine.item?.name ?? 'Item'}</Label>
                <Input
                  type="number"
                  min={0}
                  value={entry.receivedQuantity}
                  onChange={(e) => update({ receivedQuantity: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Lot #</Label>
                <Input
                  value={entry.lotNumber}
                  onChange={(e) => update({ lotNumber: e.target.value })}
                  className="h-8 text-sm"
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Expiry</Label>
                <Input
                  type="date"
                  value={entry.expiryDate}
                  onChange={(e) => update({ expiryDate: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                ordered: {poLine.quantity}
              </div>
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={onSubmit} disabled={isLoading}>
        {isLoading ? 'Recording…' : 'Record Receipt'}
      </Button>
    </div>
  );
}

function InspectTab({
  receipt, lines, onChange, onSubmit, isLoading,
}: {
  receipt: { id: string; lines: Array<{ id: string; poLineId: string; receivedQuantity: number; inspectionResult: string }> };
  lines: Array<{ receiptLineId: string; result: string; notes: string }>;
  onChange: (l: typeof lines) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Inspect each received line and mark pass/fail.</p>
      <div className="space-y-3 mb-4">
        {receipt.lines.map((rLine) => {
          const entry = lines.find((l) => l.receiptLineId === rLine.id) ?? {
            receiptLineId: rLine.id, result: 'passed', notes: '',
          };
          const update = (patch: Partial<typeof entry>) => {
            const next = lines.filter((l) => l.receiptLineId !== rLine.id);
            onChange([...next, { ...entry, ...patch }]);
          };
          return (
            <div key={rLine.id} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-32">Qty: {rLine.receivedQuantity}</span>
              <div className="flex gap-2">
                {['passed', 'failed', 'partial'].map((r) => (
                  <button
                    key={r}
                    onClick={() => update({ result: r })}
                    className={`px-3 py-1 text-xs rounded-md font-medium capitalize border transition-colors ${
                      entry.result === r
                        ? r === 'passed' ? 'bg-green-500 text-white border-green-500'
                        : r === 'failed' ? 'bg-red-500 text-white border-red-500'
                        : 'bg-amber-500 text-white border-amber-500'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                placeholder="Notes"
                value={entry.notes}
                onChange={(e) => update({ notes: e.target.value })}
                className="h-8 text-sm flex-1"
              />
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={onSubmit} disabled={isLoading}>
        {isLoading ? 'Submitting…' : 'Submit Inspection'}
      </Button>
    </div>
  );
}

function PutAwayTab({
  receipt, lines, onChange, onSubmit, isLoading,
}: {
  receipt: { id: string; lines: Array<{ id: string; receivedQuantity: number; inspectionResult: string }> };
  lines: Array<{ receiptLineId: string; location: string; quantityStored: number }>;
  onChange: (l: typeof lines) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const passedLines = receipt.lines.filter((l) => l.inspectionResult !== 'failed');

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">Assign storage locations for passed lines.</p>
      <div className="space-y-3 mb-4">
        {passedLines.map((rLine) => {
          const entry = lines.find((l) => l.receiptLineId === rLine.id) ?? {
            receiptLineId: rLine.id, location: '', quantityStored: rLine.receivedQuantity,
          };
          const update = (patch: Partial<typeof entry>) => {
            const next = lines.filter((l) => l.receiptLineId !== rLine.id);
            onChange([...next, { ...entry, ...patch }]);
          };
          return (
            <div key={rLine.id} className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-xs mb-1 block">Location</Label>
                <Input
                  placeholder="e.g. Shelf A-3"
                  value={entry.location}
                  onChange={(e) => update({ location: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Qty Stored</Label>
                <Input
                  type="number"
                  min={0}
                  max={rLine.receivedQuantity}
                  value={entry.quantityStored}
                  onChange={(e) => update({ quantityStored: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <span className="text-xs text-muted-foreground">received: {rLine.receivedQuantity}</span>
            </div>
          );
        })}
      </div>
      <Button size="sm" onClick={onSubmit} disabled={isLoading}>
        {isLoading ? 'Processing…' : 'Confirm Put Away'}
      </Button>
    </div>
  );
}
