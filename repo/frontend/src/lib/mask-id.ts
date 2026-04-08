/**
 * Mask an identifier to show only the last 4 characters.
 * Business rule: "only last 4 chars shown in UI" for sensitive identifiers.
 */
export function maskId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 4) return id;
  return '****' + id.slice(-4);
}
