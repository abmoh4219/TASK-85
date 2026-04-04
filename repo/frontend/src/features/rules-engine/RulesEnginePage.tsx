import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Plus, X, AlertTriangle, Zap, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';

interface BusinessRule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  currentVersion: number;
  isAbTest: boolean;
  rolloutPercentage: number;
  createdAt: string;
}

interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Array<{ ruleId: string; ruleName: string; reason: string }>;
}

interface ImpactResult {
  ruleId: string;
  affectedWorkflows: string[];
  summary: string;
}

export function RulesEnginePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', category: 'custom',
    definition: '{"threshold": 0}', isAbTest: false, rolloutPercentage: '100',
  });
  const [conflicts, setConflicts] = useState<ConflictResult | null>(null);
  const [impact, setImpact] = useState<{ ruleId: string; data: ImpactResult } | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['rules'],
    queryFn: () => apiClient.get('/rules').then((r) => r.data.data as BusinessRule[]),
  });

  const validate = useMutation({
    mutationFn: () => {
      let def: Record<string, unknown>;
      try { def = JSON.parse(form.definition); }
      catch { throw new Error('Invalid JSON in definition'); }
      return apiClient.post('/rules/validate', {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        definition: def,
      }).then((r) => r.data.data as ConflictResult);
    },
    onSuccess: (data) => setConflicts(data),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : (err as Error).message ?? 'Validation failed.');
    },
  });

  const create = useMutation({
    mutationFn: () => {
      let def: Record<string, unknown>;
      try { def = JSON.parse(form.definition); }
      catch { throw new Error('Invalid JSON in definition'); }
      return apiClient.post('/rules', {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        definition: def,
        isAbTest: form.isAbTest,
        rolloutPercentage: Number(form.rolloutPercentage),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
      setShowCreate(false);
      setConflicts(null);
      setForm({ name: '', description: '', category: 'custom', definition: '{"threshold": 0}', isAbTest: false, rolloutPercentage: '100' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : (err as Error).message ?? 'Failed to create rule.');
    },
  });

  const stage = useMutation({
    mutationFn: ({ id, pct }: { id: string; pct: number }) =>
      apiClient.patch(`/rules/${id}/rollout`, { rolloutPercentage: pct }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to stage rule.');
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/rules/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to activate rule.');
    },
  });

  const rollback = useMutation({
    mutationFn: (id: string) => apiClient.post(`/rules/${id}/rollback`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] });
      setConfirmRollback(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to rollback rule.');
    },
  });

  const getImpact = useMutation({
    mutationFn: (id: string) =>
      apiClient.get(`/rules/${id}/impact`).then((r) => ({ ruleId: id, data: r.data.data as ImpactResult })),
    onSuccess: (data) => setImpact(data),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to assess impact.');
    },
  });

  const rules = data ?? [];

  const columns: ColumnDef<BusinessRule>[] = [
    {
      accessorKey: 'name',
      header: 'Rule',
      cell: ({ row }) => (
        <div>
          <p className="text-sm font-medium">{row.original.name}</p>
          {row.original.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="text-xs capitalize text-muted-foreground">{row.original.category.replace(/_/g, ' ')}</span>
      ),
      size: 140,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      size: 100,
    },
    {
      accessorKey: 'currentVersion',
      header: 'Version',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-muted-foreground">v{row.original.currentVersion}</span>
      ),
      size: 70,
    },
    {
      accessorKey: 'rolloutPercentage',
      header: 'Rollout',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${row.original.rolloutPercentage}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{row.original.rolloutPercentage}%</span>
        </div>
      ),
      size: 100,
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
              className="h-6 px-2 text-xs"
              onClick={(e) => { e.stopPropagation(); stage.mutate({ id: row.original.id, pct: 100 }); }}
              disabled={stage.isPending}
            >
              Stage
            </Button>
          )}
          {row.original.status === 'staged' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={(e) => { e.stopPropagation(); getImpact.mutate(row.original.id); }}
              >
                Impact
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                onClick={(e) => { e.stopPropagation(); activate.mutate(row.original.id); }}
                disabled={activate.isPending}
              >
                <Zap className="w-3 h-3 mr-0.5" /> Activate
              </Button>
            </>
          )}
          {row.original.status === 'active' && row.original.currentVersion > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-amber-600 hover:text-amber-700"
              onClick={(e) => { e.stopPropagation(); setConfirmRollback(row.original.id); }}
            >
              <RotateCcw className="w-3 h-3 mr-0.5" /> Rollback
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); navigate(`/rules-engine/${row.original.id}`); }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rules Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage versioned business rules with staged rollout.</p>
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Rule
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {/* Impact assessment panel */}
      {impact && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Impact Assessment
            </h2>
            <button onClick={() => setImpact(null)} className="text-amber-600 hover:text-amber-800">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-amber-700 mb-2">{impact.data.summary}</p>
          {impact.data.affectedWorkflows.length > 0 && (
            <div>
              <p className="text-xs font-medium text-amber-700 mb-1">Affected workflows:</p>
              <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                {impact.data.affectedWorkflows.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Create rule panel */}
      {showCreate && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">New Business Rule</h2>
            <button onClick={() => { setShowCreate(false); setConflicts(null); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Rule Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Price Lock 30 Days"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="custom">Custom</option>
                <option value="procurement_threshold">Procurement Threshold</option>
                <option value="cancellation">Cancellation</option>
                <option value="pricing">Pricing</option>
                <option value="inventory">Inventory</option>
                <option value="parsing">Parsing</option>
              </select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Rollout % (1–100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.rolloutPercentage}
                onChange={(e) => setForm((f) => ({ ...f, rolloutPercentage: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Definition (JSON) *</Label>
              <textarea
                value={form.definition}
                onChange={(e) => setForm((f) => ({ ...f, definition: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder='{"threshold": 30, "unit": "days"}'
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isAbTest"
                checked={form.isAbTest}
                onChange={(e) => setForm((f) => ({ ...f, isAbTest: e.target.checked }))}
                className="rounded border-input"
              />
              <Label htmlFor="isAbTest" className="text-xs cursor-pointer">Enable A/B Test</Label>
            </div>
          </div>

          {/* Conflict warnings */}
          {conflicts && (
            <div className={`p-3 rounded-lg mb-3 ${conflicts.hasConflicts ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              {conflicts.hasConflicts ? (
                <>
                  <p className="text-xs font-semibold text-red-700 mb-1">⚠ Conflicts detected:</p>
                  {conflicts.conflicts.map((c, i) => (
                    <p key={i} className="text-xs text-red-600">· {c.ruleName}: {c.reason}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-green-700">✓ No conflicts detected — safe to create.</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => { setError(''); validate.mutate(); }}
              disabled={!form.name || validate.isPending}
            >
              {validate.isPending ? 'Validating…' : 'Validate'}
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={() => create.mutate()}
              disabled={!form.name || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create Rule'}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : rules.length === 0 ? (
            <EmptyState
              icon={Settings2}
              title="No business rules"
              description="Create your first rule to get started."
            />
          ) : (
            <DataTable
              columns={columns}
              data={rules}
              searchColumn="name"
              searchPlaceholder="Search rules..."
            />
          )}
        </ErrorBoundary>
      </div>

      {/* Rollback confirm */}
      <ConfirmDialog
        open={!!confirmRollback}
        onOpenChange={(o) => !o && setConfirmRollback(null)}
        title="Rollback Rule"
        description="This will revert the rule to its previous version. The rollback must complete within 5 minutes. Are you sure?"
        confirmLabel="Rollback"
        destructive
        onConfirm={() => confirmRollback && rollback.mutate(confirmRollback)}
      />
    </div>
  );
}
