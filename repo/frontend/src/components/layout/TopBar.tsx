import { useState, useRef, useEffect } from 'react';
import { Bell, LogOut, User, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/features/auth/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiClient.get('/notifications/unread-count').then((r) => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: notifsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get('/notifications').then((r) => r.data.data as Notification[]),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.patch('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = countData?.count ?? 0;
  const notifs = notifsData ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
            ) : (
              notifs.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted transition-colors',
                    !n.isRead && 'bg-primary/5',
                  )}
                  onClick={() => !n.isRead && markRead.mutate(n.id)}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && (
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                    )}
                    <div className={cn(!n.isRead ? '' : 'pl-3.5')}>
                      <p className="text-xs font-medium text-foreground leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-2 pr-1 py-1.5 rounded-md hover:bg-muted transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-foreground leading-none">{user?.username}</p>
          <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{user?.role}</p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-xs font-medium text-foreground">{user?.username}</p>
            <Badge variant="secondary" className="mt-1 text-[10px] capitalize h-4">
              {user?.role}
            </Badge>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

interface TopBarProps {
  title?: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-2">
        {title && <h1 className="text-sm font-semibold text-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}
