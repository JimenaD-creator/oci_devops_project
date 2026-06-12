import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import KanbanBoard from './KanbanBoard';
import LogWorkedHoursDialog from './LogWorkedHoursDialog';
import { TaskDetailDialog } from './TaskDetailDialog';
import { matchesDueDateRange } from './taskFilters';
import { developerNumericId, finiteUserIds } from '../../utils/userIds';
import { NewTaskDialog } from './NewTaskDialog';
import { API_BASE, ORACLE_RED, pageEase } from './constants/taskConstants';
import { pickDefaultSelectedSprint, buildSprintNumberMap } from '../sprints/utils/sprintUtils';
import {
  resolveActiveProjectId,
  sprintProjectIdFromJson,
  mapTaskToKanban,
  mergeUpdatedTask,
  patchUserTasksAfterTaskSave,
  isUserTaskAssigneeComplete,
  normalizeTaskStatus,
  pageFormFieldOutline,
  shouldPromptWorkedHoursForAssigneeDone,
  shouldPromptWorkedHoursOnKanbanDone,
  taskEntityId,
  userTaskRowTaskId,
  deriveDeveloperKanbanStatus,
} from './utils/taskUtils';
import { applyOptimisticTaskUpdated, isFullPageReload } from '../dashboard/dashboardSprintData';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { apiFetch, resolveLoadErrorMessage } from '../../utils/auth';
import {
  completeAssigneeWithHours,
  fetchProjectDevelopersList,
  fetchTasksPageBundle,
} from './tasksPageApi';
import { getCachedProjectDevelopersSnapshot } from '../dashboard/projectApi';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { useProjectBundleSync } from '../../hooks/useProjectBundleSync';
import { filterUserTasksForUser, taskIdsForUser } from '../developer/developerTaskFilters';
import DeveloperEmptyState from '../developer/DeveloperEmptyState';
import {
  applyRecentUpdatesToTaskLists,
  getRecentlyCreatedTasks,
  getRecentlyCreatedUserTasks,
  mergeUserTaskLists,
  TASKS_MUTATED_EVENT,
  getRecentlyDeletedTaskIdSet,
  notifyTasksMutated,
} from '../../utils/taskSyncEvents';

