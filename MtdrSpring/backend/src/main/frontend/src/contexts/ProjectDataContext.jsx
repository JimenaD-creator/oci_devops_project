import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchDashboardSprints,
  fetchProjectBundleRaw,
  getCachedBundleSnapshot,
  invalidateDashboardCache,
  applyOptimisticTaskDeleted,
  applyOptimisticTaskCreated,
} from '../features/dashboard/dashboardSprintData';
import { subscribeProjectTaskEvents } from '../utils/projectEventStream';
import { markTasksSyncCaughtUp, TASKS_MUTATED_EVENT } from '../utils/taskSyncEvents';

const SSE_CONNECT_DELAY_MS = 2500;
/** Minimum gap between SSE-driven force refreshes (avoids reload storms). */
const SSE_REFRESH_COOLDOWN_MS = 4000;

const ProjectDataContext = createContext(null);

/**
 * Shared enriched sprints + raw tasks/user-tasks for the active project.
 * Uses cache-first on entry; force-refresh only after mutations or stale data.
 */
export function ProjectDataProvider({ projectId, children, preload = true }) {
  const pid =
    projectId != null && String(projectId).trim() !== '' ? String(projectId).trim() : null;
  const initialSnap = pid ? getCachedBundleSnapshot(pid) : null;

  const [sprints, setSprints] = useState(() =>
    Array.isArray(initialSnap?.enrichedSprints) ? initialSnap.enrichedSprints : [],
  );
  const [taskCount, setTaskCount] = useState(() =>
    Array.isArray(initialSnap?.tasks) ? initialSnap.tasks.length : (initialSnap?.taskCount ?? 0),
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState(() => initialSnap?.timestamp ?? 0);
  const [error, setError] = useState(null);
  const [loadEnabled, setLoadEnabled] = useState(Boolean(preload));
  const refreshPromiseRef = useRef(null);
  const lastSseRefreshAtRef = useRef(0);
  const invalidateAndRefreshRef = useRef(null);

  const applySnapshot = useCallback((snap) => {
    if (!snap) return false;
    if (Array.isArray(snap.enrichedSprints)) {
      setSprints(snap.enrichedSprints);
    }
    setTaskCount(Array.isArray(snap.tasks) ? snap.tasks.length : 0);
    if (snap.timestamp) {
      setDataUpdatedAt(snap.timestamp);
    }
    return true;
  }, []);

  const load = useCallback(
    async (options = {}) => {
      if (!pid) {
        setSprints([]);
        setTaskCount(0);
        setError(null);
        setDataUpdatedAt(0);
        return;
      }

      const forceFresh = Boolean(options.forceFresh);
      const snap = !forceFresh ? getCachedBundleSnapshot(pid) : null;
      const hadCache = applySnapshot(snap);

      if (forceFresh && !options.confirmOnly) {
        setRefreshing(true);
      }
      if (!options.silent && !hadCache) {
        setLoading(true);
      }
      setError(null);
      let succeeded = false;
      try {
        const data = await fetchDashboardSprints(pid, { forceFresh });
        setSprints(Array.isArray(data) ? data : []);
        const freshSnap = getCachedBundleSnapshot(pid);
        const updatedAt = freshSnap?.timestamp ?? Date.now();
        if (freshSnap) {
          setTaskCount(freshSnap.taskCount ?? 0);
        }
        setDataUpdatedAt(updatedAt);
        succeeded = true;
      } catch (e) {
        setError(e);
        if (!hadCache) {
          setSprints([]);
          setTaskCount(0);
        }
      } finally {
        if (forceFresh && !options.confirmOnly) {
          setRefreshing(false);
          if (succeeded) {
            markTasksSyncCaughtUp(Date.now());
          }
        } else if (forceFresh && options.confirmOnly && succeeded) {
          markTasksSyncCaughtUp(Date.now());
        }
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [pid, applySnapshot],
  );

  useEffect(() => {
    setLoadEnabled(Boolean(preload));
  }, [preload, pid]);

  useEffect(() => {
    if (!loadEnabled || !pid) return;
    const snap = getCachedBundleSnapshot(pid);
    if (snap) {
      applySnapshot(snap);
      const looksEmpty =
        (!Array.isArray(snap.enrichedSprints) || snap.enrichedSprints.length === 0) &&
        (snap.taskCount ?? 0) === 0;
      if (looksEmpty) {
        load({ silent: false, forceFresh: true }).catch(() => {});
      }
      return;
    }
    load({ silent: false, forceFresh: false });
  }, [loadEnabled, pid, load, applySnapshot]);

  const ensureLoaded = useCallback(
    (options = {}) => {
      setLoadEnabled(true);
      if (!pid) return Promise.resolve();
      const snap = getCachedBundleSnapshot(pid);
      if (snap && !options.forceFresh) {
        applySnapshot(snap);
        const hasData =
          (Array.isArray(snap.enrichedSprints) && snap.enrichedSprints.length > 0) ||
          (snap.taskCount ?? 0) > 0;
        if (hasData) {
          return Promise.resolve();
        }
        return load({ silent: true, forceFresh: false });
      }
      return load({ silent: Boolean(options.silent), forceFresh: Boolean(options.forceFresh) });
    },
    [pid, load, applySnapshot],
  );

  const refresh = useCallback(
    (options = {}) => {
      setLoadEnabled(true);
      return load({ forceFresh: Boolean(options.forceFresh), silent: options.silent });
    },
    [load],
  );

  const invalidateAndRefresh = useCallback(
    async (options = {}) => {
      setLoadEnabled(true);
      invalidateDashboardCache();
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }
      const promise = load({
        forceFresh: true,
        silent: Boolean(options.silent),
        confirmOnly: Boolean(options.confirmOnly),
      }).finally(() => {
        refreshPromiseRef.current = null;
      });
      refreshPromiseRef.current = promise;
      return promise;
    },
    [load],
  );

  invalidateAndRefreshRef.current = invalidateAndRefresh;

  useEffect(() => {
    if (!pid) return undefined;
    let unsubscribe = () => {};
    const connectLater = window.setTimeout(() => {
      unsubscribe = subscribeProjectTaskEvents(pid, (payload) => {
        const now = Date.now();
        if (now - lastSseRefreshAtRef.current < SSE_REFRESH_COOLDOWN_MS) {
          return;
        }
        if (refreshPromiseRef.current) {
          return;
        }
        lastSseRefreshAtRef.current = now;
        let appliedOptimistic = false;
        if (payload?.type === 'task-deleted' && payload?.taskId != null) {
          const snap = applyOptimisticTaskDeleted(pid, payload.taskId);
          if (snap) {
            applySnapshot(snap);
            appliedOptimistic = true;
          }
        }
        invalidateAndRefreshRef
          .current?.({
            silent: true,
            confirmOnly: appliedOptimistic,
          })
          .catch(() => {});
      });
    }, SSE_CONNECT_DELAY_MS);

    return () => {
      window.clearTimeout(connectLater);
      unsubscribe();
    };
  }, [pid, applySnapshot]);

  useEffect(() => {
    const onTasksMutated = (event) => {
      const detail = event?.detail;
      if (!detail || detail.source === 'sse') return;

      let appliedOptimistic = false;
      if (detail.type === 'task-deleted' && detail.taskId != null) {
        const snap = applyOptimisticTaskDeleted(pid, detail.taskId);
        if (snap) {
          applySnapshot(snap);
          appliedOptimistic = true;
        } else {
          setTaskCount((count) => Math.max(0, count - 1));
        }
      } else if (detail.type === 'task-created' && detail.task?.id != null) {
        const snap = applyOptimisticTaskCreated(pid, detail.task, detail.userTasks);
        if (snap) {
          applySnapshot(snap);
          appliedOptimistic = true;
        } else {
          setTaskCount((count) => count + 1);
        }
      }

      invalidateDashboardCache();
      setLoadEnabled(true);
      invalidateAndRefresh({
        silent: true,
        confirmOnly: appliedOptimistic,
      }).catch(() => {});
    };

    window.addEventListener(TASKS_MUTATED_EVENT, onTasksMutated);
    return () => window.removeEventListener(TASKS_MUTATED_EVENT, onTasksMutated);
  }, [invalidateAndRefresh, pid, applySnapshot]);

  const getRawBundle = useCallback((options = {}) => fetchProjectBundleRaw(pid, options), [pid]);

  const value = useMemo(
    () => ({
      projectId: pid,
      sprints,
      taskCount,
      loading,
      refreshing,
      dataUpdatedAt,
      error,
      refresh,
      ensureLoaded,
      invalidateAndRefresh,
      getRawBundle,
      getCachedSnapshot: () => getCachedBundleSnapshot(pid),
    }),
    [
      pid,
      sprints,
      taskCount,
      loading,
      refreshing,
      dataUpdatedAt,
      error,
      refresh,
      ensureLoaded,
      invalidateAndRefresh,
      getRawBundle,
    ],
  );

  return <ProjectDataContext.Provider value={value}>{children}</ProjectDataContext.Provider>;
}

export function useProjectData() {
  const ctx = useContext(ProjectDataContext);
  if (!ctx) {
    return {
      projectId: null,
      sprints: [],
      taskCount: 0,
      loading: false,
      refreshing: false,
      dataUpdatedAt: 0,
      error: null,
      refresh: async () => {},
      ensureLoaded: async () => {},
      invalidateAndRefresh: async () => {},
      getRawBundle: async () => ({ sprints: [], tasks: [], userTasks: [] }),
      getCachedSnapshot: () => null,
    };
  }
  return ctx;
}
