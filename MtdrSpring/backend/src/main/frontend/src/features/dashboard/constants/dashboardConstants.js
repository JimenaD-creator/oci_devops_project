/** Max width for the overall dashboard content column. */
export const DASHBOARD_CONTENT_MAX_WIDTH = 1200;

/** Primary accent: progress bars, hero KPI, charts (no red — use indigo/blue family). */
export const DASHBOARD_PRIMARY_ACCENT = '#1565C0';

/** Shared across Dashboard, Sprints, KPI Analytics — same accent + frame. */
export const SECTION_BRAND_DARK = '#1A1A1A';
export const SECTION_ACCENT = '#1565C0';
export const SECTION_ACCENT_STRONG = '#0D47A1';
export const SECTION_ACCENT_SOFT = '#5C6BC0';
/** Bar fill when sprint/task progress is complete (indigo, not green). */
export const SECTION_PROGRESS_COMPLETE = '#3949AB';

/** rgba(21, 101, 192, α) for borders/focus rings. */
export function sectionRgba(alpha) {
  return `rgba(21, 101, 192, ${alpha})`;
}
