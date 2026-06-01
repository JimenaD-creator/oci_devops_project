import {
  buildProductivityKpiAnalyticsGuideLine,
  computeProductivityScore,
  formatProductivityScoreDisplay,
  resolveSprintTimelineContext,
} from '../kpis/productivityScoreUtils';

export const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export const pageEase = [0.22, 1, 0.36, 1];

/** Short copy for managers / end users (no paths, HTTP codes, or env var names). */
const USER_ERROR_MESSAGES = {
  QUOTA_EXCEEDED: 'Daily AI limit reached. Try again tomorrow.',
  API_KEY_MISSING: 'AI is not available. Contact your administrator.',
  MODEL_NOT_FOUND: 'AI is temporarily unavailable. Try again.',
  SPRINT_NOT_FOUND: 'This sprint could not be found.',
  NO_PROJECT_ASSIGNED: 'Assign a project to this sprint before generating insights.',
  UPSTREAM_TIMEOUT: 'The request took too long. Try again.',
  UPSTREAM_UNAVAILABLE: 'AI is temporarily unavailable. Try again.',
  GENERATION_FAILED: 'Something went wrong. Try again.',
};

export function getErrorMessage(code) {
  if (code == null || code === '') return USER_ERROR_MESSAGES.GENERATION_FAILED;
  const key = String(code).trim();
  return USER_ERROR_MESSAGES[key] ?? USER_ERROR_MESSAGES.GENERATION_FAILED;
}

export function isApiKeyInsightError(code) {
  return String(code ?? '').trim() === 'API_KEY_MISSING';
}

/** Sprint id 0 is valid — do not use `if (!sprintId)` (0 is falsy in JS). */
export function isValidSprintId(sprintId) {
  return sprintId != null && sprintId !== '' && Number.isFinite(Number(sprintId));
}

/**
 * KPI Analytics panel when persisted insights omit kpiManagerGuide (or generation failed partially).
 */
