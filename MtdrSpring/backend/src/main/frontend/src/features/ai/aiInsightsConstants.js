import { formatProductivityScoreDisplay } from '../kpis/productivityScoreUtils';

export const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export const pageEase = [0.22, 1, 0.36, 1];

const ERROR_MESSAGES = {
  QUOTA_EXCEEDED:
    'The AI quota for today has been reached. Please try again tomorrow or use a different API key.',
  API_KEY_MISSING:
    'Gemini API key is not configured on the server. Set GEMINI_API_KEY in MtdrSpring/backend/.env and restart the backend.',
  MODEL_NOT_FOUND: 'The AI model is unavailable. Contact your administrator.',
  SPRINT_NOT_FOUND: 'This sprint was not found in the database.',
  NO_PROJECT_ASSIGNED:
    'This sprint has no project assigned. Assign a project before generating insights.',
  UPSTREAM_TIMEOUT: 'The AI service took too long to respond. Please try again.',
  UPSTREAM_UNAVAILABLE: 'The AI service is temporarily unavailable. Please try again shortly.',
  GENERATION_FAILED: 'AI generation failed unexpectedly. Please try again.',
};

export function getErrorMessage(code) {
  return ERROR_MESSAGES[code] ?? `Generation failed: ${code}`;
}

export const KPI_LABELS = {
  completionRate: 'Completion Rate',
  onTimeDelivery: 'On-Time Delivery',
  teamParticipation: 'Team Participation',
  workloadBalance: 'Workload Balance',
  productivityScore: 'Productivity Score',
  blockers: 'Blockers',
};

/** Only these `kpi` fields on alerts are 0–100% — others (e.g. blockers) must not show a % suffix. */
export const KPI_ALERT_PERCENT_KEYS = new Set([
  'completionRate',
  'onTimeDelivery',
  'teamParticipation',
  'workloadBalance',
  'productivityScore',
]);

/** KPI alert values are shown as %; clamp to [0, 100] (e.g. team participation can exceed 100 when hours > expected). */
export function clampKpiPercentForDisplay(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Math.min(100, Math.max(0, n));
}

/** If AI prose repeats the same raw % as {@code value}, align it to the clamped % (e.g. 117% → 100%). */
export function alignAlertMessagePercent(prose, rawValue) {
  if (prose == null || rawValue == null) return prose;
  const raw = Number(rawValue);
  if (!Number.isFinite(raw)) return prose;
  const clamped = Number(clampKpiPercentForDisplay(rawValue));
  if (raw === clamped) return prose;
  return String(prose).split(`${raw}%`).join(`${clamped}%`);
}

/**
 * Clamp percentage-like values in executive Trends prose to [0, 100].
 * Handles explicit percentages (e.g., "117%") and phrases like "score of 102.2".
 */
export function clampTrendsPercentLikeValues(text) {
  if (text == null) return text;
  let out = String(text);
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const toDisplay = (n) => {
    const c = clamp(Number(n));
    return Number.isInteger(c) ? `${c}` : `${c.toFixed(1)}`;
  };

  out = out.replace(/(-?\d+(?:\.\d+)?)%/g, (m, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return m;
    const c = clamp(n);
    return c === n ? m : `${toDisplay(n)}%`;
  });

  out = out.replace(/(score\s*(?:of|is|:)\s*)(-?\d+(?:\.\d+)?)/gi, (m, prefix, raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return m;
    const c = clamp(n);
    return c === n ? m : `${prefix}${toDisplay(n)}`;
  });

  return out;
}

/**
 * Align "productivity score" phrases in Trends to the selected sprint's real score.
 * Example: "score of 100" -> "score of 97" when actual score is 97.
 */
