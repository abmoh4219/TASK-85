import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle } from 'lucide-react';
import type { Item } from '@/types';

// ── Step schemas ──────────────────────────────────────────────────────────────

const itemSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitOfMeasure: z.string().min(1).max(50),
  notes: z.string().optional(),
});

const justificationSchema = z.object({
  justification: z.string().optional(),
});

type ItemEntry = z.infer<typeof itemSchema>;

// ── Step 1: Item selection ─────────────────────────────────────────────────────

function ItemSelectionStep({
  items,
  entries,
  onChange,
}: {
  items: Item[];
  entries: ItemEntry[];
  onChange: (e: ItemEntry[]) => void;
}) {
  const addRow = () =>
    onChange([...entries, { itemId: '', quantity: 1, unitOfMeasure: 'EA' }]);
  const removeRow = (i: number) => onChange(entries.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<ItemEntry>) => {
    const next = [...entries];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the items you need and specify quantities.
      </p>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Item</Label>
              <select
                value={entry.itemId}
                onChange={(e) => {
                  const item = items.find((it) => it.id === e.target.value);
                  updateRow(i, { itemId: e.target.value, unitOfMeasure: item?.unitOfMeasure ?? 'EA' });
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Select item…</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.sku})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <Label className="text-xs mb-1 block">Qty</Label>
              <Input
                type="number"
                min={1}
                value={entry.quantity}
                onChange={(e) => updateRow(i, { quantity: Number(e.target.value) })}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-24">
              <Label className="text-xs mb-1 block">UOM</Label>
              <Input
                value={entry.unitOfMeasure}
                onChange={(e) => updateRow(i, { unitOfMeasure: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeRow(i)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="h-8" onClick={addRow}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Item
      </Button>
    </div>
  );
}

// ── Step 2: Justification ─────────────────────────────────────────────────────

function JustificationStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Provide a business justification for this request (optional but recommended).
      </p>
      <div>
        <Label className="text-xs mb-1.5 block">Justification</Label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="Explain why these items are needed..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}

// ── Step 3: Review ────────────────────────────────────────────────────────────

function ReviewStep({
  entries,
  justification,
  items,
}: {
  entries: ItemEntry[];
  justification: string;
  items: Item[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review your request before submitting.</p>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Item</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Qty</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">UOM</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const item = items.find((it) => it.id === e.itemId);
              return (
                <tr key={i} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{item?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">{e.quantity}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.unitOfMeasure}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {justification && (
        <div className="bg-muted/40 rounded-lg px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">Justification</p>
          <p className="text-sm text-foreground">{justification}</p>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const STEPS = ['Select Items', 'Justification', 'Review'];

export function CreateRequestPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [entries, setEntries] = useState<ItemEntry[]>([{ itemId: '', quantity: 1, unitOfMeasure: 'EA' }]);
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');

  const { data: itemsData, isLoading: itemsLoading } = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => apiClient.get('/inventory/items').then((r) => r.data.data as Item[]),
  });

  const items = itemsData ?? [];

  const create = useMutation({
    mutationFn: (payload: { justification?: string; items: ItemEntry[] }) =>
      apiClient.post('/procurement/requests', payload),
    onSuccess: () => navigate('/procurement'),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create request.');
    },
  });

  const validateStep = () => {
    if (step === 0) {
      const valid = entries.every((e) => e.itemId && e.quantity > 0);
      if (!valid || entries.length === 0) {
        setError('Please add at least one item with a valid quantity.');
        return false;
      }
    }
    setError('');
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else {
      create.mutate({ justification: justification || undefined, items: entries });
    }
  };

  if (itemsLoading) return <PageLoader />;

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => navigate('/procurement')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Procurement
      </button>

      <h1 className="text-xl font-bold text-foreground mb-6">New Purchase Request</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 ${i <= step ? 'text-primary' : 'text-muted-foreground'}`}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  i < step
                    ? 'bg-primary border-primary text-primary-foreground'
                    : i === step
                    ? 'border-primary text-primary bg-background'
                    : 'border-border text-muted-foreground bg-background'
                }`}
              >
                {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:block">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-8 ${i < step ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <ErrorBoundary>
          {step === 0 && (
            <ItemSelectionStep items={items} entries={entries} onChange={setEntries} />
          )}
          {step === 1 && (
            <JustificationStep value={justification} onChange={setJustification} />
          )}
          {step === 2 && (
            <ReviewStep entries={entries} justification={justification} items={items} />
          )}
        </ErrorBoundary>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => step === 0 ? navigate('/procurement') : setStep((s) => s - 1)}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            size="sm"
            onClick={next}
            disabled={create.isPending}
          >
            {step === STEPS.length - 1 ? (create.isPending ? 'Submitting…' : 'Submit Request') : (
              <>Next <ChevronRight className="w-3.5 h-3.5 ml-1" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
