const SNAPSHOT_MARKER = ' Current snapshot:';

/**
 * Developer Analysis table: backend composes {@code insight} on every GET from live USER_TASK
 * data (on-time counts, hours, blockers) and may correct stale Gemini prose.
 */
export function developerInsightDisplayText(row) {
  const insight = String(row?.insight ?? '').trim();
  if (insight) return insight;
  return String(row?.aiNarrative ?? '').trim();
}

export { SNAPSHOT_MARKER };
