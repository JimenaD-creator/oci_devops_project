import { useEffect, useRef } from 'react';
import { useProjectData } from '../contexts/ProjectDataContext';

/**
 * Re-runs {@code syncFn} when the shared project bundle was refreshed (e.g. SSE / dashboard).
 * Skips the initial watermark so mount + first load are not duplicated.
 */
export function useProjectBundleSync(syncFn) {
  const { dataUpdatedAt } = useProjectData();
  const lastSyncedRef = useRef(dataUpdatedAt);

  useEffect(() => {
    if (!dataUpdatedAt || dataUpdatedAt === lastSyncedRef.current) {
      return;
    }
    lastSyncedRef.current = dataUpdatedAt;
    syncFn();
  }, [dataUpdatedAt, syncFn]);
}
