/**
 * Single source of truth for Productivity Score (matches KPI Analytics card).
 * Formula: completion×0.4 + on-time×0.3 + participation×0.2 + workload×0.1
 */

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
 * Manager guide / AI Insights: always match the Productivity Score KPI card (ignore stale Gemini numbers).
 */
export function buildProductivityManagerGuideLine(score) {
  const display = formatProductivityScoreDisplay(score);
  if (!display) return '';
  return `The Productivity Score is ${display}, matching the KPI card above (completion 40%, on-time delivery 30%, team participation 20%, workload balance 10%).`;
}
