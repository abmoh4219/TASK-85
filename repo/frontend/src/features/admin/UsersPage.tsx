import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { Users, Plus, X, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';

interface User {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function UsersPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ username: '', password: '', role: 'employee' });
  const [editRole, setEditRole] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => apiClient.get('/admin/users').then((r) => r.data.data as User[]),
  });

  const create = useMutation({
    mutationFn: () =>
      apiClient.post('/admin/users', {
        username: createForm.username,
        password: createForm.password,
        role: createForm.role,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreate(false);
      setCreateForm({ username: '', password: '', role: 'employee' });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create user.');
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiClient.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditUser(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to update user.');
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/users/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirmDeactivate(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Failed to deactivate user.');
    },
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/admin/users/${id}`, { isActive: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const users = data ?? [];

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: 'Username',
      cell: ({ row }) => (
        <span className="text-sm font-medium font-mono">{row.original.username}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant="secondary" className="capitalize text-xs">{row.original.role}</Badge>
      ),
      size: 100,
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} />
      ),
      size: 90,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Last Login',
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.lastLoginAt
            ? format(new Date(row.original.lastLoginAt), 'MMM d, HH:mm')
            : 'Never'}
        </span>
      ),
      size: 110,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); setEditUser(row.original); setEditRole(row.original.role); }}
          >
            Edit Role
          </Button>
          {row.original.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(row.original.id); }}
            >
              <UserX className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-green-600 hover:text-green-700"
              onClick={(e) => { e.stopPropagation(); reactivate.mutate(row.original.id); }}
            >
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage system users.</p>
        </div>
        <Button size="sm" className="h-8" onClick={() => setShowCreate(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New User
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      {/* Create user form */}
      {showCreate && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">New User</h2>
            <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <Label className="text-xs mb-1 block">Username *</Label>
              <Input
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="username"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Password *</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Role</Label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8"
            onClick={() => create.mutate()}
            disabled={!createForm.username || !createForm.password || create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create User'}
          </Button>
        </div>
      )}

      {/* Edit role panel */}
      {editUser && (
        <div className="bg-muted/30 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Edit Role: {editUser.username}</h2>
            <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="employee">Employee</option>
              <option value="hr">HR</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              size="sm"
              className="h-8"
              onClick={() => updateRole.mutate({ id: editUser.id, role: editRole })}
              disabled={editRole === editUser.role || updateRole.isPending}
            >
              {updateRole.isPending ? 'Saving…' : 'Save Role'}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-4">
        <ErrorBoundary>
          {isLoading ? (
            <PageLoader />
          ) : users.length === 0 ? (
            <EmptyState icon={Users} title="No users" description="No users found." />
          ) : (
            <DataTable
              columns={columns}
              data={users}
              searchColumn="username"
              searchPlaceholder="Search users..."
            />
          )}
        </ErrorBoundary>
      </div>

      <ConfirmDialog
        open={!!confirmDeactivate}
        onOpenChange={(o) => !o && setConfirmDeactivate(null)}
        title="Deactivate User"
        description="This user will lose access to the system. You can reactivate them later."
        confirmLabel="Deactivate"
        destructive
        onConfirm={() => confirmDeactivate && deactivate.mutate(confirmDeactivate)}
      />
    </div>
  );
}
