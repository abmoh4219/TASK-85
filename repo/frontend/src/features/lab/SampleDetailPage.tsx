import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { LabSample, LabTestDictionary, LabResult } from '@/types';
import { maskId } from '@/lib/mask-id';

export function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: sample, isLoading } = useQuery({
    queryKey: ['lab', 'sample', id],
    queryFn: () => apiClient.get(`/lab/samples/${id}`).then((r) => r.data.data as LabSample),
    enabled: !!id,
  });

  const { data: tests } = useQuery({
    queryKey: ['lab', 'tests'],
    queryFn: () => apiClient.get('/lab/tests').then((r) => r.data.data as LabTestDictionary[]),
  });

  const [resultEntries, setResultEntries] = useState<
    Array<{ testId: string; numericValue: string; textValue: string; notes: string }>
  >([]);
  const [reportSummary, setReportSummary] = useState('');
  const [activeTab, setActiveTab] = useState<'results' | 'report' | 'history'>('results');
  const [error, setError] = useState('');

  const submitResults = useMutation({
    mutationFn: () =>
      apiClient.post(`/lab/samples/${id}/results`, {
        results: resultEntries
          .filter((e) => e.testId)
          .map((e) => ({
            testId: e.testId,
            numericValue: e.numericValue ? Number(e.numericValue) : undefined,
            textValue: e.textValue || undefined,
            notes: e.notes || undefined,
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'sample', id] });
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to submit results.');
    },
  });

  const createReport = useMutation({
    mutationFn: () =>
      apiClient.post(`/lab/samples/${id}/report`, { summary: reportSummary || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab', 'sample', id] });
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create report.');
    },
  });

  const canEditResults = user?.role === 'admin' || user?.role === 'supervisor';

  if (isLoading) return <PageLoader />;
  if (!sample) return <p className="p-6 text-sm text-muted-foreground">Sample not found.</p>;

  const addTestRow = () =>
    setResultEntries((prev) => [...prev, { testId: '', numericValue: '', textValue: '', notes: '' }]);
  const updateRow = (i: number, patch: Partial<(typeof resultEntries)[0]>) => {
    setResultEntries((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl">
      <button
        onClick={() => navigate('/lab')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Lab
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-foreground">{sample.sampleType}</h1>
        <StatusBadge status={sample.status} />
      </div>

      {/* Sample metadata */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Collection Date</p>
          <p className="text-sm font-medium mt-1">{format(new Date(sample.collectionDate), 'MMM d, yyyy')}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Patient ID</p>
          <p className="text-sm font-medium font-mono mt-1">
            {sample.patientIdentifier ? `...${sample.patientIdentifier.slice(-4)}` : '—'}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Results</p>
          <p className="text-sm font-medium mt-1">{(sample.results ?? []).length} entered</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Report</p>
          <p className="text-sm font-medium mt-1">{sample.report ? 'Created' : 'Pending'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted p-1 rounded-lg w-fit">
        {(['results', 'report', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
              activeTab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'history' ? 'Report History' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {/* Results Tab */}
          {activeTab === 'results' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold">Test Results</h2>
                {canEditResults && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addTestRow}>
                    + Add Result
                  </Button>
                )}
              </div>

              {/* Existing results */}
              {(sample.results ?? []).length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden mb-4">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 border-b border-border">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Test</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Value</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Flag</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Ref Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sample.results as LabResult[]).map((r) => {
                        const test = (tests ?? []).find((t) => t.id === r.testId);
                        const range = test?.referenceRanges?.[0];
                        return (
                          <tr key={r.id} className={`border-b border-border/40 last:border-0 ${r.isCritical ? 'bg-red-50 dark:bg-red-950/10' : r.isAbnormal ? 'bg-amber-50 dark:bg-amber-950/10' : ''}`}>
                            <td className="px-4 py-2.5 font-medium">{test?.name ?? maskId(r.testId)}</td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {r.numericValue != null ? r.numericValue : r.textValue ?? '—'}
                              {range?.unit && <span className="text-muted-foreground ml-1 text-xs">{range.unit}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.isCritical ? (
                                <span className="flex items-center justify-center gap-1 text-xs text-red-600">
                                  <AlertTriangle className="w-3 h-3" /> Critical
                                </span>
                              ) : r.isAbnormal ? (
                                <span className="flex items-center justify-center gap-1 text-xs text-amber-600">
                                  <AlertTriangle className="w-3 h-3" /> Abnormal
                                </span>
                              ) : (
                                <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {range ? `${range.minValue ?? '—'} – ${range.maxValue ?? '—'} ${range.unit}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* New result entry form */}
              {canEditResults && resultEntries.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground">New Results</h3>
                  {resultEntries.map((entry, i) => {
                    const test = (tests ?? []).find((t) => t.id === entry.testId);
                    const range = test?.referenceRanges?.[0];
                    return (
                      <div key={i} className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">Test</Label>
                          <select
                            value={entry.testId}
                            onChange={(e) => updateRow(i, { testId: e.target.value })}
                            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                          >
                            <option value="">Select test…</option>
                            {(tests ?? []).filter((t) => t.isActive).map((t) => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <Label className="text-xs mb-1 block">
                            Value {range ? `(${range.minValue}–${range.maxValue} ${range.unit})` : ''}
                          </Label>
                          <Input
                            type="number"
                            step="any"
                            value={entry.numericValue}
                            onChange={(e) => updateRow(i, { numericValue: e.target.value })}
                            className={`h-9 text-sm ${
                              range && entry.numericValue &&
                              (Number(entry.numericValue) < (range.minValue ?? -Infinity) ||
                               Number(entry.numericValue) > (range.maxValue ?? Infinity))
                                ? 'border-amber-400 focus-visible:ring-amber-400'
                                : ''
                            }`}
                          />
                        </div>
                        <div className="w-32">
                          <Label className="text-xs mb-1 block">Text (if applicable)</Label>
                          <Input
                            value={entry.textValue}
                            onChange={(e) => updateRow(i, { textValue: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => submitResults.mutate()}
                    disabled={submitResults.isPending}
                  >
                    {submitResults.isPending ? 'Submitting…' : 'Submit Results'}
                  </Button>
                </div>
              )}

              {(sample.results ?? []).length === 0 && resultEntries.length === 0 && (
                <EmptyState
                  title="No results entered"
                  description={canEditResults ? 'Click "Add Result" to enter test results.' : 'Awaiting result entry.'}
                />
              )}
            </div>
          )}

          {/* Report Tab */}
          {activeTab === 'report' && (
            <div>
              <h2 className="text-sm font-semibold mb-4">Lab Report</h2>
              {sample.report ? (
                <div>
                  <div className="bg-muted/40 rounded-lg p-4 mb-4">
                    <p className="text-sm text-foreground">{sample.report.summary ?? 'No summary.'}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {format(new Date(sample.report.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  {canEditResults && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/lab/reports/${sample.report!.id}`)}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      View Full Report & History
                    </Button>
                  )}
                </div>
              ) : canEditResults ? (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Report Summary</Label>
                    <textarea
                      value={reportSummary}
                      onChange={(e) => setReportSummary(e.target.value)}
                      rows={4}
                      placeholder="Enter clinical summary and interpretation..."
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => createReport.mutate()}
                    disabled={createReport.isPending || (sample.results ?? []).length === 0}
                  >
                    {createReport.isPending ? 'Creating…' : 'Generate Report'}
                  </Button>
                  {(sample.results ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Enter results before generating a report.</p>
                  )}
                </div>
              ) : (
                <EmptyState title="No report yet" description="Report will appear here once generated." />
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && sample.report && (
            <ReportHistory reportId={sample.report.id} />
          )}
          {activeTab === 'history' && !sample.report && (
            <EmptyState title="No report history" description="Report history will appear once a report is generated." />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}

function ReportHistory({ reportId }: { reportId: string }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['lab', 'report', reportId, 'history'],
    queryFn: () =>
      apiClient
        .get(`/lab/reports/${reportId}/history`)
        .then((r) => r.data.data as Array<{
          id: string;
          versionNumber: number;
          summary: string | null;
          editedAt: string;
        }>),
  });

  if (isLoading) return <PageLoader />;
  if (!history?.length) return <EmptyState title="No version history" />;

  return (
    <div>
      <h2 className="text-sm font-semibold mb-4">Report Version History</h2>
      <div className="space-y-3">
        {history.map((v) => (
          <div key={v.id} className="flex items-start gap-3 pb-3 border-b border-border/40 last:border-0">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">v{v.versionNumber}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">
                {format(new Date(v.editedAt), 'MMM d, yyyy HH:mm')}
              </p>
              <p className="text-sm text-foreground">{v.summary ?? '(no summary)'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
