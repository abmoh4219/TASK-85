import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Plus, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
import type { RFQ, PurchaseRequest, RFQComparison } from '@/types';

// ── RFQ List ──────────────────────────────────────────────────────────────────

function RFQList() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: rfqs, isLoading } = useQuery({
    queryKey: ['procurement', 'rfq'],
    queryFn: () =>
      apiClient.get('/procurement/rfq').then((r) => r.data.data as RFQ[]),
  });

  const { data: requests } = useQuery({
    queryKey: ['procurement', 'requests'],
    queryFn: () =>
      apiClient.get('/procurement/requests').then((r) => r.data.data as PurchaseRequest[]),
  });

  const approvedRequests = (requests ?? []).filter((r) => r.status === 'approved');

  const columns: ColumnDef<RFQ>[] = [
    {
      accessorKey: 'id',
      header: 'RFQ ID',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">...{row.original.id.slice(-8)}</span>
      ),
    },
    {
      accessorKey: 'purchaseRequestId',
      header: 'Request',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          ...{row.original.purchaseRequestId.slice(-8)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.dueDate ? format(new Date(row.original.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      id: 'comparison',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); navigate(`/procurement/rfq/${row.original.id}`); }}
        >
          View Comparison <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Requests for Quotation</h2>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Create RFQ
        </Button>
      </div>

      {showCreate && (
        <CreateRFQPanel
          approvedRequests={approvedRequests}
          onClose={() => setShowCreate(false)}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : (rfqs ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No RFQs yet"
          description="Create an RFQ from an approved purchase request."
        />
      ) : (
        <DataTable columns={columns} data={rfqs ?? []} />
      )}
    </div>
  );
}

// ── Create RFQ Panel ──────────────────────────────────────────────────────────

function CreateRFQPanel({
  approvedRequests,
  onClose,
}: {
  approvedRequests: PurchaseRequest[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState('');

  const selectedRequest = approvedRequests.find((r) => r.id === selectedRequestId);

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/procurement/rfq', {
        purchaseRequestId: selectedRequestId,
        dueDate: dueDate || undefined,
        lines: (selectedRequest?.items ?? []).map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          unitOfMeasure: item.unitOfMeasure,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement', 'rfq'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create RFQ.');
    },
  });

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">New RFQ</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-xs mb-1 block">Approved Request</Label>
          <select
            value={selectedRequestId}
            onChange={(e) => setSelectedRequestId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select request…</option>
            {approvedRequests.map((r) => (
              <option key={r.id} value={r.id}>
                ...{r.id.slice(-8)} ({r.items?.length ?? 0} items)
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Due Date (optional)</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive mb-2">{error}</p>}
      <Button
        size="sm"
        className="h-8"
        onClick={() => create.mutate()}
        disabled={!selectedRequestId || create.isPending}
      >
        {create.isPending ? 'Creating…' : 'Create RFQ'}
      </Button>
    </div>
  );
}

// ── RFQ Detail: Quote Comparison ──────────────────────────────────────────────

export function RFQDetailPage({ rfqId }: { rfqId: string }) {
  const qc = useQueryClient();
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    rfqLineId: '', vendorId: '', unitPrice: '', leadTimeDays: '', notes: '',
  });
  const [error, setError] = useState('');

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['procurement', 'rfq', rfqId, 'comparison'],
    queryFn: () =>
      apiClient.get(`/procurement/rfq/${rfqId}/comparison`).then((r) => r.data.data as RFQComparison),
  });

  const { data: vendors } = useQuery({
    queryKey: ['vendors'],
    queryFn: () =>
      apiClient.get('/procurement/vendors').then((r) => r.data.data as Array<{ id: string; name: string }>),
  });

  const addQuote = useMutation({
    mutationFn: () =>
      apiClient.post(`/procurement/rfq/${rfqId}/quotes`, {
        rfqLineId: quoteForm.rfqLineId,
        vendorId: quoteForm.vendorId,
        unitPrice: Number(quoteForm.unitPrice),
        leadTimeDays: quoteForm.leadTimeDays ? Number(quoteForm.leadTimeDays) : undefined,
        notes: quoteForm.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['procurement', 'rfq', rfqId, 'comparison'] });
      setShowAddQuote(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to add quote.');
    },
  });

  if (isLoading) return <PageLoader />;
  if (!comparison) return <p className="text-sm text-muted-foreground p-4">RFQ not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Quote Comparison</h2>
        <Button size="sm" className="h-8" onClick={() => setShowAddQuote(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add Quote
        </Button>
      </div>

      {showAddQuote && (
        <div className="bg-muted/30 border border-border rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Add Vendor Quote</h3>
            <button onClick={() => setShowAddQuote(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <Label className="text-xs mb-1 block">RFQ Line</Label>
              <select
                value={quoteForm.rfqLineId}
                onChange={(e) => setQuoteForm((f) => ({ ...f, rfqLineId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select line…</option>
                {comparison.lines.map((l) => (
                  <option key={l.lineId} value={l.lineId}>
                    {l.itemName} (qty: {l.quantity})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Vendor</Label>
              <select
                value={quoteForm.vendorId}
                onChange={(e) => setQuoteForm((f) => ({ ...f, vendorId: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select vendor…</option>
                {(vendors ?? []).map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Unit Price</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={quoteForm.unitPrice}
                onChange={(e) => setQuoteForm((f) => ({ ...f, unitPrice: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Lead Time (days)</Label>
              <Input
                type="number"
                min={0}
                value={quoteForm.leadTimeDays}
                onChange={(e) => setQuoteForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <Button
            size="sm"
            className="h-8"
            onClick={() => addQuote.mutate()}
            disabled={!quoteForm.rfqLineId || !quoteForm.vendorId || !quoteForm.unitPrice || addQuote.isPending}
          >
            {addQuote.isPending ? 'Adding…' : 'Add Quote'}
          </Button>
        </div>
      )}

      {/* Comparison table */}
      {comparison.lines.map((line) => (
        <div key={line.lineId} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">{line.itemName}</h3>
            <span className="text-xs text-muted-foreground">Qty: {line.quantity}</span>
          </div>
          {line.quotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No quotes yet.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Vendor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Unit Price</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Lead Time</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {line.quotes.map((q, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/40 last:border-0 ${q.isLowest ? 'bg-green-50 dark:bg-green-950/10' : ''}`}
                    >
                      <td className="px-4 py-2.5 font-medium">{q.vendorName}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        ${Number(q.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">
                        {q.leadTimeDays != null ? `${q.leadTimeDays}d` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {q.isLowest && (
                          <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                            Lowest Price
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── RFQ Router Page ───────────────────────────────────────────────────────────

export function RFQPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-foreground mb-6">RFQ Management</h1>
      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          <RFQList />
        </ErrorBoundary>
      </div>
    </div>
  );
}

