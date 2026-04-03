import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Settings2,
  Users,
  Settings,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import type { UserRole } from '@/features/auth/AuthContext';

interface NavItem {
  label: string;
  icon: React.FC<{ className?: string }>;
  path: string;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Procurement', icon: ShoppingCart, path: '/procurement' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Lab', icon: FlaskConical, path: '/lab' },
    { label: 'Projects', icon: FolderOpen, path: '/projects' },
    { label: 'Learning', icon: GraduationCap, path: '/learning' },
    { label: 'Rules Engine', icon: Settings2, path: '/rules-engine' },
    { label: 'Users', icon: Users, path: '/admin/users' },
    { label: 'Settings', icon: Settings, path: '/admin/settings' },
  ],
  supervisor: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Procurement', icon: ShoppingCart, path: '/procurement' },
    { label: 'Inventory', icon: Package, path: '/inventory' },
    { label: 'Lab', icon: FlaskConical, path: '/lab' },
    { label: 'Projects', icon: FolderOpen, path: '/projects' },
    { label: 'Anomaly Queue', icon: AlertOctagon, path: '/anomalies' },
  ],
  hr: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Learning Plans', icon: GraduationCap, path: '/learning' },
    { label: 'Users', icon: Users, path: '/admin/users' },
  ],
  employee: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'My Requests', icon: ShoppingCart, path: '/procurement' },
    { label: 'Lab Samples', icon: FlaskConical, path: '/lab' },
    { label: 'My Tasks', icon: FolderOpen, path: '/projects' },
    { label: 'My Learning', icon: GraduationCap, path: '/learning' },
  ],
};

export function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = user ? NAV_BY_ROLE[user.role] ?? [] : [];

  return (
    <aside
      className={cn(
        'flex flex-col h-screen border-r border-border bg-card sidebar-transition flex-shrink-0',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-border px-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground truncate">MeridianMed</span>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-muted',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
                collapsed && 'justify-center px-0',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <>
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
