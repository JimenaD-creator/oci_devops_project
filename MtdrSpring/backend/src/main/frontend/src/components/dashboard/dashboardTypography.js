/**
 * Shared dashboard typography (inherits app font, usually DM Sans from index.css).
 * Use these sizes everywhere on the dashboard for consistency.
 */
export const FONT = 'inherit';

/** Section headings (e.g. Project status, Developer performance) */
export const SECTION_TITLE_SX = {
  fontSize: '1.125rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
  fontFamily: FONT,
};

/** One line under a section title */
export const SECTION_DESC_SX = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#546E7A',
  lineHeight: 1.55,
  fontFamily: FONT,
};

/** @deprecated Prefer SECTION_TITLE_SX for section headings; kept for legacy imports */
export const SCORECARDS_LABEL_SX = {
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#1565C0',
  textAlign: 'left',
  fontFamily: FONT,
  lineHeight: 1.4,
};

/** Metric card: small label above the number */
export const METRIC_LABEL_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  lineHeight: 1.35,
  fontFamily: FONT,
};

/** Metric card: main value */
export const METRIC_VALUE_SX = {
  fontSize: { xs: '1.75rem', sm: '1.875rem' },
  fontWeight: 800,
  color: '#1A1A1A',
  lineHeight: 1.15,
  fontFamily: FONT,
};

/** Metric card: helper text */
export const METRIC_HELPER_SX = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#546E7A',
  lineHeight: 1.5,
  fontFamily: FONT,
};

/** Chart block title (inside ChartShell) */
export const CHART_TITLE_SX = {
  fontSize: '1.125rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
  fontFamily: FONT,
};

/** Chart block description */
export const CHART_DESC_SX = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#455A64',
  lineHeight: 1.55,
  fontFamily: FONT,
};

/** Recharts axis tick (single size; SVG text may not apply webfont uniformly) */
export const CHART_TICK = { fontSize: 15, fill: '#37474F', fontWeight: 600 };

/** Axis titles (Hours, Tasks, etc.) — slightly larger than ticks */
export const CHART_AXIS_LABEL = { fontSize: 16, fontWeight: 700 };

export const CHART_TOOLTIP_SX = {
  borderRadius: 8,
  border: '1px solid #90CAF9',
  fontSize: 15,
  padding: '11px 15px',
};

/** Recharts Tooltip — avoid clipping; flip near chart edges (not always on the same side). */
export const RECHARTS_TOOLTIP_PROPS = {
  allowEscapeViewBox: { x: true, y: true },
  /** Symmetric offset so fixed x-bias does not force every tooltip to the right. */
  offset: 10,
  /** Recharts 3: tooltip swaps horizontal/vertical side relative to cursor when space is tight. */
  reverseDirectionAllowInDimension: { x: true, y: false },
  wrapperStyle: { outline: 'none', pointerEvents: 'none', zIndex: 30 },
};

/** Bar charts: no gray cursor/overlay — bars keep their fill color on hover. */
export const RECHARTS_BAR_TOOLTIP_PROPS = {
  ...RECHARTS_TOOLTIP_PROPS,
  cursor: false,
};

/** Recharts default Legend (wrapperStyle) */
export const CHART_LEGEND_STYLE = { fontSize: 17, fontWeight: 600, paddingTop: 8 };

/** Custom legend rows: label next to color swatch (MUI Typography) */
export const CHART_LEGEND_ITEM_SX = {
  fontSize: '1rem',
  fontWeight: 600,
  lineHeight: 1.45,
  fontFamily: FONT,
};
