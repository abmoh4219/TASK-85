import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/shared/LoadingSpinner';
import { Save, X } from 'lucide-react';

interface AdminPolicy {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
}

function PolicyCard({
  title,
  items,
  editable,
  onEdit,
}: {
  title: string;
  items: { label: string; value: string }[];
  editable?: boolean;
  onEdit?: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {editable && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {items.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportPermissionsEditor({
  policy,
  onClose,
}: {
  policy: AdminPolicy;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const roles = ['admin', 'supervisor', 'hr', 'employee'] as const;
  const [scopes, setScopes] = useState<Record<string, string>>(() => {
    const v = policy.value as Record<string, { scope: string; fields?: string }>;
    return Object.fromEntries(roles.map((r) => [r, v[r]?.scope ?? '']));
  });

  const update = useMutation({
    mutationFn: () => {
      const value: Record<string, { scope: string; fields: string }> = {};
      for (const r of roles) {
        value[r] = { scope: scopes[r], fields: r === 'admin' ? '*' : 'standard' };
      }
      return apiClient.patch(`/admin/settings/${policy.key}`, { value });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-policies'] });
      onClose();
    },
  });

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Edit Export Permissions</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role} className="flex items-center gap-3">
            <span className="text-sm font-medium capitalize w-24">{role}</span>
            <Input
              value={scopes[role]}
              onChange={(e) => setScopes((s) => ({ ...s, [role]: e.target.value }))}
              placeholder="e.g. all, procurement,inventory, own-records"
              className="h-8 text-sm"
            />
          </div>
        ))}
      </div>
      <Button
        size="sm"
        className="mt-3 h-8"
        onClick={() => update.mutate()}
        disabled={update.isPending}
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        {update.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
      {update.isError && <p className="text-xs text-destructive mt-2">Failed to save.</p>}
    </div>
  );
}

function policyToItems(policy: AdminPolicy): { label: string; value: string }[] {
  const v = policy.value;
  switch (policy.key) {
    case 'rate-limiting':
      return [
        { label: 'Sensitive Actions Limit', value: `${v.limit} requests / ${v.ttlSeconds}s / user` },
        { label: 'Scope', value: Array.isArray(v.sensitiveEndpoints) ? (v.sensitiveEndpoints as string[]).join(', ') : String(v.sensitiveEndpoints ?? '') },
        { label: 'Enabled', value: v.enabled ? 'Yes' : 'No' },
      ];
    case 'jwt-config':
      return [
        { label: 'Access Token Expiry', value: String(v.accessTokenExpiry) },
        { label: 'Refresh Token Expiry', value: String(v.refreshTokenExpiry) },
        { label: 'Server-side Storage', value: v.serverSideStorage ? 'Yes' : 'No' },
        { label: 'Token Rotation', value: v.tokenRotation ? 'On every refresh' : 'Disabled' },
      ];
    case 'export-permissions': {
      const roles = v as Record<string, { scope: string }>;
      return Object.entries(roles).map(([role, perm]) => ({
        label: role.charAt(0).toUpperCase() + role.slice(1),
        value: perm.scope === 'all' ? 'All fields exportable' : perm.scope,
      }));
    }
    case 'data-security':
      return [
        { label: 'Column Encryption', value: String(v.encryptionAlgorithm) },
        { label: 'Password Hashing', value: String(v.passwordHashing) },
        { label: 'Identifier Masking', value: v.identifierMasking ? 'Last 4 chars only' : 'Disabled' },
        { label: 'Delete Policy', value: v.softDeletesOnly ? 'Soft deletes only' : 'Mixed' },
      ];
    default:
      return Object.entries(v).map(([k, val]) => ({ label: k, value: String(val) }));
  }
}

const POLICY_TITLES: Record<string, string> = {
  'rate-limiting': 'Rate Limiting',
  'jwt-config': 'JWT Configuration',
  'export-permissions': 'Export Permissions',
  'data-security': 'Data Security',
};

const EDITABLE_POLICIES = new Set(['export-permissions']);

export function SettingsPage() {
  const [editing, setEditing] = useState<string | null>(null);

  const { data: policies, isLoading, error } = useQuery<AdminPolicy[]>({
    queryKey: ['admin-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/settings');
      return res.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-6">Security Settings</h1>
        <PageLoader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-foreground mb-6">Security Settings</h1>
        <div className="text-destructive">Failed to load settings. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-foreground mb-6">Security Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {policies?.map((policy) =>
          editing === policy.key ? (
            <ExportPermissionsEditor
              key={policy.key}
              policy={policy}
              onClose={() => setEditing(null)}
            />
          ) : (
            <PolicyCard
              key={policy.key}
              title={POLICY_TITLES[policy.key] ?? policy.key}
              items={policyToItems(policy)}
              editable={EDITABLE_POLICIES.has(policy.key)}
              onEdit={() => setEditing(policy.key)}
            />
          ),
        )}
      </div>
    </div>
  );
}
