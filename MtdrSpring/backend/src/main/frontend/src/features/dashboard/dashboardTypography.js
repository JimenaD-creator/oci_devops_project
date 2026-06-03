/**
 * Shared dashboard typography (inherits app font, usually DM Sans from index.css).
 * Use these sizes everywhere on the dashboard for consistency.
 */
import { useTheme } from '@mui/material/styles';

export const FONT = 'inherit';

/** Section headings (e.g. Project status, Developer performance) */
export const SECTION_TITLE_SX = {
  fontSize: '1rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
  fontFamily: FONT,
};

/** One line under a section title */
export const SECTION_DESC_SX = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  lineHeight: 1.5,
  fontFamily: FONT,
};

/** @deprecated Prefer SECTION_TITLE_SX for section headings; kept for legacy imports */
export const SCORECARDS_LABEL_SX = {
  fontSize: '0.75rem',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
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
  fontSize: { xs: '1.5rem', sm: '1.65rem' },
  fontWeight: 800,
  lineHeight: 1.15,
  fontFamily: FONT,
};

/** Metric card: helper text */
export const METRIC_HELPER_SX = {
  fontSize: '0.875rem',
  fontWeight: 500,
  lineHeight: 1.5,
  fontFamily: FONT,
};

/** Chart block title (inside ChartShell) */
export const CHART_TITLE_SX = {
  fontSize: '1rem',
  fontWeight: 800,
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
  fontFamily: FONT,
};

/** Chart block description */
export const CHART_DESC_SX = {
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.5,
  fontFamily: FONT,
};

/** Recharts axis tick (single size; SVG text may not apply webfont uniformly) */
export const CHART_TICK = (isDark) => ({
  fontSize: 13,
  fill: isDark ? '#9A9A9A' : '#1A1A1A',
  fontWeight: 600,
});

/** Axis titles (Hours, Tasks, etc.) — slightly larger than ticks */
export const CHART_AXIS_LABEL = { fontSize: 14, fontWeight: 700 };

export const CHART_TOOLTIP_SX = (isDark) => ({
  borderRadius: 8,
  border: `1px solid ${isDark ? '#2A2C32' : '#90CAF9'}`,
  fontSize: 15,
  padding: '11px 15px',
  backgroundColor: isDark ? '#1C1E22' : '#FFFFFF',
  color: isDark ? '#F0F0F0' : '#1A1A1A',
});

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
export const CHART_LEGEND_STYLE = { fontSize: 12, fontWeight: 600, paddingTop: 5 };

/** Custom legend rows: label next to color swatch (MUI Typography) */
export const CHART_LEGEND_ITEM_SX = {
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1.35,
  fontFamily: FONT,
};
