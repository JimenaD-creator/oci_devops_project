/**
 * Normalizes backend/user payloads (Oracle/JPA, nested ids, strings) to a single positive numeric id.
 */

function toPositiveFiniteNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    return Number.isFinite(v) && v > 0 ? v : null;
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Coerces a scalar or id-shaped object to a positive finite user id, or null.
 */
export function normalizeUserId(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') {
    const nested =
      raw.id ??
      raw.ID ??
      raw.userId ??
      raw.USER_ID ??
      raw.user_id;
    return toPositiveFiniteNumber(nested);
  }
  return toPositiveFiniteNumber(raw);
}

/**
 * Resolves a numeric user id from a developer row, USER_TASK fragment, or plain id value.
 */
export function developerNumericId(u) {
  if (u == null || u === '') return null;
  if (typeof u === 'object') {
    const nested =
      u.id ??
      u.ID ??
      u.userId ??
      u.USER_ID ??
      u.user_id;
    const fromFields = normalizeUserId({ id: nested });
    return fromFields ?? normalizeUserId(u);
  }
  return normalizeUserId(u);
}

/**
 * Deduplicated list of positive finite user ids (stable order).
 */
export function finiteUserIds(input) {
  if (input == null) return [];
  const arr = Array.isArray(input) ? input : [input];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const n = developerNumericId(item) ?? normalizeUserId(item);
    if (n == null || !Number.isFinite(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * MUI Select `multiple` onChange value → clean numeric id array.
 */
export function multiselectNumericIds(value) {
  if (value == null) return [];
  return finiteUserIds(Array.isArray(value) ? value : [value]);
}
