import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { FlaskConical, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { LabSample } from '@/types';

const STATUS_ORDER = ['submitted', 'in_progress', 'in-progress', 'reported', 'archived'];

function KanbanColumn({
  title,
  samples,
  onOpen,
}: {
  title: string;
  samples: LabSample[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
          {samples.length}
        </span>
      </div>
      <div className="space-y-2">
        {samples.map((s) => (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <p className="text-xs font-medium text-foreground">{s.sampleType}</p>
            {s.patientIdentifier && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Patient: ...{s.patientIdentifier.slice(-4)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(s.collectionDate), 'MMM d')}
            </p>
          </button>
        ))}
        {samples.length === 0 && (
          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function LabPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['lab', 'samples'],
    queryFn: () => apiClient.get('/lab/samples').then((r) => r.data.data as LabSample[]),
  });

  const samples = data ?? [];

  const byStatus = STATUS_ORDER.reduce<Record<string, LabSample[]>>((acc, s) => {
    acc[s] = samples.filter((sample) =>
      s === 'in_progress' ? ['in_progress', 'in-progress'].includes(sample.status) : sample.status === s,
    );
    return acc;
  }, {});

  const COLUMN_LABELS: Record<string, string> = {
    submitted: 'Submitted',
    in_progress: 'In Progress',
    reported: 'Reported',
    archived: 'Archived',
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lab Operations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sample tracking and result management.</p>
        </div>
        <Button size="sm" className="h-8" onClick={() => navigate('/lab/new')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Sample
        </Button>
      </div>

      <ErrorBoundary>
        {isLoading ? (
          <PageLoader />
        ) : samples.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8">
            <EmptyState
              icon={FlaskConical}
              title="No lab samples"
              description="Submit a new sample to get started."
              action={
                <Button size="sm" onClick={() => navigate('/lab/new')}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  New Sample
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* Kanban board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {['submitted', 'in_progress', 'reported', 'archived'].map((status) => (
                <KanbanColumn
                  key={status}
                  title={COLUMN_LABELS[status] ?? status}
                  samples={byStatus[status] ?? []}
                  onOpen={(id) => navigate(`/lab/${id}`)}
                />
              ))}
            </div>

            {/* Table fallback */}
            <div className="bg-card border border-border rounded-xl p-4 mt-4">
              <h2 className="text-sm font-semibold mb-3">All Samples</h2>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Sample Type</th>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Patient</th>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Collection</th>
                    <th className="text-left pb-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s) => (
                    <tr key={s.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/lab/${s.id}`)}>
                      <td className="py-2.5 font-medium">{s.sampleType}</td>
                      <td className="py-2.5 text-muted-foreground">
                        {s.patientIdentifier ? `...${s.patientIdentifier.slice(-4)}` : '—'}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {format(new Date(s.collectionDate), 'MMM d, yyyy')}
                      </td>
                      <td className="py-2.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-2.5 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">View →</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ErrorBoundary>
    </div>
  );
}
