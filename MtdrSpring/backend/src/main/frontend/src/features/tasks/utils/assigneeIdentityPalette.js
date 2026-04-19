/**
 * Per-developer colors for multi-assignee UI (table + dialogs).
 * Assignee completion (Done / Pending) uses a separate badge color, not these alone.
 */
export const ASSIGNEE_IDENTITY_PALETTE = [
  { strip: '#3949AB', light: '#E8EAF6', name: '#1A237E' },
  { strip: '#C62828', light: '#FFEBEE', name: '#B71C1C' },
  { strip: '#00695C', light: '#E0F2F1', name: '#004D40' },
  { strip: '#6A1B9A', light: '#F3E5F5', name: '#4A148C' },
  { strip: '#E65100', light: '#FFF3E0', name: '#BF360C' },
  { strip: '#1565C0', light: '#E3F2FD', name: '#0D47A1' },
  { strip: '#558B2F', light: '#F1F8E9', name: '#33691E' },
  { strip: '#4527A0', light: '#EDE7F6', name: '#311B92' },
];

export function assigneeIdentityPaletteIndex(row) {
  const id = row.userId;
  if (id != null && Number.isFinite(Number(id))) {
    return Math.abs(Number(id)) % ASSIGNEE_IDENTITY_PALETTE.length;
  }
  let h = 0;
  const s = String(row.name || '');
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % ASSIGNEE_IDENTITY_PALETTE.length;
}
