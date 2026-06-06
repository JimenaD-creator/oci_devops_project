/**
 * Productivity score formulas:
 * - Team / sprint (KPI Analytics): completion×0.4 + on-time×0.3 + efficiency×0.2 + workload×0.1
 * - Individual developer: completion×0.45 + on-time×0.35 + efficiency×0.2 (workload shown separately)
 */

export const TEAM_PRODUCTIVITY_WEIGHTS = {
  completionRate: 0.4,
  onTimeDelivery: 0.3,
  efficiencyScore: 0.2,
  workloadBalance: 0.1,
};

export const INDIVIDUAL_PRODUCTIVITY_WEIGHTS = {
  completionRate: 0.45,
  onTimeDelivery: 0.35,
  efficiencyScore: 0.2,
};

const MS_PER_DAY = 86400000;
/** First N calendar days of a sprint: avoid "weak/mixed" performance labels. */
const EARLY_SPRINT_MAX_ELAPSED_DAYS = 4;
/** Or within the first fraction of the sprint window. */
const EARLY_SPRINT_MAX_FRACTION = 0.25;

function startOfLocalDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return x;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return x;
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 23, 59, 59, 999);
}

export function normalizeKpiComponentPercent(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function normalizeWorkloadBalancePercent(rawWb) {
  const raw = Number(rawWb);
  if (!Number.isFinite(raw)) return 0;
  const wb = raw <= 1 ? raw * 100 : raw;
  return Math.min(100, Math.max(0, Math.round(wb)));
}

/**
 * Per-developer workload balance (0–100) for tables and charts — not part of individual productivity score.
 * Measures assignment parity vs teammates (not logged hours vs the busiest person).
 * Developers who finish all assigned work are not over-penalized for a lighter assignment load.
 *
 * @param {{ assigned?: number, completed?: number, hours?: number }} dev
 * @param {Array<{ assigned?: number, completed?: number, hours?: number }>} teamDevs
 */
export function computeIndividualWorkloadBalance(dev, teamDevs = []) {
  const assigned = Math.max(0, Number(dev?.assigned) || 0);
  const completed = Math.max(0, Number(dev?.completed) || 0);
  const hours = Math.max(0, Number(dev?.hours) || 0);

  const active = (teamDevs || []).filter(
    (d) => Math.max(0, Number(d?.assigned) || 0) > 0 || Math.max(0, Number(d?.hours) || 0) > 0,
  );
  if (assigned === 0 && hours === 0) return 0;
  if (active.length <= 1) return 100;

  const counts = active.map((d) => Math.max(0, Number(d?.assigned) || 0));
  const avg = counts.reduce((sum, n) => sum + n, 0) / active.length;
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const spread = Math.max(max - min, 1);

  const distance = Math.abs(assigned - avg);
  let balance = Math.round(100 * (1 - distance / spread));
  balance = Math.min(100, Math.max(0, balance));

  const pending = Math.max(0, assigned - completed);
  if (assigned > 0 && pending === 0) {
    balance = Math.max(balance, 85);
  }

  return balance;
}

/** Efficiency score on KPI cards: 0–100% (estimated ÷ logged hours, capped at 100). */
export function normalizeEfficiencyPercent(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

export function formatEfficiencyScoreDisplay(score) {
  return `${normalizeEfficiencyPercent(score)}%`;
}

export function computeProductivityScore({
  completionRate = 0,
  onTimeDelivery = 0,
  efficiencyScore = 0,
  teamParticipation,
  workloadBalance = 0,
} = {}) {
  const cr = normalizeKpiComponentPercent(completionRate);
  const otd = normalizeKpiComponentPercent(onTimeDelivery);
  const esRaw =
    efficiencyScore != null && efficiencyScore !== ''
      ? efficiencyScore
      : teamParticipation;
  const esForWeight = normalizeEfficiencyPercent(esRaw);
  const wb = normalizeWorkloadBalancePercent(workloadBalance);
  const w = TEAM_PRODUCTIVITY_WEIGHTS;
  const score = Math.round(
    cr * w.completionRate +
      otd * w.onTimeDelivery +
      esForWeight * w.efficiencyScore +
      wb * w.workloadBalance,
  );
  return Math.min(100, Math.max(0, score));
}

/** Individual developer productivity — delivery quality only (no workload term). */
export function computeIndividualProductivityScore({
  completionRate = 0,
  onTimeDelivery = 0,
  efficiencyScore = 0,
  teamParticipation,
} = {}) {
  const cr = normalizeKpiComponentPercent(completionRate);
  const otd = normalizeKpiComponentPercent(onTimeDelivery);
  const esRaw =
    efficiencyScore != null && efficiencyScore !== ''
      ? efficiencyScore
      : teamParticipation;
  const esForWeight = normalizeEfficiencyPercent(esRaw);
  const w = INDIVIDUAL_PRODUCTIVITY_WEIGHTS;
  const score = Math.round(
    cr * w.completionRate + otd * w.onTimeDelivery + esForWeight * w.efficiencyScore,
  );
  return Math.min(100, Math.max(0, score));
}

/** Integer % string as shown on the KPI Productivity Score card (e.g. "78%"). */
export function formatProductivityScoreDisplay(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return '';
  const clamped = Math.min(100, Math.max(0, Math.round(n)));
  return `${clamped}%`;
}

export function productivityScoreFromSprintKpis(kpis) {
  if (!kpis || typeof kpis !== 'object') return 0;
  return computeProductivityScore({
    completionRate: kpis.completionRate,
    onTimeDelivery: kpis.onTimeDelivery,
    efficiencyScore: kpis.efficiencyScore ?? kpis.teamParticipation,
    workloadBalance: kpis.workloadBalance,
  });
}

/**
 * Canonical manager-guide line for Efficiency Score (matches KPI Analytics card).
 */
export function buildEfficiencyKpiAnalyticsGuideLine(score) {
  const n = normalizeEfficiencyPercent(score);
  if (n === 0) {
    return 'Efficiency score is 0% — no worked hours logged yet, or task estimates are missing for comparison.';
  }
  if (n >= 100) {
    return `Efficiency score is ${n}% — estimated hours vs hours logged (100% means on or ahead of estimates).`;
  }
  return `Efficiency score is ${n}% — estimated hours compared to hours logged (below 100 means more time was spent than planned).`;
}

const EFFICIENCY_PARTICIPATION_ECHO_RE =
  /\b(?:team\s+)?participation\b|\bfocused team effort\b|\bparticipation\s+score\b/i;

/** Rewrites legacy participation prose and aligns cited values to the efficiency KPI card. */
export function realignEfficiencyGuideProse(text, score) {
  if (!Number.isFinite(Number(score))) return text;
  const display = formatEfficiencyScoreDisplay(score);
  let out = String(text ?? '').trim();
  out = out.replace(/\bteam\s+participation\b/gi, 'efficiency score');
  out = out.replace(/\bparticipation\s+score\b/gi, 'efficiency score');
  out = out.replace(
    /efficiency\s+score(?:\s+is\s+|\s+of\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
    `efficiency score is ${display}`,
  );
  out = out.replace(
    /(?:team\s+)?participation\s+score(?:\s+is\s+|\s+of\s+)(-?\d+(?:\.\d+)?)\s*%?/gi,
    `efficiency score is ${display}`,
  );
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function shouldReplaceEfficiencyGuideWithCanonical(text) {
  const t = String(text ?? '').trim();
  if (!t) return true;
  return EFFICIENCY_PARTICIPATION_ECHO_RE.test(t);
}

/**
 * Hours logged vs estimated hours on assigned tasks (legacy participation metric).
 * @returns {number|null} 0–100, or null when there is no estimate to compare against.
 */
export function participationRateFromDeveloperHours(hours = 0, assignedHoursEstimate = 0) {
  const h = Math.max(0, Number(hours) || 0);
  const estimate = Math.max(0, Number(assignedHoursEstimate) || 0);
  if (estimate <= 0) return h > 0 ? 0 : null;
  return Math.min(100, Math.round((100 * h) / estimate));
}

/**
 * Per-developer / sprint efficiency: estimated hours ÷ logged hours (0–100%, same as KPI Analytics).
 */
export function efficiencyScoreFromDeveloperHours(hours = 0, assignedHoursEstimate = 0) {
  const worked = Math.max(0, Number(hours) || 0);
  const estimate = Math.max(0, Number(assignedHoursEstimate) || 0);
  if (worked <= 0) return 0;
  return Math.min(100, Math.round((estimate / worked) * 100));
}

export function productivityScoreFromDeveloperMetrics({
  assigned = 0,
  completed = 0,
  hours = 0,
  assignedHoursEstimate = 0,
  onTime = null,
  workload = 0,
} = {}) {
  const a = Math.max(0, Number(assigned) || 0);
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const estimate = Math.max(0, Number(assignedHoursEstimate) || 0);
  const completionRate = a > 0 ? Math.round((100 * c) / a) : 0;
  const onTimeDelivery = typeof onTime === 'number' ? onTime : 0;
  const efficiencyScore = efficiencyScoreFromDeveloperHours(h, estimate);

  return computeIndividualProductivityScore({
    completionRate,
    onTimeDelivery,
    efficiencyScore,
  });
}

/** Productivity score plus KPI component breakdown for dashboard donut / tooltips. */
export function developerProductivityBreakdown({
  assigned = 0,
  completed = 0,
  hours = 0,
  assignedHoursEstimate = 0,
  onTime = null,
  workload = 0,
} = {}) {
  const a = Math.max(0, Number(assigned) || 0);
  const c = Math.max(0, Number(completed) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const estimate = Math.max(0, Number(assignedHoursEstimate) || 0);
  const completionRate = a > 0 ? Math.round((100 * c) / a) : 0;
  const onTimeDelivery = typeof onTime === 'number' ? onTime : 0;
  const efficiencyScore = efficiencyScoreFromDeveloperHours(h, estimate);
  const workloadBalance = Math.min(100, Math.max(0, Math.round(Number(workload) || 0)));
  const score = productivityScoreFromDeveloperMetrics({
    assigned: a,
    completed: c,
    hours: h,
    assignedHoursEstimate: estimate,
    onTime,
    workload,
  });
  return {
    score,
    completionRate,
    onTimeDelivery,
    efficiencyScore,
    workloadBalance,
  };
}

/** Remove Gemini echoes of prompt instructions (KPI Analytics productivity block only). */
export function stripProductivityGuideInstructionEcho(text) {
  if (text == null) return text;
  let out = String(text).trim();
  if (!out) return out;
  out = out.replace(/,?\s*matching the KPI card above\s*\([^)]*\)\.?/gi, '.');
  out = out.replace(/,?\s*matching the KPI card above\.?/gi, '.');
  out = out.replace(/\s*\(completion\s*40\s*%[^)]*workload\s*balance\s*10\s*%\)\.?/gi, '');
  out = out.replace(/\s*\(completion\s*×\s*0\.4[^)]*\)\.?/gi, '');
  out = out
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim();
  return out;
}

/**
 * Sprint calendar context for KPI Analytics prose (aligned with inferStatusByDate).
 * @returns {{ phase: 'not_started'|'in_progress'|'ended'|'unknown', isEarly: boolean, daysElapsed: number|null, daysTotal: number|null }}
 */
export function resolveSprintTimelineContext(sprint) {
  if (!sprint || typeof sprint !== 'object') {
    return { phase: 'unknown', isEarly: true, daysElapsed: null, daysTotal: null };
  }
  const now = new Date();
  const start = new Date(sprint.startDate ?? sprint.start_date);
  const due = new Date(sprint.dueDate ?? sprint.due_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return { phase: 'unknown', isEarly: true, daysElapsed: null, daysTotal: null };
  }
  const rangeStart = startOfLocalDay(start);
  const rangeEnd = endOfLocalDay(due);
  const nowDay = startOfLocalDay(now);

  if (nowDay < rangeStart) {
    return { phase: 'not_started', isEarly: true, daysElapsed: 0, daysTotal: null };
  }
  if (now > rangeEnd) {
    const daysTotal = Math.max(1, Math.round((rangeEnd - rangeStart) / MS_PER_DAY) + 1);
    return {
      phase: 'ended',
      isEarly: false,
      daysElapsed: daysTotal,
      daysTotal,
    };
  }

  const daysTotal = Math.max(1, Math.round((rangeEnd - rangeStart) / MS_PER_DAY) + 1);
  const daysElapsed = Math.max(1, Math.round((nowDay - rangeStart) / MS_PER_DAY) + 1);
  const fraction = daysElapsed / daysTotal;
  const isEarly =
    daysElapsed <= EARLY_SPRINT_MAX_ELAPSED_DAYS || fraction <= EARLY_SPRINT_MAX_FRACTION;

  return { phase: 'in_progress', isEarly, daysElapsed, daysTotal };
}

const NEGATIVE_PERFORMANCE_PHRASE =
  /\b(weak|poor|underperform|under-performing|dragging|mixed|behind|at risk|falling short|struggling)\b/gi;

const LOW_SCORE_EXCUSE_SENTENCE =
  /\b(?:sprint\s+has\s+not\s+started|sprint\s+not\s+started|not\s+started\s+yet|just\s+begun|only\s+just\s+begun|early\s+snapshot|pre-execution|baseline\s+from|does\s+not\s+mean|underperform|little\s+completed\s+work|not\s+poor\s+delivery\s+yet|a\s+low\s+value\s+is\s+expected|few\s+days\s+in|low\s+(?:value|score|figure|percentage)[^.]{0,120}(?:expected|normal|baseline))/i;

/**
 * Removes sentences that excuse a low productivityScore when the sprint has not started or is still early.
 */
export function stripProductivityLowScoreExcuses(text, timeline) {
  if (text == null) return text;
  const phase = timeline?.phase;
  const isEarly = timeline?.isEarly === true || phase === 'not_started';
  if (!isEarly) return text;
  const raw = String(text).trim();
  if (!raw) return raw;
  const parts = raw.split(/(?<=[.!?])\s+/);
  if (parts.length <= 1) {
    return LOW_SCORE_EXCUSE_SENTENCE.test(raw) ? '' : raw;
  }
  const kept = parts.map((p) => p.trim()).filter((p) => p && !LOW_SCORE_EXCUSE_SENTENCE.test(p));
  const out = kept.join(' ').trim();
  return out || raw;
}

const EVOLUTION_NOTE_ALREADY =
  /\b(?:will\s+update|will\s+change|will\s+keep\s+updating|keeps?\s+updating|continues?\s+to\s+update|as\s+the\s+sprint\s+(?:runs|progresses)|during\s+the\s+sprint|tasks?\s+progress|task\s+(?:progress|updates?)|once\s+(?:the\s+)?sprint\s+begins|once\s+work\s+begins|still\s+open|sprint\s+(?:is\s+)?(?:still\s+)?open|pending\s+task|live\s+snapshot|not\s+yet\s+done|not\s+a\s+final|active\s+tasks?|marked\s+done|updates?\s+as\s+more|change\s+during)\b/i;

/** Short forward-looking note (not an excuse for a low %). Never used when the sprint has ended. */
export function productivityEvolutionNote(timeline) {
  const phase = timeline?.phase;
  if (phase === 'ended') {
    return '';
  }
  if (phase === 'not_started') {
    return (
      'It will update once the sprint begins and tasks move through statuses, ' +
      'assignments, and logged hours feed the four KPIs.'
    );
  }
  if (phase === 'in_progress') {
    if (timeline?.isEarly) {
      return (
        'It will keep updating as tasks progress and completion, on-time delivery, ' +
        'participation, and workload balance change during the sprint.'
      );
    }
    return 'It updates as more work is marked Done—not a final grade while the sprint is open.';
  }
  return '';
}

export const PRODUCTIVITY_ENDED_SPRINT_CLOSING =
  'This reflects final delivery for the completed sprint window.';

const ENDED_SPRINT_CLOSING_ALREADY =
  /\b(?:final delivery|completed sprint(?: window)?|sprint has ended|full sprint window|final sprint outcomes?)\b/i;

/** Appends a past-tense closing line once the sprint calendar has ended. */
export function appendProductivityEndedSprintClosing(text, timeline) {
  if (timeline?.phase !== 'ended') return text;
  const raw = String(text ?? '').trim();
  if (!raw) return raw;
  if (ENDED_SPRINT_CLOSING_ALREADY.test(raw)) return raw;
  return `${raw} ${PRODUCTIVITY_ENDED_SPRINT_CLOSING}`;
}

/** Removes forward-looking evolution sentences when the sprint has already ended. */
export function stripProductivityEvolutionNotesForEndedSprint(text, timeline) {
  if (text == null || timeline?.phase !== 'ended') return text;
  const raw = String(text).trim();
  if (!raw) return raw;
  const parts = raw.split(/(?<=[.!?])\s+/);
  if (parts.length <= 1) {
    return EVOLUTION_NOTE_ALREADY.test(raw) ? '' : raw;
  }
  const kept = parts.map((p) => p.trim()).filter((p) => p && !EVOLUTION_NOTE_ALREADY.test(p));
  const out = kept.join(' ').trim();
  return out || raw;
}

/** Appends evolution note when sprint has not started or is still in progress. */
export function appendProductivityEvolutionNote(text, timeline) {
  if (text == null) return text;
  const phase = timeline?.phase;
  if (phase === 'ended') return stripProductivityEvolutionNotesForEndedSprint(text, timeline);
  const needsNote = phase === 'in_progress' || phase === 'not_started';
  if (!needsNote) return text;
  const note = productivityEvolutionNote(timeline);
  if (!note) return text;
  const raw = String(text).trim();
  if (!raw) return note;
  if (EVOLUTION_NOTE_ALREADY.test(raw)) return raw;
  return `${raw} ${note}`;
}

/** Fixes awkward merges from Gemini + evolution note (e.g. "so Pending"). */
export function polishProductivityGuideProse(text) {
  if (text == null) return text;
  let out = String(text).trim();
  if (!out) return out;
  out = out.replace(/\bso Pending tasks\b/g, 'so pending tasks');
  out = out.replace(/\s{2,}/g, ' ');
  return out.trim();
}

function productivityScoreLeadLine(score) {
  const display = formatProductivityScoreDisplay(score);
  if (!display) return '';
  return (
    `The Productivity Score is ${display}, combining completion rate, on-time delivery, ` +
    'team participation, and workload balance into one indicator for overall sprint performance.'
  );
}

function productivityScorePercentPresent(text, score) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  const display = formatProductivityScoreDisplay(score);
  if (display && raw.includes(display)) return true;
  const n = Number(score);
  if (Number.isFinite(n)) {
    const rounded = String(Math.round(n));
    if (new RegExp(`productivity\\s+score\\s+is\\s+${rounded}(?:\\.\\d+)?\\s*%`, 'i').test(raw)) {
      return true;
    }
  }
  return /\bproductivity\s+score\s+is\s+\d+(?:\.\d+)?\s*%/i.test(raw);
}

/**
 * KPI Manager Guide: always show current score % even when excuse-stripping left only the evolution note.
 */
export function finalizeProductivityManagerGuideText(text, score, sprint = null) {
  const display = formatProductivityScoreDisplay(score);
  if (!display) return String(text ?? '').trim();
  let out = String(text ?? '').trim();
  if (!productivityScorePercentPresent(out, score)) {
    const lead = productivityScoreLeadLine(score);
    out = out ? `${lead} ${out}` : lead;
  }
  const timeline = resolveSprintTimelineContext(sprint);
  if (timeline.phase === 'ended') {
    out = stripProductivityEvolutionNotesForEndedSprint(out, timeline);
    out = appendProductivityEndedSprintClosing(out, timeline);
  } else if (timeline.phase === 'not_started' || timeline.phase === 'in_progress') {
    out = appendProductivityEvolutionNote(out, timeline);
  }
  return polishProductivityGuideProse(out.trim());
}

/** Strip judgmental performance labels when sprint has not started or is still early. */
export function softenProductivityGuideForSprintPhase(text, timeline) {
  if (text == null) return text;
  const phase = timeline?.phase;
  const isEarly = timeline?.isEarly === true || phase === 'not_started';
  if (!isEarly) return text;
  let out = String(text).trim();
  if (!out) return out;
  out = out
    .replace(NEGATIVE_PERFORMANCE_PHRASE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return out;
}

/**
 * Fallback when Gemini left productivityScore empty — same role as other KPI lines (value + what it measures).
 * @param {number} score
 * @param {{ startDate?: string, dueDate?: string, start_date?: string, due_date?: string }|null} [sprint]
 */
export function buildProductivityKpiAnalyticsGuideLine(score, sprint = null) {
  return finalizeProductivityManagerGuideText('', score, sprint);
}

/** @deprecated Use buildProductivityKpiAnalyticsGuideLine for KPI Analytics. */
export function buildProductivityManagerGuideLine(score) {
  return buildProductivityKpiAnalyticsGuideLine(score);
}
