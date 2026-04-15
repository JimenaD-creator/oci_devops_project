/**
 * Stable colors per developer (by name or id string) for avatars and chips.
 * Same key always maps to the same palette entry.
 */
export const DEVELOPER_AVATAR_PALETTE = [
  { bg: 'rgba(199, 70, 52, 0.2)', color: '#B71C1C' },
  { bg: 'rgba(30, 136, 229, 0.18)', color: '#0D47A1' },
  { bg: 'rgba(67, 160, 71, 0.2)', color: '#1B5E20' },
  { bg: 'rgba(251, 140, 0, 0.2)', color: '#E65100' },
  { bg: 'rgba(142, 36, 170, 0.16)', color: '#6A1B9A' },
  { bg: 'rgba(0, 137, 123, 0.18)', color: '#00695C' },
  { bg: 'rgba(94, 53, 177, 0.16)', color: '#4527A0' },
  { bg: 'rgba(194, 24, 91, 0.16)', color: '#AD1457' },
  { bg: 'rgba(245, 124, 0, 0.18)', color: '#EF6C00' },
  { bg: 'rgba(0, 121, 107, 0.18)', color: '#004D40' },
];

function hashString(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** @param {string|number} nameOrId - developer name or user id */
export function developerAvatarColors(nameOrId) {
  const key = String(nameOrId ?? '');
  const i = hashString(key) % DEVELOPER_AVATAR_PALETTE.length;
  return DEVELOPER_AVATAR_PALETTE[i];
}
