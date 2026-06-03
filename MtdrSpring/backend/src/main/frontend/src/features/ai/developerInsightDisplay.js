const SNAPSHOT_MARKER = ' Current snapshot:';

/** AI narrative from last Generate, plus live snapshot when backend appended stale-fact correction. */
export function developerInsightDisplayText(row) {
  const ai = String(row?.aiNarrative ?? '').trim();
  const insight = String(row?.insight ?? '').trim();
  const snapshotIdx = insight.indexOf(SNAPSHOT_MARKER);
  const snapshotSuffix = snapshotIdx >= 0 ? insight.slice(snapshotIdx).trim() : '';

  if (ai) {
    return snapshotSuffix ? `${ai} ${snapshotSuffix}` : ai;
  }

  if (!insight) return '';
  return snapshotIdx >= 0 ? insight.slice(0, snapshotIdx).trim() : insight;
}

export { SNAPSHOT_MARKER };
