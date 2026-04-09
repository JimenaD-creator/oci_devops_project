import { APP_FONT_FAMILY } from '../../theme';
import { DEFINED_DEVELOPER_IDS, DEVELOPER_DISPLAY_NAME } from './dashboardSprintData';

/** Sprint id on a task item (API may use sprintId or sprint). */
export function itemSprintKey(item) {
  const v = item.sprintId ?? item.sprint;
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}

/** Shared task status filter logic (dashboard + Tasks page). */
export function matchesStatusFilter(item, statusFilter) {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'completed') return !!item.done;
  if (item.done) return false;
  const inProgress = item.status === 'in_progress' || item.inProgress === true;
  if (statusFilter === 'pending') return !inProgress;
  if (statusFilter === 'in_progress') return inProgress;
  return true;
}

/** Normalize task developer field to canonical id when possible (developer1 or raw string). */
export function normalizeDeveloperValue(raw) {
  if (raw == null || raw === '') return null;
  if (DEVELOPER_DISPLAY_NAME[raw]) return raw;
  const entry = Object.entries(DEVELOPER_DISPLAY_NAME).find(([, name]) => name === raw);
  return entry ? entry[0] : String(raw);
}

/**
 * All defined team members always listed, plus any extra ids present on items.
 * @returns {{ value: string, label: string }[]}
 */
export function getDeveloperFilterOptions(items) {
  const seen = new Set(DEFINED_DEVELOPER_IDS);
  const list = DEFINED_DEVELOPER_IDS.map((id) => ({
    value: id,
    label: DEVELOPER_DISPLAY_NAME[id],
  }));
  items.forEach((i) => {
    if (!i.developer) return;
    const n = normalizeDeveloperValue(i.developer);
    if (!n) return;
    if (!seen.has(n)) {
      seen.add(n);
      list.push({
        value: n,
        label: DEVELOPER_DISPLAY_NAME[n] || String(n).replace(/_/g, ' '),
      });
    }
  });
  return list.sort((a, b) =>
    a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
  );
}

export function itemMatchesDeveloperFilter(item, developerFilter, unassignedDevValue) {
  if (developerFilter === 'all') return true;
  if (developerFilter === unassignedDevValue) return !item.developer;
  const itemKey = normalizeDeveloperValue(item.developer);
  const filterKey = normalizeDeveloperValue(developerFilter);
  return itemKey === filterKey;
}

/**
 * Due date range on `item.dueDate` (YYYY-MM-DD). Empty `dueFrom`/`dueTo` = no bound.
 * If either bound is set, tasks without `dueDate` are excluded.
 */
export function matchesDueDateRange(item, dueFrom, dueTo) {
  if (!dueFrom && !dueTo) return true;
  let from = dueFrom;
  let to = dueTo;
  if (from && to && from > to) {
    [from, to] = [to, from];
  }
  const raw = item.dueDate;
  if (!raw) return false;
  const d = String(raw).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Same typography as page body + filter row (weight/color). */
export const FILTER_MENU_ITEM_SX = {
  fontFamily: APP_FONT_FAMILY,
  fontSize: '0.875rem',
  fontWeight: 500,
  py: 1.125,
  color: '#333',
};
