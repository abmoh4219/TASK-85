import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['procurement-requests'],
    queryFn: async () => {
      const res = await apiClient.get('/procurement/requests');
      return res.data.data;
    },
  });

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading request...</div>;
  }

  const request = requests?.find((r: { id: string }) => r.id === id);

  if (!request) {
    return <div className="p-6 text-destructive">Purchase request not found.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">
          Purchase Request {request.requestNumber}
        </h1>
        <button
          onClick={() => navigate('/procurement')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Back to Procurement
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Request Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{request.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
            {request.justification && (
              <div className="border-t border-border pt-2">
                <span className="text-muted-foreground block mb-1">Justification</span>
                <p className="text-foreground">{request.justification}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold">Items ({request.items?.length ?? 0})</h2>
          <div className="space-y-2">
            {request.items?.map((item: { id: string; itemId: string; quantity: number; unitOfMeasure?: string }) => (
              <div key={item.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                <span className="font-mono text-xs">{item.itemId.slice(0, 8)}...</span>
                <span className="font-medium">{item.quantity} {item.unitOfMeasure ?? 'units'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
