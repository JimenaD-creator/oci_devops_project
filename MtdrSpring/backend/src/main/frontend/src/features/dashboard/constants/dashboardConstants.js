/** Max width for the overall dashboard content column. */
export const DASHBOARD_CONTENT_MAX_WIDTH = 1200;

/** Vertical rhythm between major dashboard blocks (sections, charts). */
export const DASHBOARD_SECTION_MB = 2;
export const DASHBOARD_BLOCK_GAP = 2;

/** Primary accent: progress bars, hero KPI, charts (no red — use indigo/blue family). */
export const DASHBOARD_PRIMARY_ACCENT = '#1565C0';

/** Shared across Dashboard, Sprints, KPI Analytics — same accent + frame. */
export const SECTION_BRAND_DARK = '#1A1A1A';
export const SECTION_ACCENT = '#1565C0';
export const SECTION_ACCENT_STRONG = '#0D47A1';
export const SECTION_ACCENT_SOFT = '#5C6BC0';
/** Bar fill when sprint/task progress is complete (indigo, not green). */
export const SECTION_PROGRESS_COMPLETE = '#3949AB';

/** Productivity score KPI — matches KPI Analytics hero / developer productivity section. */
export const PRODUCTIVITY_SCORE_ACCENT = '#2E7D32';

/** rgba(21, 101, 192, α) for borders/focus rings. */
export function sectionRgba(alpha) {
  return `rgba(21, 101, 192, ${alpha})`;
}

/** Dashboard completion-rate bar: red → orange → yellow → green (0–100). */
export function completionRateProgressColor(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  if (p >= 75) return '#2E7D32';
  if (p >= 50) return '#F9A825';
  if (p >= 25) return '#FB8C00';
  return '#E53935';
}
