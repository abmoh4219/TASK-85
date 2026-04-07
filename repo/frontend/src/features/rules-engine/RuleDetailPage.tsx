import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export function RuleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: rule, isLoading } = useQuery({
    queryKey: ['rule', id],
    queryFn: async () => {
      const res = await apiClient.get(`/rules/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading rule...</div>;
  }

  if (!rule) {
    return <div className="p-6 text-destructive">Rule not found.</div>;
  }

  const currentVersion = rule.versions?.find(
    (v: { versionNumber: number }) => v.versionNumber === rule.currentVersion,
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{rule.name}</h1>
        <button
          onClick={() => navigate('/rules-engine')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Rules
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Rule Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-medium capitalize">{rule.status}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium">{rule.category}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">v{rule.currentVersion}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Rollout</span><span className="font-medium">{rule.rolloutPercentage}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">A/B Test</span><span className="font-medium">{rule.isAbTest ? 'Yes' : 'No'}</span></div>
          </div>
          {rule.description && (
            <p className="text-sm text-muted-foreground border-t border-border pt-2">{rule.description}</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Current Definition</h2>
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64 font-mono">
            {currentVersion?.definition ? JSON.stringify(currentVersion.definition, null, 2) : 'No definition available'}
          </pre>
        </div>
      </div>

      {rule.versions?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Version History</h2>
          <div className="space-y-2">
            {rule.versions
              .sort((a: { versionNumber: number }, b: { versionNumber: number }) => b.versionNumber - a.versionNumber)
              .map((v: { versionNumber: number; changeSummary?: string; createdAt: string; activatedAt?: string; rolledBackAt?: string }) => (
                <div key={v.versionNumber} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium">v{v.versionNumber}</span>
                  <span className="text-muted-foreground">{v.changeSummary || 'No summary'}</span>
                  <span className="text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
