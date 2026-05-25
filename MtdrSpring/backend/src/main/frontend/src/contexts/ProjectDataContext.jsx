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
  invalidateDashboardCache,
} from '../features/dashboard/dashboardSprintData';

const ProjectDataContext = createContext(null);

/**
 * Preloads and shares enriched sprints + raw tasks/user-tasks for the active project.
 * Reduces repeated triple-fetch when navigating between pages.
 */
export function ProjectDataProvider({ projectId, children }) {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;

  const load = useCallback(
    async (options = {}) => {
      if (!pid) {
        setSprints([]);
        setError(null);
        return;
      }
      const forceFresh = Boolean(options.forceFresh);
      if (!options.silent) setLoading(true);
      setError(null);
      try {
        const data = await fetchDashboardSprints(pid, { forceFresh });
        setSprints(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e);
        setSprints([]);
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [pid],
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
      loading,
      error,
      refresh,
      invalidateAndRefresh,
      getRawBundle,
    }),
    [pid, sprints, loading, error, refresh, invalidateAndRefresh, getRawBundle],
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
      loading: false,
      error: null,
      refresh: async () => {},
      invalidateAndRefresh: async () => {},
      getRawBundle: async () => ({ sprints: [], tasks: [], userTasks: [] }),
    };
  }
  return ctx;
}
