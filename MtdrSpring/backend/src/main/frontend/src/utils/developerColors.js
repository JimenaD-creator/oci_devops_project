/**
 * Stable colors per developer (by name or id string) for avatars and chips.
 * Same key always maps to the same palette entry.
 * Uses FNV-1a + xor mix to spread keys and reduce modulo collisions vs simple 31*h.
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
  { bg: 'rgba(183, 28, 28, 0.14)', color: '#7F0000' },
  { bg: 'rgba(21, 101, 192, 0.16)', color: '#0D3C7A' },
  { bg: 'rgba(56, 142, 60, 0.18)', color: '#33691E' },
  { bg: 'rgba(255, 111, 0, 0.16)', color: '#BF360C' },
  { bg: 'rgba(123, 31, 162, 0.14)', color: '#4A148C' },
  { bg: 'rgba(0, 96, 100, 0.16)', color: '#263238' },
  { bg: 'rgba(233, 30, 99, 0.14)', color: '#880E4F' },
  { bg: 'rgba(255, 193, 7, 0.22)', color: '#F57F17' },
];

function fnv1a32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @param {string|number} nameOrId - developer name or user id */
export function developerAvatarColors(nameOrId) {
  const key = String(nameOrId ?? '');
  const h = fnv1a32(key);
  const hRev = fnv1a32(key.split('').reverse().join(''));
  const mix = (h ^ hRev ^ (h >>> 16) ^ (hRev << 1)) >>> 0;
  const i = mix % DEVELOPER_AVATAR_PALETTE.length;
  return DEVELOPER_AVATAR_PALETTE[i];
}
