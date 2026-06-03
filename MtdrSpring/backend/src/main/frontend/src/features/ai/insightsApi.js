import { API_BASE } from './aiInsightsConstants';

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 400;
const DEFAULT_INSIGHTS_CACHE_MS = 60_000;

/** @type {Map<string, { at: number, result: { notFound: boolean, data: object|null } }>} */
const sprintInsightsCache = new Map();

export function clearSprintInsightsCache(sprintId = null) {
  if (sprintId == null) {
    sprintInsightsCache.clear();
    return;
  }
  sprintInsightsCache.delete(String(sprintId));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseInsightsField(insights) {
  if (insights == null) return null;
  if (typeof insights === 'string') {
    try {
      const parsed = JSON.parse(insights);
      return parsed != null && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof insights === 'object' ? insights : null;
}

/**
 * Fetches persisted sprint insights with retries (avoids flaky failures when
 * the server is busy right after parallel KPI/dashboard loads).
 */
export async function fetchSprintInsights(sprintId, options = {}) {
  const {
    signal,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    cacheMs = DEFAULT_INSIGHTS_CACHE_MS,
    skipCache = false,
  } = options;

  if (sprintId == null) {
    return { notFound: true, data: null };
  }

  const cacheKey = String(sprintId);
  if (!skipCache && cacheMs > 0) {
    const hit = sprintInsightsCache.get(cacheKey);
    if (hit && Date.now() - hit.at < cacheMs) {
      return hit.result;
    }
  }

  const url = `${API_BASE}/api/insights/sprint/${sprintId}`;
  let lastError = null;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      });

      if (res.status === 404) {
        const result = { notFound: true, data: null };
        if (cacheMs > 0) {
          sprintInsightsCache.set(cacheKey, { at: Date.now(), result });
        }
        return result;
      }

      if (!res.ok) {
        throw new Error(`insights HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data != null && typeof data === 'object') {
        data.insights = parseInsightsField(data.insights);
      }
      const result = { notFound: false, data };
      if (cacheMs > 0) {
        sprintInsightsCache.set(cacheKey, { at: Date.now(), result });
      }
      return result;
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') {
        throw err;
      }
      lastError = err;
      if (attempt < retries - 1) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error('insights fetch failed');
}
