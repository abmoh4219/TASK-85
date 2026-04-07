import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';

interface AdminPolicy {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
}

function PolicyCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
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

export function SettingsPage() {
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
        <div className="text-muted-foreground">Loading settings...</div>
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
        {policies?.map((policy) => (
          <PolicyCard
            key={policy.key}
            title={POLICY_TITLES[policy.key] ?? policy.key}
            items={policyToItems(policy)}
          />
        ))}
      </div>
    </div>
  );
}
