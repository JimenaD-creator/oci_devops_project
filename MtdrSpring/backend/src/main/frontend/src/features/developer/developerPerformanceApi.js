import { API_BASE } from '../ai/aiInsightsConstants';

/**
 * AI personal performance narrative for a developer in a sprint (My Performance).
 * @returns {Promise<{ summary: string|null, configured: boolean, fallback?: boolean, message?: string, error?: string }>}
 */
export async function fetchDeveloperPerformanceSummary(sprintId, userId) {
  const sid = Number(sprintId);
  const uid = Number(userId);
  if (!Number.isFinite(sid) || !Number.isFinite(uid)) {
    throw new Error('Invalid sprint or user id');
  }
  const res = await fetch(
    `${API_BASE}/api/insights/sprint/${sid}/developer-performance-summary?userId=${uid}`,
    { cache: 'no-store', headers: { Accept: 'application/json' } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || `Performance summary HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return {
    summary: data.summary ?? null,
    configured: data.configured !== false,
    fallback: Boolean(data.fallback),
    message: data.message ?? null,
    warning: data.warning ?? null,
    errorDetail: data.errorDetail ?? null,
    error: data.error ?? null,
  };
}