export function alignTrendsProductivityScore(text, actualScore) {
  if (text == null || actualScore == null) return text;
  const display = formatProductivityScoreDisplay(actualScore);
  if (!display) return text;
  const source = String(text);
  const explicit = source.replace(
    /(productivity\s+score\s*(?:of|is|:|at)\s*)(-?\d+(?:\.\d+)?)(?:\s*%)?/gi,
    `$1${display}`,
  );
  if (explicit !== source) return explicit;
  if (/productiv/i.test(source)) {
    return source.replace(/(\bscore\s*(?:of|is|:|at)\s*)(-?\d+(?:\.\d+)?)(?:\s*%)?/gi, `$1${display}`);
  }
  return source;
}

/**
 * Align all productivity-score mentions in AI prose to the KPI card value (integer %, e.g. 78%).
 */
export function alignProductivityScoreProse(text, actualScore) {
  if (text == null || actualScore == null) return text;
  const display = formatProductivityScoreDisplay(actualScore);
  if (!display) return text;
  let out = alignKpiMetricsInText(String(text), { productivityScore: actualScore });
  out = alignTrendsProductivityScore(out, actualScore);
  const productivityPatterns = [
    /(productivity\s*score[^0-9]{0,48}?)(-?\d+(?:\.\d+)?)\s*(?:%|points?)?/gi,
    /(overall\s+productivity[^0-9]{0,40}?)(-?\d+(?:\.\d+)?)\s*%?/gi,
    /(composite\s+score[^0-9]{0,32}?)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ];
  productivityPatterns.forEach((pattern) => {
    out = out.replace(pattern, (_, prefix) => `${prefix}${display}`);
  });
  if (/productiv/i.test(out)) {
    out = out.replace(
      /(\bscore\s*(?:is\s+)?(?:at\s+)?(?:currently\s+)?(?:stands\s+at\s+|of\s+)?)(-?\d+(?:\.\d+)?)\s*(?:%|points?)?/gi,
      `$1${display}`,
    );
  }
  // Gemini often writes "At 67.9%, the composite..." without the words "productivity score".
  out = out.replace(
    /^(\s*At\s+)(-?\d+(?:\.\d+)?)(\s*%)/i,
    `$1${display}`,
  );
  out = out.replace(
    /(composite(?:\s+\w+){0,8}?\s+(?:is\s+)?(?:at\s+)?)(-?\d+(?:\.\d+)?)\s*%?/gi,
    `$1${display}`,
  );
  return out;
}

function formatKpiMetricNumber(rawValue) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return '0';
  return String(Math.round(Math.min(100, Math.max(0, n))));
}

function formatKpiMetricValue(rawValue) {
  return `${formatKpiMetricNumber(rawValue)}%`;
}

