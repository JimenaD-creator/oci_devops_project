/**
 * Single source of truth for Productivity Score (matches KPI Analytics card).
 * Formula: completion×0.4 + on-time×0.3 + participation×0.2 + workload×0.1
 */

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

export function computeProductivityScore({
  completionRate = 0,
  onTimeDelivery = 0,
  teamParticipation = 0,
  workloadBalance = 0,
} = {}) {
  const cr = normalizeKpiComponentPercent(completionRate);
  const otd = normalizeKpiComponentPercent(onTimeDelivery);
  const tp = normalizeKpiComponentPercent(teamParticipation);
  const wb = normalizeWorkloadBalancePercent(workloadBalance);
  const score = Math.round(cr * 0.4 + otd * 0.3 + tp * 0.2 + wb * 0.1);
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
    teamParticipation: kpis.teamParticipation,
    workloadBalance: kpis.workloadBalance,
  });
}

/**
 * Per-developer productivity score (same weights as sprint KPI).
 * Participation = worked hours vs estimated hours on assigned tasks.
 * Workload balance uses relative hours share within the sprint (dashboard dev.workload).
 */
/**
 * Hours logged vs estimated hours on assigned tasks (20% of individual productivity score).
 * @returns {number|null} 0–100, or null when there is no estimate to compare against.
 */
export function participationRateFromDeveloperHours(hours = 0, assignedHoursEstimate = 0) {
  const h = Math.max(0, Number(hours) || 0);
  const estimate = Math.max(0, Number(assignedHoursEstimate) || 0);
  if (estimate <= 0) return h > 0 ? 0 : null;
  return Math.min(100, Math.round((100 * h) / estimate));
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
  const teamParticipation = participationRateFromDeveloperHours(h, estimate) ?? 0;
  const workloadBalance = Math.min(100, Math.max(0, Math.round(Number(workload) || 0)));

  return computeProductivityScore({
    completionRate,
    onTimeDelivery,
    teamParticipation,
    workloadBalance,
  });
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
  /\b(?:will\s+update|will\s+change|keeps?\s+updating|continues?\s+to\s+update|as\s+the\s+sprint\s+(?:runs|progresses)|task\s+(?:progress|updates?)|once\s+(?:the\s+)?sprint\s+begins|once\s+work\s+begins|still\s+open|sprint\s+(?:is\s+)?(?:still\s+)?open|pending\s+task|live\s+snapshot|not\s+yet\s+done|not\s+a\s+final|active\s+tasks?|marked\s+done|updates?\s+as\s+more)\b/i;

/** Short forward-looking note (not an excuse for a low %). */
export function productivityEvolutionNote(timeline) {
  const phase = timeline?.phase;
  if (phase === 'not_started') {
    return (
      'It will update once the sprint begins and tasks move through statuses, ' +
      'assignments, and logged hours feed the four KPIs.'
    );
  }
  if (phase === 'in_progress') {
    return 'It updates as more work is marked Done—not a final grade while the sprint is open.';
  }
  if (timeline?.isEarly) {
    return (
      'It will keep updating as tasks progress and completion, on-time delivery, ' +
      'participation, and workload balance change during the sprint.'
    );
  }
  return '';
}

/** Appends evolution note when sprint has not started or is still early. */
export function appendProductivityEvolutionNote(text, timeline) {
  if (text == null) return text;
  const phase = timeline?.phase;
  const needsNote =
    phase === 'in_progress' || timeline?.isEarly === true || phase === 'not_started';
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
  if (
    timeline.isEarly ||
    timeline.phase === 'not_started' ||
    timeline.phase === 'in_progress'
  ) {
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
