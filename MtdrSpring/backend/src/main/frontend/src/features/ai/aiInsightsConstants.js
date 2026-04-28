export const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export const pageEase = [0.22, 1, 0.36, 1];

const ERROR_MESSAGES = {
  QUOTA_EXCEEDED:
    'The AI quota for today has been reached. Please try again tomorrow or use a different API key.',
  API_KEY_MISSING: 'Gemini API key is not configured on the server. Contact your administrator.',
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
  const n = Number(actualScore);
  if (!Number.isFinite(n)) return text;
  const clampedActual = Math.max(0, Math.min(100, n));
  const display = Number.isInteger(clampedActual) ? `${clampedActual}` : `${clampedActual.toFixed(1)}`;
  const source = String(text);
  const explicit = source.replace(
    /(productivity\s+score\s*(?:of|is|:)\s*)(-?\d+(?:\.\d+)?)/gi,
    `$1${display}`,
  );
  if (explicit !== source) return explicit;
  // Fallback for common wording: "Productivity remains high with a score of 100"
  if (/productiv/i.test(source)) {
    return source.replace(/(\bscore\s*(?:of|is|:)\s*)(-?\d+(?:\.\d+)?)/i, `$1${display}`);
  }
  return source;
}

/** Gemini `actionableRecommendations[].category` → UI label */
export const RECOMMENDATION_CATEGORY_LABELS = {
  workload_redistribution: 'Workload redistribution',
  estimates: 'Estimates',
  planning: 'Planning',
  training: 'Training',
  blockers: 'Blockers',
};

/** Shown when a sprint insight section has no AI content yet */
export const AI_INSIGHTS_EMPTY = {
  recommendations: 'No recommendations for this sprint yet. Generate insights to populate this list.',
  executive:
    'No executive summary yet. Generate insights to see overview, trends, improvement areas, and next steps.',
  developers:
    'No per-developer rows in the AI response yet. Add developers to the sprint roster or task assignments, then regenerate. Zero completed tasks should still produce rows when team workload data exists.',
  predictions:
    'No predictions yet. Generate insights to see productivity outlook, risks, and delivery estimates.',
};
