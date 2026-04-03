import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'outline';

const STATUS_MAP: Record<string, StatusVariant> = {
  // Generic
  active: 'success',
  inactive: 'secondary',
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  cancelled: 'secondary',
  draft: 'outline',
  // Procurement
  submitted: 'info',
  under_review: 'warning',
  rfq_created: 'info',
  po_issued: 'info',
  received: 'success',
  reconciled: 'success',
  // Plans
  not_started: 'outline',
  paused: 'warning',
  completed: 'success',
  archived: 'secondary',
  // Rules
  staged: 'warning',
  // Lab
  'in-progress': 'info',
  in_progress: 'info',
  reported: 'success',
  // Alerts
  critical: 'destructive',
  warning: 'warning',
  info: 'info',
  // Projects
  initiation: 'outline',
  change: 'warning',
  inspection: 'info',
  final_acceptance: 'success',
  archive: 'secondary',
  // Anomalies
  reviewed: 'success',
  dismissed: 'secondary',
  escalated: 'destructive',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function formatLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = STATUS_MAP[status.toLowerCase()] ?? 'secondary';
  return (
    <Badge variant={variant} className={cn('capitalize', className)}>
      {formatLabel(status)}
    </Badge>
  );
}