export default function TasksPage({ projectId, developerMode = false, currentUser = null }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery('(max-width:600px)');

  const effectiveProjectId = resolveActiveProjectId(projectId);
  const currentUserId = developerMode ? Number(currentUser?.id) : null;
  const [rawTasks, setRawTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users] = useState([]);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [multiDoneTaskId, setMultiDoneTaskId] = useState(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskForDetailDialog, setTaskForDetailDialog] = useState(null);
  const recentlyDeletedTaskIdsRef = useRef(new Set());
  const projectDevelopersRef = useRef(projectDevelopers);
  projectDevelopersRef.current = projectDevelopers;
  const { invalidateAndRefresh } = useProjectData();
  const [pendingDone, setPendingDone] = useState(null);

  const getSprintNumber = useCallback((sprintId, sprintsList) => {
    const map = buildSprintNumberMap(sprintsList);
    const n = map.get(Number(sprintId));
    return n !== undefined ? n : sprintId;
  }, []);

  const getSprintLabel = useCallback(
    (sprintId, sprintsList) => {
      if (sprintId == null) return '';
      const sprintNum = getSprintNumber(sprintId, sprintsList);
      return `Sprint ${sprintNum}`;
    },
    [getSprintNumber],
  );

  const loadData = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      const forceRefresh = opts.forceRefresh === true;
      if (!silent) {
        setIsLoading(true);
        setLoadError('');
      }
      try {
        if (forceRefresh) {
          await invalidateAndRefresh();
        }
        const { tasksData, sprintsData, userTasksData } = await fetchTasksPageBundle(
          effectiveProjectId,
          {
            forceFresh: forceRefresh,
          },
        );
        const deleted = new Set([
          ...recentlyDeletedTaskIdsRef.current,
          ...getRecentlyDeletedTaskIdSet(),
        ]);
        const createdTasks = getRecentlyCreatedTasks();
        const baseTasks = Array.isArray(tasksData) ? tasksData : [];
        const mergedTasks = [...createdTasks, ...baseTasks].filter(
          (task, index, arr) => arr.findIndex((t) => Number(t?.id) === Number(task?.id)) === index,
        );
        const visibleTasks = mergedTasks.filter((t) => !deleted.has(taskEntityId(t)));
        const visibleUserTasks = mergeUserTaskLists(
          getRecentlyCreatedUserTasks(),
          Array.isArray(userTasksData) ? userTasksData : [],
        ).filter((ut) => !deleted.has(String(userTaskRowTaskId(ut))));
        const synced = applyRecentUpdatesToTaskLists(
          visibleTasks,
          visibleUserTasks,
          projectDevelopersRef.current,
        );
        setRawTasks(synced.tasks);
        setSprints(Array.isArray(sprintsData) ? sprintsData : []);
        setUserTasks(synced.userTasks);
      } catch (error) {
        console.error('Error loading tasks data:', error);
        setRawTasks([]);
        setSprints([]);
        setUserTasks([]);
        if (!silent) {
          setLoadError(
            resolveLoadErrorMessage(
              error,
              'Could not load tasks. Check that the server is running and try again.',
            ),
          );
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [effectiveProjectId, invalidateAndRefresh],
  );

  useEffect(() => {
    loadData({ forceRefresh: isFullPageReload() });
  }, [loadData]);

  useProjectBundleSync(
    useCallback(() => {
      loadData({ silent: true, forceRefresh: true }).catch((e) => {
        console.error('TasksPage bundle sync failed:', e);
      });
    }, [loadData]),
  );

  useEffect(() => {
    if (!taskDetailOpen || !taskForDetailDialog?.id) return;
    const fresh = rawTasks.find((t) => Number(t.id) === Number(taskForDetailDialog.id));
    if (fresh) setTaskForDetailDialog(fresh);
  }, [rawTasks, taskForDetailDialog?.id, taskDetailOpen]);

  useEffect(() => {
    const onTasksMutated = (event) => {
      if (event?.detail?.source === 'tasks-page') return;
      if (event?.detail?.source === 'sse') {
        loadData({ silent: true, forceRefresh: true }).catch((e) => {
          console.error('TasksPage SSE sync failed:', e);
        });
        return;
      }
      if (event?.detail?.type === 'task-created' && event?.detail?.task) {
        const created = event.detail.task;
        setRawTasks((prev) => {
          const exists = prev.some((t) => Number(t.id) === Number(created?.id));
          return exists ? prev : [created, ...prev];
        });
        const rows = Array.isArray(event.detail.userTasks) ? event.detail.userTasks : [];
        if (rows.length > 0) {
          setUserTasks((prev) => mergeUserTaskLists(rows, prev));
        }
      }
      if (event?.detail?.type === 'task-updated' && event?.detail?.task) {
        const updated = event.detail.task;
        const meta = event.detail.meta;
        setRawTasks((prev) => mergeUpdatedTask(prev, updated));
        setUserTasks((prev) =>
          patchUserTasksAfterTaskSave(prev, updated, meta, projectDevelopersRef.current),
        );
        setTaskForDetailDialog((prev) =>
          prev && Number(prev.id) === Number(updated.id) ? { ...prev, ...updated } : prev,
        );
      }
      if (event?.detail?.type === 'task-deleted' && event?.detail?.taskId != null) {
        const tid = String(event.detail.taskId);
        recentlyDeletedTaskIdsRef.current.add(tid);
        setRawTasks((prev) => prev.filter((t) => taskEntityId(t) !== tid));
        setUserTasks((prev) =>
          prev.filter((ut) => {
            const utTid = userTaskRowTaskId(ut);
            return !Number.isFinite(utTid) || String(utTid) !== tid;
          }),
        );
      }
      loadData({ silent: true }).catch((e) => {
        console.error('TasksPage sync refresh failed:', e);
      });
    };
    window.addEventListener(TASKS_MUTATED_EVENT, onTasksMutated);
    return () => window.removeEventListener(TASKS_MUTATED_EVENT, onTasksMutated);
  }, [loadData]);

  useEffect(() => {
    try {
      if (localStorage.getItem('openCreateTaskDialog') === '1') {
        setDialogOpen(true);
        localStorage.removeItem('openCreateTaskDialog');
      }
    } catch (e) {}
  }, []);

  const kanbanSprintId = useMemo(() => {
    const pid =
      effectiveProjectId != null && Number(effectiveProjectId) > 0
        ? Number(effectiveProjectId)
        : Number(projectId) > 0
          ? Number(projectId)
          : null;
    const pool =
      pid != null
        ? (sprints || []).filter((s) => sprintProjectIdFromJson(s) === pid)
        : sprints || [];
    if (!pool.length) return '';
    const ids = pool.map((s) => String(s.id));
    if (
      selectedSprintId !== '' &&
      selectedSprintId != null &&
      ids.includes(String(selectedSprintId))
    ) {
      return String(selectedSprintId);
    }
    const picked = pickDefaultSelectedSprint(pool);
    return picked?.id != null ? String(picked.id) : '';
  }, [selectedSprintId, sprints, effectiveProjectId, projectId]);

  const selectedProjectId = useMemo(() => {
    if (effectiveProjectId != null) return effectiveProjectId;
    const fromProp = Number(projectId);
    if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
    if (!kanbanSprintId) return null;
    const sprint = (sprints || []).find((s) => String(s.id) === String(kanbanSprintId));
    return sprint ? sprintProjectIdFromJson(sprint) : null;
  }, [effectiveProjectId, projectId, kanbanSprintId, sprints]);

  useEffect(() => {
    if (selectedProjectId != null) {
      try {
        localStorage.setItem('currentProjectId', String(selectedProjectId));
      } catch (e) {}
    }
  }, [selectedProjectId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setProjectDevelopers([]);
      return () => {
        cancelled = true;
      };
    }
    const devSnap = getCachedProjectDevelopersSnapshot(selectedProjectId);
    if (devSnap) {
      setProjectDevelopers(devSnap.developers);
    }
    (async () => {
      try {
        const data = await fetchProjectDevelopersList(selectedProjectId);
        if (!cancelled) setProjectDevelopers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProjectDevelopers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const developerFilterOptions = useMemo(
    () => (Array.isArray(projectDevelopers) ? projectDevelopers : []),
    [projectDevelopers],
  );

  const sprintsForActiveProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return (sprints || []).filter((s) => sprintProjectIdFromJson(s) === Number(selectedProjectId));
  }, [sprints, selectedProjectId]);

  // Ordenar sprints para el select
  const sortedSprintsForSelect = useMemo(() => {
    return [...sprintsForActiveProject].sort((a, b) => a.id - b.id);
  }, [sprintsForActiveProject]);

  useEffect(() => {
    if (selectedSprintId !== '' || !sprints.length) return;
    const pool = sprintsForActiveProject.length ? sprintsForActiveProject : sprints;
    const picked = pickDefaultSelectedSprint(pool);
    if (picked?.id != null) setSelectedSprintId(String(picked.id));
  }, [sprints, sprintsForActiveProject, selectedSprintId]);

  useEffect(() => {
    if (developerFilter === 'all') return;
    const stillExists = developerFilterOptions.some((u) => u?.name === developerFilter);
    if (!stillExists) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);

  const handleStatusChange = async (taskId, newStatus) => {
    const tid = Number(taskId);
    const task = rawTasks.find((t) => Number(t.id) === tid);
    if (!task) return;

    const assignees = userTasks.filter((ut) => userTaskRowTaskId(ut) === tid);
    const ns = normalizeTaskStatus(newStatus);
    const previousTaskStatus = task.status;
    const assigneeSnapshot = assignees.map((ut) => ({ ...ut }));

    const userTaskStatusFor = (status) => {
      const canonical = normalizeTaskStatus(status);
      return canonical === 'DONE' ? 'COMPLETED' : canonical;
    };

    const applyOptimistic = (status) => {
      const canonical = normalizeTaskStatus(status);
      setRawTasks((prev) =>
        prev.map((t) => (Number(t.id) === tid ? { ...t, status: canonical } : t)),
      );
      if (assignees.length > 0) {
        const utStatus = userTaskStatusFor(status);
        const leavingDone = canonical !== 'DONE';
        setUserTasks((prev) =>
          prev.map((row) => {
            if (userTaskRowTaskId(row) !== tid) return row;
            const next = { ...row, status: utStatus };
            if (leavingDone && isUserTaskAssigneeComplete(row)) {
              next.workedHours = 0;
              next.worked_hours = 0;
              next.hours = 0;
            }
            return next;
          }),
        );
      }
    };

    const rollbackOptimistic = () => {
      setRawTasks((prev) =>
        prev.map((t) => (Number(t.id) === tid ? { ...t, status: previousTaskStatus } : t)),
      );
      if (assigneeSnapshot.length > 0) {
        setUserTasks((prev) => {
          const rest = prev.filter((ut) => userTaskRowTaskId(ut) !== tid);
          return [...rest, ...assigneeSnapshot];
        });
      }
    };

    const commitServerUpdate = async (updated, meta) => {
      if (updated?.id != null) {
        setRawTasks((prev) => mergeUpdatedTask(prev, updated));
        if (meta?.syncAssignmentStatuses && meta.assignmentStatus != null) {
          setUserTasks((prev) =>
            patchUserTasksAfterTaskSave(prev, updated, meta, projectDevelopersRef.current),
          );
        }
      }
      if (!updated?.id) return;
      applyOptimisticTaskUpdated(String(effectiveProjectId), updated, meta);
      notifyTasksMutated({
        source: 'tasks-page',
        type: 'task-updated',
        taskId: updated.id,
        task: updated,
        meta,
      });
      await loadData({ silent: true, forceRefresh: true });
    };

    const putTask = async () => {
      const res = await apiFetch(`${API_BASE}/api/tasks/${tid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      if (!res.ok) return null;
      return res.json();
    };

    try {
      if (
        assignees.length > 1 &&
        ns === 'DONE' &&
        !assignees.every((ut) => isUserTaskAssigneeComplete(ut))
      ) {
        setMultiDoneTaskId(tid);
        return;
      }

      if (
        shouldPromptWorkedHoursOnKanbanDone({
          developerMode,
          currentUserId,
          normalizedStatus: ns,
          assignees,
        })
      ) {
        const myAssignment = assignees.find(
          (ut) => Number(ut.user?.id ?? ut.user?.ID) === currentUserId,
        );
        setPendingDone({
          taskId: tid,
          newStatus: ns,
          userId: currentUserId,
          mode: 'full',
          initialHours:
            myAssignment.workedHours ?? myAssignment.worked_hours ?? myAssignment.hours ?? '',
        });
        return;
      }

      applyOptimistic(newStatus);

      if (assignees.length === 0) {
        const updated = await putTask();
        if (!updated) {
          rollbackOptimistic();
          return;
        }
        await commitServerUpdate(updated, undefined);
        return;
      }

      if (assignees.length === 1 && ns === 'DONE') {
        const ut = assignees[0];
        const uid = Number(ut.user?.id ?? ut.user?.ID);
        const markDoneRes = await apiFetch(`${API_BASE}/api/user-tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, taskId: tid, status: 'COMPLETED' }),
        });
        if (!markDoneRes.ok) {
          rollbackOptimistic();
          return;
        }
        const updated = await putTask();
        if (!updated) {
          rollbackOptimistic();
          return;
        }
        await commitServerUpdate(updated, {
          syncAssignmentStatuses: true,
          assignmentStatus: 'COMPLETED',
        });
        return;
      }

      const updated = await putTask();
      if (!updated) {
        rollbackOptimistic();
        return;
      }
      await commitServerUpdate(updated, {
        syncAssignmentStatuses: true,
        assignmentStatus: ns,
      });
    } catch (e) {
      console.error('Error updating task status:', e);
      rollbackOptimistic();
    }
  };

  const handleOpenTaskFromKanban = useCallback((kanbanItem) => {
    const raw = kanbanItem?._raw;
    if (raw && raw.id != null) {
      setTaskForDetailDialog(raw);
      setTaskDetailOpen(true);
    }
  }, []);

  const closeTaskDetailDialog = useCallback(() => {
    setTaskDetailOpen(false);
    setTaskForDetailDialog(null);
  }, []);

  const removeTaskFromState = useCallback(
    (taskId) => {
      const tid = String(taskId);
      recentlyDeletedTaskIdsRef.current.add(tid);
      setTimeout(() => recentlyDeletedTaskIdsRef.current.delete(tid), 15000);
      setRawTasks((prev) => prev.filter((t) => taskEntityId(t) !== tid));
      setUserTasks((prev) =>
        prev.filter((ut) => {
          const utTid = userTaskRowTaskId(ut);
          return !Number.isFinite(utTid) || String(utTid) !== tid;
        }),
      );
      const tidNum = Number(taskId);
      if (Number(multiDoneTaskId) === tidNum) setMultiDoneTaskId(null);
      if (taskForDetailDialog && taskEntityId(taskForDetailDialog) === tid) {
        closeTaskDetailDialog();
      }
    },
    [multiDoneTaskId, taskForDetailDialog, closeTaskDetailDialog],
  );

  const refreshSharedAfterTaskMutation = useCallback(async () => {
    try {
      await invalidateAndRefresh({ silent: true, confirmOnly: true });
      await loadData({ silent: true, forceRefresh: true });
    } catch (e) {
      console.error('Failed to refresh shared project data after task change:', e);
    }
  }, [invalidateAndRefresh, loadData]);

  const handleTaskCreated = useCallback(
    async (createdTask, assignedUserIds = [], assignmentStatus = 'TODO') => {
      setRawTasks((prev) => {
        const exists = prev.some((t) => Number(t.id) === Number(createdTask?.id));
        return exists ? prev : [createdTask, ...prev];
      });
      let optimisticRows = [];
      if (createdTask?.id) {
        const byId = new Map(
          (projectDevelopers || []).map((u) => [Number(developerNumericId(u)), u]),
        );
        optimisticRows = finiteUserIds(assignedUserIds).map((uid) => {
          const matched = byId.get(Number(uid));
          return {
            task: { id: Number(createdTask.id) },
            user: {
              id: Number(uid),
              name: matched?.name ?? matched?.NAME ?? `User ${uid}`,
            },
            status: assignmentStatus,
          };
        });
        if (optimisticRows.length > 0) {
          setUserTasks((prev) => mergeUserTaskLists(optimisticRows, prev));
        }
      }
      notifyTasksMutated({
        source: 'tasks-page',
        type: 'task-created',
        taskId: createdTask?.id,
        task: createdTask,
        userTasks: optimisticRows,
      });
      await refreshSharedAfterTaskMutation();
    },
    [projectDevelopers, refreshSharedAfterTaskMutation],
  );

  useEffect(() => {
    if (multiDoneTaskId == null) return;
    const uts = userTasks.filter(
      (ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId),
    );
    if (uts.length > 0 && uts.every((ut) => isUserTaskAssigneeComplete(ut)))
      setMultiDoneTaskId(null);
  }, [userTasks, multiDoneTaskId]);

  const patchUserTaskAfterCompletion = useCallback((taskId, uid, workedHours) => {
    const hours = workedHours == null ? undefined : Number(workedHours);
    setUserTasks((prev) =>
      prev.map((row) => {
        const rowTaskId = Number(row?.task?.id ?? row?.id?.taskId);
        const rowUserId = Number(row?.user?.id ?? row?.user?.ID ?? row?.id?.userId);
        if (rowTaskId !== Number(taskId) || rowUserId !== uid) return row;
        const next = { ...row, status: 'COMPLETED' };
        if (hours != null && Number.isFinite(hours)) {
          next.workedHours = hours;
          next.worked_hours = hours;
          next.hours = hours;
        }
        return next;
      }),
    );
  }, []);

  const finishAssigneeCompletion = useCallback(
    async (taskId, uid, workedHours) => {
      if (workedHours != null && Number.isFinite(Number(workedHours))) {
        await completeAssigneeWithHours(taskId, uid, Number(workedHours));
      } else {
        const res = await apiFetch(`${API_BASE}/api/user-tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, taskId: Number(taskId), status: 'COMPLETED' }),
        });
        if (!res.ok) throw new Error('Failed to mark assignment complete');
      }
      patchUserTaskAfterCompletion(taskId, uid, workedHours);
      const taskRow = rawTasks.find((t) => Number(t.id) === Number(taskId));
      const completionMeta = {
        syncAssignmentStatuses: true,
        assignmentStatus: 'COMPLETED',
        userId: uid,
        ...(workedHours != null && Number.isFinite(Number(workedHours))
          ? { workedHours: Number(workedHours) }
          : {}),
      };
      const updatedTask = taskRow ? { ...taskRow, status: 'DONE' } : { id: taskId, status: 'DONE' };
      applyOptimisticTaskUpdated(String(effectiveProjectId), updatedTask, completionMeta);
      notifyTasksMutated({
        source: 'tasks-page',
        type: 'task-updated',
        taskId,
        task: taskRow ?? { id: taskId, status: 'DONE' },
        meta: completionMeta,
      });
      await loadData({ silent: true, forceRefresh: true });
    },
    [rawTasks, loadData, patchUserTaskAfterCompletion, effectiveProjectId],
  );

  const handleConfirmWorkedHours = useCallback(
    async (workedHours) => {
      const snapshot = pendingDone;
      if (!snapshot) return;
      const { taskId, userId, newStatus = 'DONE', mode } = snapshot;
      const tid = Number(taskId);
      const uid = Number(userId);
      const task = rawTasks.find((t) => Number(t.id) === tid);
      if (!task) return;

      // Close dialog immediately so the Kanban update feels instant.
      setPendingDone(null);
      setLoadError('');

      const previousTaskStatus = task.status;
      const assignees = userTasks.filter((ut) => userTaskRowTaskId(ut) === tid);
      const assigneeSnapshot = assignees.map((ut) => ({ ...ut }));

      const rollbackTaskStatus = () => {
        setRawTasks((prev) =>
          prev.map((t) => (Number(t.id) === tid ? { ...t, status: previousTaskStatus } : t)),
        );
      };

      const rollbackAssignees = () => {
        if (assigneeSnapshot.length === 0) return;
        setUserTasks((prev) => {
          const rest = prev.filter((ut) => userTaskRowTaskId(ut) !== tid);
          return [...rest, ...assigneeSnapshot];
        });
      };

      if (mode === 'full') {
        setRawTasks((prev) =>
          prev.map((t) => (Number(t.id) === tid ? { ...t, status: 'DONE' } : t)),
        );
        setUserTasks((prev) =>
          prev.map((row) => {
            if (userTaskRowTaskId(row) !== tid) return row;
            if (Number(row?.user?.id ?? row?.user?.ID ?? row?.id?.userId) !== uid) return row;
            return {
              ...row,
              status: 'COMPLETED',
              workedHours,
              worked_hours: workedHours,
              hours: workedHours,
            };
          }),
        );
      }

      try {
        await finishAssigneeCompletion(tid, uid, workedHours);

        if (mode === 'assigneeOnly') {
          return;
        }

        const res = await apiFetch(`${API_BASE}/api/tasks/${tid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...task, status: newStatus }),
        });
        if (!res.ok) {
          rollbackTaskStatus();
          rollbackAssignees();
          setLoadError(
            'Could not mark the task as Done. Your hours may have been saved — refresh and try again.',
          );
          return;
        }
        const updated = await res.json();
        if (updated?.id != null) {
          const completionMeta = {
            syncAssignmentStatuses: true,
            assignmentStatus: 'COMPLETED',
            userId: uid,
            ...(workedHours != null && Number.isFinite(Number(workedHours))
              ? { workedHours: Number(workedHours) }
              : {}),
          };
          setRawTasks((prev) => mergeUpdatedTask(prev, updated));
          setUserTasks((prev) =>
            patchUserTasksAfterTaskSave(
              prev,
              updated,
              completionMeta,
              projectDevelopersRef.current,
            ),
          );
          applyOptimisticTaskUpdated(String(effectiveProjectId), updated, completionMeta);
          notifyTasksMutated({
            source: 'tasks-page',
            type: 'task-updated',
            taskId: updated.id,
            task: updated,
            meta: completionMeta,
          });
          await loadData({ silent: true, forceRefresh: true });
        }
      } catch (e) {
        console.error('Error saving worked hours:', e);
        if (mode === 'full') {
          rollbackTaskStatus();
          rollbackAssignees();
        }
        setLoadError('Could not save worked hours. Please try again.');
      }
    },
    [pendingDone, rawTasks, userTasks, finishAssigneeCompletion, effectiveProjectId],
  );

  const markAssigneeDone = async (taskId, ut) => {
    const uid = Number(ut.user?.id ?? ut.user?.ID);
    if (
      shouldPromptWorkedHoursForAssigneeDone({
        developerMode,
        currentUserId,
        assigneeUserId: uid,
      })
    ) {
      const task = rawTasks.find((t) => Number(t.id) === Number(taskId));
      setPendingDone({
        taskId: Number(taskId),
        userId: uid,
        mode: 'assigneeOnly',
        initialHours: ut.workedHours ?? ut.worked_hours ?? ut.hours ?? '',
        taskTitle: task?.title ?? '',
      });
      return;
    }
    try {
      await finishAssigneeCompletion(Number(taskId), uid, null);
    } catch (e) {
      console.error('Error marking assignee done:', e);
    }
  };

  const resolveUserTaskDeveloperName = useCallback(
    (ut) => {
      if (!ut) return null;
      const user = ut.user;
      const numericUserId =
        developerNumericId(ut?.id?.userId) ??
        developerNumericId(ut?.userId) ??
        developerNumericId(ut?.user?.ID) ??
        developerNumericId(user);
      if (numericUserId != null && Number.isFinite(numericUserId)) {
        const known =
          users.find((u) => developerNumericId(u) === numericUserId) ||
          projectDevelopers.find((u) => developerNumericId(u) === numericUserId);
        if (known)
          return String(known.name ?? known.displayName ?? known.email ?? `User ${numericUserId}`);
        return `User ${numericUserId}`;
      }
      const directName = String(
        user?.name ??
          user?.NAME ??
          user?.fullName ??
          user?.displayName ??
          user?.email ??
          user?.username ??
          user?.userName ??
          '',
      ).trim();
      return directName || null;
    },
    [users, projectDevelopers],
  );

  const scopedUserTasks = useMemo(() => {
    if (!developerMode || !Number.isFinite(currentUserId)) return userTasks;
    return filterUserTasksForUser(userTasks, currentUserId);
  }, [userTasks, developerMode, currentUserId]);

  const myTaskIds = useMemo(() => {
    if (!developerMode || !Number.isFinite(currentUserId)) return null;
    return taskIdsForUser(userTasks, currentUserId);
  }, [userTasks, developerMode, currentUserId]);

  const tasksForKanban = useMemo(() => {
    if (!developerMode || !myTaskIds) return rawTasks;
    return rawTasks.filter((t) => myTaskIds.has(Number(t.id)));
  }, [rawTasks, developerMode, myTaskIds]);

  const developersByTaskId = useMemo(() => {
    const map = new Map();
    scopedUserTasks.forEach((ut) => {
      const rawTaskId = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
      const taskId = rawTaskId != null ? String(rawTaskId) : null;
      const devName = resolveUserTaskDeveloperName(ut);
      if (!taskId || !devName) return;
      const existing = map.get(taskId);
      if (!existing) map.set(taskId, [devName]);
      else if (!existing.includes(devName)) existing.push(devName);
    });
    return map;
  }, [scopedUserTasks, resolveUserTaskDeveloperName]);

  const assignmentsByTaskId = useMemo(() => {
    const map = new Map();
    scopedUserTasks.forEach((ut) => {
      const tid = userTaskRowTaskId(ut);
      if (!Number.isFinite(tid)) return;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid).push(ut);
    });
    return map;
  }, [scopedUserTasks]);

  const items = useMemo(
    () =>
      tasksForKanban.map((task) => {
        const tid = Number(task.id);
        const assignmentRows = assignmentsByTaskId.get(tid) ?? [];
        const statusOverride = developerMode
          ? deriveDeveloperKanbanStatus(task.status, assignmentRows)
          : undefined;
        return mapTaskToKanban(
          task,
          developersByTaskId.get(String(task.id)) ?? [],
          assignmentRows,
          { statusOverride },
        );
      }),
    [tasksForKanban, developersByTaskId, assignmentsByTaskId, developerMode],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!kanbanSprintId || String(item.sprintId) !== String(kanbanSprintId)) return false;
      if (developerFilter !== 'all') {
        const names = item.developers?.length
          ? item.developers
          : item.developer
            ? [item.developer]
            : [];
        if (!names.some((n) => String(n) === String(developerFilter))) return false;
      }
      if (
        priorityFilter !== 'all' &&
        String(item.priority ?? '').toUpperCase() !== String(priorityFilter).toUpperCase()
      )
        return false;
      if (!matchesDueDateRange(item, dueFrom, dueTo)) return false;
      return true;
    });
  }, [items, kanbanSprintId, developerFilter, priorityFilter, dueFrom, dueTo]);

  const pendingCount = useMemo(() => {
    const scope = kanbanSprintId
      ? items.filter((i) => String(i.sprintId) === String(kanbanSprintId))
      : items;
    return scope.filter((i) => !i.done).length;
  }, [items, kanbanSprintId]);

  const hasActiveFilters =
    developerFilter !== 'all' || priorityFilter !== 'all' || Boolean(dueFrom) || Boolean(dueTo);
  const clearAllFilters = () => {
    setDeveloperFilter('all');
    setPriorityFilter('all');
    setDueFrom('');
    setDueTo('');
  };
  const projectIdNum = projectId != null && projectId !== '' ? Number(projectId) : null;

  // Colores reactivos al tema
  const borderColor = isDark ? '#2A2C32' : '#ECECEC';
  const cardBg = theme.palette.background.paper;
  const filterBg = isDark ? '#16181C' : '#FAFAFA';
  const chipBg = isDark ? '#2A2C32' : '#F0F0F0';
  const pendingChipBg = isDark ? '#3B2A1A' : '#FFF3E0';

  if (isLoading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
  }

  if (!sprintsForActiveProject.length) {
    return (
      <Box sx={{ maxWidth: 1200, width: '100%' }}>
        {loadError ? (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError('')}>
            {loadError}
          </Alert>
        ) : null}
        <DeveloperEmptyState
          pageTitle={developerMode ? 'Kanban Board' : 'Tasks'}
          description={
            developerMode
              ? 'There are no sprints or tasks assigned to you in this project yet. When your manager creates sprints and assigns work, your Kanban board will appear here.'
              : 'There are no sprints or tasks in this project yet. Create a sprint and add tasks to use the Kanban board.'
          }
        />
      </Box>
    );
  }

  // Responsive paddings
  const headerPadding = isMobile ? 1.5 : 2;
  const kanbanPadding = isMobile ? 1.5 : 2;

  return (
    <Box sx={{ maxWidth: 1200, width: '100%', px: { xs: 1, sm: 0 } }}>
      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      ) : null}
      {/* Header card */}
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.34, ease: pageEase }}
        elevation={0}
        sx={{ p: headerPadding, mb: 2, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg }}
      >
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-start' }, gap: { xs: 1.5, sm: 0 } }}>
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.5px', fontSize: { xs: '1.5rem', sm: '2rem' } }}
            >
              Kanban Board
            </Typography>
            <Chip
              label={`${pendingCount} pending`}
              size="small"
              sx={{ mt: 1, bgcolor: pendingChipBg, color: '#E65100', fontWeight: 700 }}
            />
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={isMobile ? 1 : 1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ minWidth: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
          >
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 180 },
                ...pageFormFieldOutline(),
                '& .MuiOutlinedInput-root': {
                  bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                  color: isDark ? '#F0F0F0' : '#1A1A1A',
                  '& fieldset': { borderColor: isDark ? '#2A2C32' : '#CCCCCC' },
                  '&:hover fieldset': { borderColor: isDark ? '#3A3C42' : '#AAAAAA' },
                },
                '& .MuiSelect-select': {
                  color: isDark ? '#F0F0F0' : '#1A1A1A',
                },
                '& .MuiInputLabel-root': {
                  color: isDark ? '#9A9A9A' : '#666666',
                },
                '& .MuiSvgIcon-root': {
                  color: isDark ? '#9A9A9A' : '#666666',
                },
              }}
            >
              <InputLabel id="tasks-header-sprint-select-label">Sprint</InputLabel>
              <Select
                labelId="tasks-header-sprint-select-label"
                value={kanbanSprintId || ''}
                label="Sprint"
                inputProps={{ 'aria-label': 'Sprint' }}
                onChange={(e) => setSelectedSprintId(String(e.target.value))}
                disabled={!sprints.length}
                renderValue={(value) => {
                  if (!value) return 'Select sprint';
                  const pool = sprintsForActiveProject.length ? sprintsForActiveProject : sprints;
                  return getSprintLabel(Number(value), pool);
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                      border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
                      '& .MuiMenuItem-root': {
                        color: isDark ? '#F0F0F0' : '#1A1A1A',
                        '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5' },
                        '&.Mui-selected': {
                          bgcolor: isDark ? '#2A2C32' : '#F0F0F0',
                          '&:hover': { bgcolor: isDark ? '#3A3C42' : '#E8E8E8' },
                        },
                      },
                    },
                  },
                }}
              >
                {sortedSprintsForSelect.map((s, index) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    Sprint {index}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {!developerMode ? (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
                sx={{
                  bgcolor: ORACLE_RED,
                  textTransform: 'none',
                  fontWeight: 700,
                  minHeight: 40,
                  width: { xs: '100%', sm: 'auto' },
                  '&:hover': { bgcolor: '#A83B2D' },
                }}
              >
                New task
              </Button>
            ) : null}
          </Stack>
        </Box>
      </Paper>

      {/* Filter card */}
      {!developerMode ? (
        <Paper
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.34, ease: pageEase }}
          elevation={0}
          sx={{
            p: isMobile ? 1.25 : 1.5,
            mb: 1.25,
            borderRadius: 3,
            border: `1px solid ${borderColor}`,
            bgcolor: filterBg,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <FilterListIcon sx={{ fontSize: isMobile ? 18 : 21, color: ORACLE_RED }} />
            <Typography sx={{ fontWeight: 800, color: 'text.primary', fontSize: isMobile ? '0.9rem' : '1rem' }}>
              Filter tasks
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: 1.25, alignItems: { xs: 'stretch', sm: 'flex-end' } }}>
            <FormControl
              size="small"
              sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}
            >
              <InputLabel>Developer</InputLabel>
              <Select
                value={developerFilter}
                onChange={(e) => setDeveloperFilter(e.target.value)}
                label="Developer"
                inputProps={{ 'aria-label': 'Developer' }}
              >
                <MenuItem value="all">All developers</MenuItem>
                {developerFilterOptions.map((u) => {
                  const uid = developerNumericId(u);
                  return (
                    <MenuItem key={uid ?? u.name} value={u.name}>
                      {u.name}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
            <FormControl
              size="small"
              sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}
            >
              <InputLabel>Priority</InputLabel>
              <Select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                label="Priority"
                inputProps={{ 'aria-label': 'Priority' }}
              >
                <MenuItem value="all">All priorities</MenuItem>
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="Due from"
              value={dueFrom}
              onChange={(e) => setDueFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}
            />
            <TextField
              size="small"
              type="date"
              label="Due to"
              value={dueTo}
              onChange={(e) => setDueTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}
            />
            {hasActiveFilters && (
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disableRipple
                onClick={clearAllFilters}
                sx={{
                  '&&': {
                    textTransform: 'none',
                    fontWeight: 600,
                    flexShrink: 0,
                    minHeight: 34,
                    py: 0.25,
                    border: `1px solid ${ORACLE_RED}`,
                    color: ORACLE_RED,
                    outline: 0,
                    boxShadow: 'none',
                    '&:hover': { borderColor: ORACLE_RED, bgcolor: alpha(ORACLE_RED, 0.06) },
                  },
                }}
              >
                Clear filters
              </Button>
            )}
            <Chip
              label={`${filteredItems.length} shown`}
              size="small"
              sx={{ bgcolor: chipBg, fontWeight: 700, height: 22, alignSelf: { xs: 'flex-start', sm: 'center' } }}
            />
          </Box>
        </Paper>
      ) : null}

      {/* Kanban */}
      <Grid
        component={motion.div}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.36, ease: pageEase }}
        container
        spacing={isMobile ? 2 : 3}
      >
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
            <Typography sx={{ fontWeight: 800, fontSize: isMobile ? '1rem' : '1.2rem', color: 'text.primary' }}>
              {developerMode ? 'Kanban Board' : 'Tasks'}
            </Typography>
            <Chip
              label={filteredItems.length}
              size="small"
              sx={{ ml: 'auto', bgcolor: chipBg, fontWeight: 700 }}
            />
          </Box>
          <Paper
            elevation={0}
            sx={{
              p: kanbanPadding,
              mb: 3,
              borderRadius: 3,
              border: `1px solid ${borderColor}`,
              bgcolor: cardBg,
              overflow: 'hidden',
              minHeight: 200,
            }}
          >
            {!kanbanSprintId ? (
              <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                Select a sprint to view tasks.
              </Typography>
            ) : filteredItems.length === 0 ? (
              <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                {developerMode
                  ? 'You have no assigned tasks in this sprint.'
                  : 'No tasks in this sprint. Create one with "New task".'}
              </Typography>
            ) : (
              <KanbanBoard
                items={filteredItems}
                onStatusChange={handleStatusChange}
                onOpenTask={handleOpenTaskFromKanban}
                statusMenuMode={developerMode ? 'full' : 'doneOnly'}
              />
            )}
          </Paper>
        </Grid>
      </Grid>

      <LogWorkedHoursDialog
        open={pendingDone != null}
        taskTitle={
          pendingDone?.taskTitle ??
          (pendingDone
            ? rawTasks.find((t) => Number(t.id) === Number(pendingDone.taskId))?.title
            : '')
        }
        initialHours={pendingDone?.initialHours ?? ''}
        onCancel={() => setPendingDone(null)}
        onConfirm={handleConfirmWorkedHours}
      />

      {/* Multi-done dialog */}
      <Dialog
        open={multiDoneTaskId != null}
        onClose={() => setMultiDoneTaskId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, bgcolor: 'background.paper', margin: { xs: 1, sm: 'auto' } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: isMobile ? '1rem' : '1.1rem', color: 'text.primary' }}>
          Complete each assignment
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The task moves to Done only when every developer assigned has been marked complete.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}>
            {multiDoneTaskId != null
              ? rawTasks.find((t) => t.id === multiDoneTaskId)?.title || `Task #${multiDoneTaskId}`
              : ''}
          </Typography>
          <Stack spacing={1.5}>
            {multiDoneTaskId != null
              ? userTasks
                  .filter(
                    (ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId),
                  )
                  .map((ut) => {
                    const done = isUserTaskAssigneeComplete(ut);
                    const name = ut.user?.name || `User ${ut.user?.id ?? ut.user?.ID ?? '?'}`;
                    return (
                      <Box
                        key={`${ut.user?.id ?? ut.user?.ID}-${multiDoneTaskId}`}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                          {name}
                        </Typography>
                        {done ? (
                          <Chip
                            label="Done"
                            size="small"
                            sx={{
                              bgcolor: isDark ? '#0D2E12' : '#E8F5E9',
                              color: '#2E7D32',
                              fontWeight: 700,
                            }}
                          />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => markAssigneeDone(multiDoneTaskId, ut)}
                            sx={{ textTransform: 'none', fontWeight: 600, width: { xs: '100%', sm: 'auto' } }}
                          >
                            Mark complete
                          </Button>
                        )}
                      </Box>
                    );
                  })
              : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: isMobile ? 2 : 2.5, pb: 2 }}>
          <Button
            onClick={() => setMultiDoneTaskId(null)}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {!developerMode ? (
        <NewTaskDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onCreated={handleTaskCreated}
          sprints={sprintsForActiveProject}
          projectDevelopers={projectDevelopers}
          defaultSprintId={kanbanSprintId || selectedSprintId || undefined}
        />
      ) : null}
      <TaskDetailDialog
        open={taskDetailOpen}
        initialTask={taskForDetailDialog}
        initialUserTasks={userTasks}
        sprints={sprintsForActiveProject}
        projectDevelopers={projectDevelopers}
        activeProjectId={selectedProjectId}
        readOnly={developerMode}
        onClose={closeTaskDetailDialog}
        onSaved={async (updated, meta) => {
          setRawTasks((prev) => mergeUpdatedTask(prev, updated));
          setUserTasks((prev) =>
            patchUserTasksAfterTaskSave(prev, updated, meta, projectDevelopers),
          );
          closeTaskDetailDialog();
          notifyTasksMutated({
            source: 'tasks-page',
            type: 'task-updated',
            taskId: updated?.id,
            task: updated,
            meta,
          });
          try {
            await refreshSharedAfterTaskMutation();
          } catch (e) {
            console.error('Failed to refresh tasks after save:', e);
          }
        }}
        onDeleted={async (taskId) => {
          removeTaskFromState(taskId);
          closeTaskDetailDialog();
          notifyTasksMutated({ source: 'tasks-page', type: 'task-deleted', taskId });
          await refreshSharedAfterTaskMutation();
        }}
      />
    </Box>
  );
}