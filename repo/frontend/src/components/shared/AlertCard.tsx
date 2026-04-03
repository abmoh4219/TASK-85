import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';

interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  message: string;
  meta?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const SEVERITY_CONFIG: Record<AlertSeverity, {
  icon: React.FC<{ className?: string }>;
  containerClass: string;
  iconClass: string;
}> = {
  critical: {
    icon: XCircle,
    containerClass: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
    iconClass: 'text-red-500',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
    iconClass: 'text-amber-500',
  },
  info: {
    icon: Info,
    containerClass: 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800',
    iconClass: 'text-blue-500',
  },
  success: {
    icon: CheckCircle,
    containerClass: 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
    iconClass: 'text-green-500',
  },
};

export function AlertCard({
  severity,
  title,
  message,
  meta,
  onAction,
  actionLabel,
  className,
}: AlertCardProps) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border',
        config.containerClass,
        className,
      )}
    >
      <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', config.iconClass)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message}</p>
        {meta && <p className="text-xs text-muted-foreground/70 mt-1">{meta}</p>}
      </div>
      {onAction && actionLabel && (
        <button
          onClick={onAction}
          className="text-xs font-medium text-primary hover:underline flex-shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