export function buildFallbackKpiManagerGuide(kpis = {}, sprint = null) {
  const cr = Math.round(Number(kpis.completionRate) || 0);
  const otd = Math.round(Number(kpis.onTimeDelivery) || 0);
  const tp = Math.round(Math.min(100, Math.max(0, Number(kpis.teamParticipation) || 0)));
  const wb = Math.round(Math.min(100, Math.max(0, Number(kpis.workloadBalance) || 0)));
  const ps = computeProductivityScore({
    completionRate: cr,
    onTimeDelivery: otd,
    teamParticipation: tp,
    workloadBalance: wb,
  });
  const timeline = resolveSprintTimelineContext(sprint);
  let intro = 'Summary from current sprint KPI scores.';
  if (timeline.phase === 'not_started') {
    intro = 'This sprint has not started yet — KPIs reflect planned scope, not final delivery.';
  } else if (timeline.phase === 'in_progress') {
    intro = 'This sprint is in progress — KPIs are a live snapshot, not final results.';
  } else if (timeline.phase === 'ended') {
    intro = 'This sprint has ended — KPIs summarize delivery for the full sprint window.';
  }

  return {
    intro,
    byMetric: {
      completionRate: `Completion rate is ${cr}% — share of sprint tasks marked done.`,
      onTimeDelivery: `On-time delivery is ${otd}% — completed work finished by the due date.`,
      teamParticipation: `Team participation is ${tp}% — how actively the team engaged in this sprint.`,
      workloadBalance: `Workload balance is ${wb}% — how evenly tasks are distributed across assignees.`,
      productivityScore: buildProductivityKpiAnalyticsGuideLine(ps, sprint),
    },
  };
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

/** "21 percentage points" → "21%" (keeps Gemini sentence structure). */
export function normalizePercentagePointsLabel(text) {
  if (text == null) return text;
  return String(text).replace(/\b(\d+(?:\.\d+)?)\s+percentage points?\b/gi, '$1%');
}

/**
 * Clamp percentage-like values in executive Trends prose to [0, 100].
 * Handles explicit percentages (e.g., "117%") and phrases like "score of 102.2".
 */
export function clampTrendsPercentLikeValues(text) {
  if (text == null) return text;
  let out = normalizePercentagePointsLabel(String(text));
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
  completionRate: [
    /(completion\s*rate(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
    /(current\s+completion\s*rate\s+of\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ],
  onTimeDelivery: [
    /(on[- ]time\s*delivery(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
    /(on[- ]time\s*delivery\s+is\s+at\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ],
  teamParticipation: [
    /(team\s*participation(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
    /(team\s*participation\s+is\s+at\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ],
  workloadBalance: [
    /(workload\s*balance(?:\s+is\s+(?:currently\s+)?|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*%?/gi,
    /(workload\s*balance\s*score\s+of\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ],
  productivityScore: [
    /(productivity\s*score(?:\s+is\s+at\s+|\s+is\s+(?:currently\s+)?|\s+stands\s+at\s+|\s*(?:of|is|was|at)\s*))(-?\d+(?:\.\d+)?)\s*(?:%|points?)?/gi,
    /(the\s+productivity\s*score\s+of\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
  ],
};

/** Gemini often puts the % far from the label ("…declined…, currently at 63%"). */
const KPI_METRIC_PROXIMITY = {
  onTimeDelivery: [
    /(on[- ]time\s*delivery[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(on[- ]time\s*delivery[^.!?]{0,200}?\b(?:is\s+)?at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  completionRate: [
    /(completion\s*rate[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(current\s+completion\s*rate\s+of\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  teamParticipation: [
    /(team\s*participation[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(team\s*participation\s+is\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
  ],
  workloadBalance: [
    /(workload\s*balance[^.!?]{0,280}?\bcurrently\s+at\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
    /(workload\s*balance\s*score\s+of\s+)(-?\d+(?:\.\d+)?)(\s*%)/gi,
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
  out = out.replace(/\bhaving\s+dropped\s+to\s+-?\d+(?:\.\d+)?\s*%/gi, `which is at ${display}`);
  out = out.replace(/\bhaving\s+fallen\s+to\s+-?\d+(?:\.\d+)?\s*%/gi, `which is at ${display}`);
  out = out.replace(/\bdropped\s+to\s+-?\d+(?:\.\d+)?\s*%/gi, `is at ${display}`);
  out = out.replace(/\bfell\s+to\s+-?\d+(?:\.\d+)?\s*%/gi, `is at ${display}`);
  return fixHavingIsAtGrammar(out);
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
  const tightList = tight ? (Array.isArray(tight) ? tight : [tight]) : [];
  tightList.forEach((pattern) => {
    result = result.replace(pattern, (_, prefix) => `${prefix}${display}`);
  });
  if (key === 'onTimeDelivery') {
    result = result.replace(
      /improved on[- ]?time delivery by \d+(?:\.\d+)?\s*%/gi,
      `on-time delivery at ${display}`,
    );
    result = result.replace(
      /(-?\d+(?:\.\d+)?)\s*%\s*(?:improvement|increase|gain|decline|drop|reduction|decrease)\s+in\s+on[- ]?time[^.!?]*/gi,
      `on-time delivery at ${display}`,
    );
    result = result.replace(/driven by a on[- ]?time delivery/gi, 'with on-time delivery');
    result = result.replace(/driven by an on[- ]?time delivery/gi, 'with on-time delivery');
  }
  const proximity = KPI_METRIC_PROXIMITY[key];
  if (proximity) {
    proximity.forEach((pattern) => {
      result = result.replace(pattern, (_, prefix, _n, suffix = '%') => `${prefix}${num}${suffix}`);
    });
  }
  return result;
}

/** Fixes "93% completion rate" when 93 is on-time delivery, not completion rate. */
export function alignCompletionRatePercentLabels(text, metrics = {}) {
  if (text == null || typeof text !== 'string') return text;
  const cr = Number(metrics.completionRate);
  const otd = Number(metrics.onTimeDelivery);
  if (!Number.isFinite(cr) || !Number.isFinite(otd) || Math.abs(cr - otd) <= 3) return text;
  let out = String(text).replace(/(\d+(?:\.\d+)?)\s*%\s*completion\s*rate/gi, (match, cited) => {
    const n = Math.round(Number(cited));
    if (Math.abs(n - otd) <= 2 && Math.abs(n - cr) > 5) {
      return `${Math.round(otd)}% on-time delivery`;
    }
    return `${Math.round(cr)}% completion rate`;
  });
  out = out.replace(
    /(on[- ]?time delivery at \d+)%\.?\s+and\s+a strong on[- ]?time delivery[^.!?]*/gi,
    '$1%',
  );
  return out;
}

/** When trends cite productivity score as on-time improvement, rewrite to live on-time %. */
export function fixProductivityPercentMisattributedToOnTime(text, metrics = {}) {
  if (text == null || typeof text !== 'string') return text;
  const ps = Number(metrics.productivityScore);
  const otd = Number(metrics.onTimeDelivery);
  if (!Number.isFinite(ps) || !Number.isFinite(otd) || Math.abs(ps - otd) <= 3) return text;
  const match = text.match(
    /(\d+(?:\.\d+)?)\s*%\s*(?:improvement|increase|gain|decline|drop|reduction|decrease)\s+in\s+on[- ]?time/i,
  );
  if (!match) return text;
  const cited = Math.round(Number(match[1]));
  if (Math.abs(cited - ps) > 2 || Math.abs(cited - otd) <= 5) return text;
  return applyKpiMetricPatterns(text, 'onTimeDelivery', otd);
}

/**
 * Manager guide metric blocks usually cite one KPI % — force the first % to match the card.
 */
export function alignSingleMetricBlock(text, metricKey, actual) {
  if (text == null || actual == null || !Number.isFinite(Number(actual))) return text;
  const metrics = { [metricKey]: actual };
  let out = alignKpiProseForMetric(String(text), metricKey, metrics);
  const display = formatKpiMetricValue(actual);
  let replacedFirst = false;
  out = out.replace(/(-?\d+(?:\.\d+)?)\s*%/g, (match) => {
    if (replacedFirst) return match;
    replacedFirst = true;
    return display;
  });
  return fixGluedPercentProse(out);
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
  result = fixProductivityPercentMisattributedToOnTime(result, metrics);
  result = alignCompletionRatePercentLabels(result, metrics);
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
  if (metricKey === 'onTimeDelivery' && metrics.onTimeDelivery != null) {
    out = reconcileOnTimeDeliveryConcernProse(out, metrics.onTimeDelivery);
  }
  return out;
}

const ON_TIME_DECLINE_CLAIM_RE =
  /declined|declining|dropped|fell|decreased|reduced|worsened|declined\s+for\s+\d+\s+consecutive/i;

/**
 * Drops on-time "decline" sentences when the live KPI card shows strong delivery (e.g. 100%).
 */
/** Fixes "having is at" after aligning "dropped to" inside "having dropped to". */
export function fixHavingIsAtGrammar(text) {
  if (text == null) return text;
  return String(text).replace(/\bhaving\s+is\s+at\b/gi, 'which is at');
}

/**
 * On-time ≥ 70% should not be called the "primary concern".
 */
export function reconcileOnTimeDeliveryConcernProse(text, onTimePercent) {
  if (text == null || !Number.isFinite(Number(onTimePercent))) return fixHavingIsAtGrammar(text);
  const otd = Number(onTimePercent);
  let out = fixHavingIsAtGrammar(text);
  if (otd < 70 || !/on[- ]?time/i.test(out)) return out;
  const primaryClause =
    /on[- ]?time\s+delivery\s+is\s+the\s+primary\s+concern,?\s*(?:having\s+)?(?:which\s+is\s+at|is\s+at|currently\s+at|now\s+at|stands\s+at)?\s*\d+(?:\.\d+)?\s*%\.?\s*/i;
  if (primaryClause.test(out)) {
    out = out.replace(
      primaryClause,
      `On-Time Delivery is at ${Math.round(otd)}% on completed work. `,
    );
  } else if (/primary\s+concern/i.test(out)) {
    out = out.replace(
      /is\s+the\s+primary\s+concern,?\s*(?:having\s+)?(?:which\s+is\s+at|is\s+at)?\s*\d+(?:\.\d+)?\s*%/gi,
      `is at ${Math.round(otd)}% on completed work`,
    );
  }
  return out.trim();
}

export function stripContradictoryOnTimeDecline(text, onTimePercent) {
  if (text == null || !Number.isFinite(Number(onTimePercent))) return text;
  const otd = Number(onTimePercent);
  if (!ON_TIME_DECLINE_CLAIM_RE.test(text)) return text;
  if (otd < 70) return text;
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    if (!ON_TIME_DECLINE_CLAIM_RE.test(s)) return true;
    return !/on[- ]?time|delivery|consecutive/i.test(s);
  });
  const joined = kept.join(' ').trim();
  return joined || text;
}

/** Placeholder / invalid assignee names — not valid redistribution targets. */
const INVALID_WORKLOAD_DEVELOPER_RE =
  /^(n\/?a|unknown|unassigned|none|tbd|—|-)$/i;

const PLACEHOLDER_WORKLOAD_DEVELOPER_RE =
  /(most[- ]?loaded|least[- ]?loaded).{0,24}developer/i;

/** True when a name can appear in a move-from / move-to workload recommendation. */
export function isValidWorkloadDeveloperName(name) {
  const n = String(name ?? '').trim();
  if (!n) return false;
  if (INVALID_WORKLOAD_DEVELOPER_RE.test(n)) return false;
  if (PLACEHOLDER_WORKLOAD_DEVELOPER_RE.test(n)) return false;
  return true;
}

/** Structured workload row or merged recommendation text is actionable. */
export function isValidWorkloadMoveRecommendation({ from, to, tasksToMove } = {}) {
  const move = Number(tasksToMove);
  if (!Number.isFinite(move) || move < 1) return false;
  if (!isValidWorkloadDeveloperName(from) || !isValidWorkloadDeveloperName(to)) return false;
  if (String(from).trim().toLowerCase() === String(to).trim().toLowerCase()) return false;
  return true;
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
