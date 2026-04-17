/**
 * Stable colors per developer (by name or id string) for avatars and chips.
 * Same key always maps to the same palette entry.
 * Palette avoids pure red/green (reserved for status cues elsewhere).
 */
export const DEVELOPER_AVATAR_PALETTE = [
  { bg: 'rgba(30, 136, 229, 0.18)', color: '#0D47A1' },
  { bg: 'rgba(92, 107, 192, 0.18)', color: '#283593' },
  { bg: 'rgba(251, 140, 0, 0.2)', color: '#E65100' },
  { bg: 'rgba(142, 36, 170, 0.16)', color: '#6A1B9A' },
  { bg: 'rgba(0, 137, 123, 0.18)', color: '#00695C' },
  { bg: 'rgba(94, 53, 177, 0.16)', color: '#4527A0' },
  { bg: 'rgba(194, 24, 91, 0.14)', color: '#AD1457' },
  { bg: 'rgba(245, 124, 0, 0.18)', color: '#EF6C00' },
  { bg: 'rgba(21, 101, 192, 0.14)', color: '#0D3C7A' },
  { bg: 'rgba(0, 121, 107, 0.16)', color: '#004D40' },
  { bg: 'rgba(255, 111, 0, 0.16)', color: '#BF360C' },
  { bg: 'rgba(123, 31, 162, 0.14)', color: '#4A148C' },
  { bg: 'rgba(0, 96, 100, 0.16)', color: '#006064' },
  { bg: 'rgba(233, 30, 99, 0.14)', color: '#880E4F' },
  { bg: 'rgba(255, 193, 7, 0.22)', color: '#F57F17' },
  { bg: 'rgba(63, 81, 181, 0.16)', color: '#1A237E' },
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
