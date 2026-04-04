export function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-foreground mb-6">Security Settings</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Rate Limiting</h2>
          <div className="space-y-2">
            {[
              { label: 'Sensitive Actions Limit', value: '10 requests / minute / user' },
              { label: 'Scope', value: 'Login, Procurement, Rules Engine' },
              { label: 'Response on Breach', value: 'HTTP 429 Too Many Requests' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium font-mono">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">JWT Configuration</h2>
          <div className="space-y-2">
            {[
              { label: 'Access Token Expiry', value: '15 minutes' },
              { label: 'Refresh Token Expiry', value: '8 hours' },
              { label: 'Refresh Token Storage', value: 'Server-side (hashed)' },
              { label: 'Token Rotation', value: 'On every refresh' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Export Permissions</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            {[
              { role: 'Admin', permissions: 'All fields exportable' },
              { role: 'Supervisor', permissions: 'Procurement, Inventory, Projects' },
              { role: 'HR', permissions: 'Learning plans, User reports' },
              { role: 'Employee', permissions: 'Own records only' },
            ].map(({ role, permissions }) => (
              <div key={role} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="font-medium capitalize text-foreground">{role}</span>
                <span>{permissions}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-3">Data Security</h2>
          <div className="space-y-2">
            {[
              { label: 'Column Encryption', value: 'AES-256' },
              { label: 'Password Hashing', value: 'bcrypt (rounds: 12)' },
              { label: 'Identifier Masking', value: 'Last 4 chars only' },
              { label: 'Delete Policy', value: 'Soft deletes only' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