const KPI_METRIC_PATTERNS = {
  completionRate:
    /(completion\s*rate(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
  onTimeDelivery:
    /(on[- ]time\s*delivery(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
  teamParticipation:
    /(team\s*participation(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
  workloadBalance:
    /(workload\s*balance(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
  productivityScore:
    /(productivity\s*score(?:\s+is\s+at\s+|\s+is\s+(?:currently\s+)?|\s+stands\s+at\s+|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*(?:%|points?)?/gi,
};

/** Gemini often puts the % far from the label ("…declined…, currently at 63%"). */
const KPI_METRIC_PROXIMITY = {
  onTimeDelivery: [
    /(on[- ]time\s*delivery[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(on[- ]time\s*delivery[^.!?]{0,200}?\b(?:is\s+)?at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  completionRate: [
    /(completion\s*rate[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  teamParticipation: [
    /(team\s*participation[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  workloadBalance: [
    /(workload\s*balance[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  productivityScore: [
    /(productivity\s*score[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(overall\s+productivity[^.!?]{0,200}?\b(?:is\s+)?at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
};

/**
 * Replace loose "currently at 63%" style phrases (alert bodies, manager guide).
 */
export function alignAlertLoosePercents(text, actualPercent) {
  if (text == null || actualPercent == null) return text;
  const display = formatKpiMetricValue(actualPercent);
  let out = String(text);
  out = out.replace(/\bcurrently\s+at\s+-?\d+(?:\.\d+)?\s*%/gi, `currently at ${display}`);
  out = out.replace(/\bnow\s+at\s+-?\d+(?:\.\d+)?\s*%/gi, `now at ${display}`);
  out = out.replace(/\bstands\s+at\s+-?\d+(?:\.\d+)?\s*%/gi, `stands at ${display}`);
  return out;
}

/** Fixes "0%as" → "0% as" after KPI % alignment (regex consumed optional %). */
export function fixGluedPercentProse(text) {
  if (text == null) return text;
  return String(text).replace(/(\d+)\s*%([a-zA-Z])/g, '$1% $2');
}

function applyKpiMetricPatterns(text, key, actual) {
  const num = formatKpiMetricNumber(actual);
  const display = formatKpiMetricValue(actual);
  let result = text;
  const tight = KPI_METRIC_PATTERNS[key];
  if (tight) {
    result = result.replace(tight, (_, prefix) => `${prefix}${display}`);
  }
  const proximity = KPI_METRIC_PROXIMITY[key];
  if (proximity) {
    proximity.forEach((pattern) => {
      result = result.replace(pattern, (_, prefix, _n, suffix = '%') => `${prefix}${num}${suffix}`);
    });
  }
  return result;
}

/**
 * Align AI prose to live KPI card values (KPI Analytics + AI Insights).
 */
export function alignKpiMetricsInText(text, metrics = {}) {
  if (text == null || typeof text !== 'string') return text;
  let result = String(text);
  Object.entries(metrics).forEach(([key, actual]) => {
    if (actual == null || !Number.isFinite(Number(actual))) return;
    result = applyKpiMetricPatterns(result, key, actual);
  });
  return fixGluedPercentProse(result);
}

/**
 * Full pass for a single KPI block (alerts, manager guide lines).
 */
export function alignKpiProseForMetric(text, metricKey, metrics = {}) {
  if (text == null) return text;
  const aligned = alignKpiMetricsInText(text, metrics);
  const actual = metrics[metricKey];
  if (actual == null) return aligned;
  let out = alignAlertLoosePercents(aligned, actual);
  if (metricKey === 'productivityScore') {
    out = alignProductivityScoreProse(out, actual);
  }
  return out;
}

/** Gemini `actionableRecommendations[].category` → UI label */
export const RECOMMENDATION_CATEGORY_LABELS = {
  workload_redistribution: 'Workload redistribution',
  estimates: 'Estimates',
  planning: 'Planning',
  training: 'Training',
  blockers: 'Blockers',
};

/** Workload balance >= 70 = even task assignment; Gemini often confuses this with execution pace. */
const WORKLOAD_UNEVEN_PROSE =
  /\b(uneven|unbalanced|imbalance|imbalanced|bottleneck|desigual|desbalancead[oa]s?|not being executed evenly|not executed evenly)\b/i;

export function normalizeWorkloadBalanceGuideText(text, workloadBalancePct) {
  const wb = Number(workloadBalancePct);
  if (!Number.isFinite(wb) || wb < 70) return text;
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw || !WORKLOAD_UNEVEN_PROSE.test(raw)) return text;
  const pct = Math.round(Math.min(100, Math.max(0, wb)));
  return (
    `At ${pct}%, task assignments are well balanced across developers with work in this sprint. ` +
    'This KPI measures how evenly tasks are distributed, not how fast each person completes them — ' +
    'use completion rate or developer insights if execution pace differs between teammates.'
  );
}

/** Shown when a sprint insight section has no AI content yet */
export const AI_INSIGHTS_EMPTY = {
  recommendations:
    'No recommendations for this sprint yet. Generate insights to populate this list.',
  executive:
    'No executive summary yet. Generate insights to see overview, trends, improvement areas, and next steps.',
  developers:
    'No per-developer rows in the AI response yet. Add developers to the sprint roster or task assignments, then regenerate. Zero completed tasks should still produce rows when team workload data exists.',
  predictions:
    'No predictions yet. Generate insights to see productivity outlook, risks, and delivery estimates.',
};
