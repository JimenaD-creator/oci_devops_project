import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchDashboardSprints,
  fetchProjectBundleRaw,
  getCachedBundleSnapshot,
  invalidateDashboardCache,
} from '../features/dashboard/dashboardSprintData';

const ProjectDataContext = createContext(null);

/**
 * Preloads and shares enriched sprints + raw tasks/user-tasks for the active project.
 * Reduces repeated triple-fetch when navigating between pages.
 */
export function ProjectDataProvider({ projectId, children }) {
  const [sprints, setSprints] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;

  const applySnapshot = useCallback((snap) => {
    if (!snap) return false;
    if (Array.isArray(snap.enrichedSprints)) {
      setSprints(snap.enrichedSprints);
    }
    setTaskCount(Array.isArray(snap.tasks) ? snap.tasks.length : 0);
    return true;
  }, []);

  const load = useCallback(
    async (options = {}) => {
      if (!pid) {
        setSprints([]);
        setTaskCount(0);
        setError(null);
        return;
      }
      const forceFresh = Boolean(options.forceFresh);
      const snap = !forceFresh ? getCachedBundleSnapshot(pid) : null;
      const hadCache = applySnapshot(snap);

      if (!options.silent && !hadCache) {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await fetchDashboardSprints(pid, { forceFresh });
        setSprints(Array.isArray(data) ? data : []);
        const freshSnap = getCachedBundleSnapshot(pid);
        if (freshSnap) {
          setTaskCount(freshSnap.taskCount ?? 0);
        }
      } catch (e) {
        setError(e);
        if (!hadCache) {
          setSprints([]);
          setTaskCount(0);
        }
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [pid, applySnapshot],
  );

  useEffect(() => {
    load({ silent: false });
  }, [load]);

  const refresh = useCallback(
    (options = {}) => load({ forceFresh: Boolean(options.forceFresh), silent: options.silent }),
    [load],
  );

  const invalidateAndRefresh = useCallback(async () => {
    invalidateDashboardCache();
    return load({ forceFresh: true });
  }, [load]);

  const getRawBundle = useCallback(
    (options = {}) => fetchProjectBundleRaw(pid, options),
    [pid],
  );

  const value = useMemo(
    () => ({
      projectId: pid,
      sprints,
      taskCount,
      loading,
      error,
      refresh,
      invalidateAndRefresh,
      getRawBundle,
      getCachedSnapshot: () => getCachedBundleSnapshot(pid),
    }),
    [pid, sprints, taskCount, loading, error, refresh, invalidateAndRefresh, getRawBundle],
  );

  return (
    <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>
  );
}

export function useProjectData() {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) {
    return {
      projectId: null,
      sprints: [],
      taskCount: 0,
      loading: false,
      error: null,
      refresh: async () => {},
      invalidateAndRefresh: async () => {},
      getRawBundle: async () => ({ sprints: [], tasks: [], userTasks: [] }),
      getCachedSnapshot: () => null,
    };
  }
  return ctx;
}
