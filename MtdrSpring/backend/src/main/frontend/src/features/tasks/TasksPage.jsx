import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  CircularProgress,
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
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import KanbanBoard from './KanbanBoard';
import { TaskDetailDialog } from './TaskDetailDialog';
import { matchesDueDateRange } from './taskFilters';
import { developerNumericId } from '../../utils/userIds';
import { TasksNewTaskDialog } from './TasksNewTaskDialog';
import { API_BASE, ORACLE_RED, pageEase } from './constants/taskConstants';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import {
  resolveActiveProjectId,
  sprintProjectIdFromJson,
  mapTaskToKanban,
  isUserTaskAssigneeComplete,
  pageFormFieldOutline,
} from './utils/taskUtils';

export default function TasksPage({ projectId }) {
  const effectiveProjectId = resolveActiveProjectId(projectId);
  const [rawTasks, setRawTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users] = useState([]);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  /** Kanban scope: one sprint at a time (set when sprints load). */
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [multiDoneTaskId, setMultiDoneTaskId] = useState(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  const [taskForDetailDialog, setTaskForDetailDialog] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const pid = effectiveProjectId;
      const sprintsUrl =
        pid != null
          ? `${API_BASE}/api/sprints?projectId=${encodeURIComponent(pid)}`
          : `${API_BASE}/api/sprints`;
      const tasksUrl =
        pid != null
          ? `${API_BASE}/api/tasks?projectId=${encodeURIComponent(pid)}`
          : `${API_BASE}/api/tasks`;
      const userTasksUrl =
        pid != null
          ? `${API_BASE}/api/user-tasks?projectId=${encodeURIComponent(pid)}`
          : `${API_BASE}/api/user-tasks`;
      const [tasksRes, sprintsRes, userTasksRes] = await Promise.all([
        fetch(tasksUrl),
        fetch(sprintsUrl),
        fetch(userTasksUrl),
      ]);

      let tasksData = await tasksRes.json();
      let sprintsData = await sprintsRes.json();
      let userTasksData = await userTasksRes.json();

      if (pid != null) {
        sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === Number(pid));
        const sprintIds = new Set(sprintsData.map((s) => Number(s.id)));
        tasksData = tasksData.filter((t) => {
          const sid = t.assignedSprint?.id;
          return sid != null && sprintIds.has(Number(sid));
        });
        const taskIds = new Set(
          (Array.isArray(tasksData) ? tasksData : []).map((t) => Number(t.id)),
        );
        userTasksData = (Array.isArray(userTasksData) ? userTasksData : []).filter((ut) => {
          const tid = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
          const n = Number(tid);
          return Number.isFinite(n) && taskIds.has(n);
        });
      }

      setRawTasks(Array.isArray(tasksData) ? tasksData : []);
      setSprints(Array.isArray(sprintsData) ? sprintsData : []);
      setUserTasks(userTasksData);
    } catch (error) {
      console.error('Error loading tasks data:', error);
      setRawTasks([]);
      setSprints([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveProjectId]);

  useEffect(() => {
    try {
      if (localStorage.getItem('openCreateTaskDialog') === '1') {
        setDialogOpen(true);
        localStorage.removeItem('openCreateTaskDialog');
      }
    } catch (e) {
      // ignore localStorage errors
    }
  }, []);

  /** Same default sprint as Dashboard / Sprints page: calendar-active, or next after last ended window, etc. */
  const kanbanSprintId = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return '';
    const ids = sprints.map((s) => String(s.id));
    if (
      selectedSprintId !== '' &&
      selectedSprintId != null &&
      ids.includes(String(selectedSprintId))
    ) {
      return String(selectedSprintId);
    }
    const picked = pickDefaultSelectedSprint(sprints);
    return picked?.id != null ? String(picked.id) : '';
  }, [selectedSprintId, sprints]);

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
      } catch (e) {
        // ignore localStorage errors
      }
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
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${selectedProjectId}/developers`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) {
          setProjectDevelopers(Array.isArray(data) ? data : []);
        }
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

  useEffect(() => {
    if (developerFilter === 'all') return;
    const stillExists = developerFilterOptions.some((u) => u?.name === developerFilter);
    if (!stillExists) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);

  const handleStatusChange = async (taskId, newStatus) => {
    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assignees = userTasks.filter(
      (ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(taskId),
    );
    const ns = String(newStatus || '').toUpperCase();

    const putTask = async () => {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRawTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      }
    };

    try {
      if (assignees.length === 0) {
        await putTask();
        return;
      }
      if (assignees.length === 1) {
        if (ns === 'DONE') {
          const ut = assignees[0];
          const uid = Number(ut.user?.id ?? ut.user?.ID);
          const markDoneRes = await fetch(`${API_BASE}/api/user-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: uid,
              taskId: Number(taskId),
              status: 'COMPLETED',
            }),
          });
          if (markDoneRes.ok) {
            setUserTasks((prev) =>
              prev.map((row) => {
                const rowTaskId = Number(row?.task?.id ?? row?.id?.taskId);
                const rowUserId = Number(row?.user?.id ?? row?.user?.ID ?? row?.id?.userId);
                if (rowTaskId !== Number(taskId) || rowUserId !== uid) return row;
                return { ...row, status: 'COMPLETED' };
              }),
            );
            await putTask();
          }
        } else {
          await putTask();
        }
        return;
      }
      if (ns === 'DONE') {
        const allDone = assignees.every((ut) => isUserTaskAssigneeComplete(ut));
        if (allDone) {
          await putTask();
        } else {
          setMultiDoneTaskId(taskId);
        }
        return;
      }
      await putTask();
    } catch (e) {
      console.error('Error updating task status:', e);
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

  const handleDeleteTask = async (taskId) => {
    if (
      !window.confirm(
        'Delete this task permanently? Assignments and user-task rows will be removed. This cannot be undone.',
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.text();
        console.error('Delete task failed:', res.status, err);
        return;
      }
      if (multiDoneTaskId === taskId) setMultiDoneTaskId(null);
      await loadData();
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  useEffect(() => {
    if (multiDoneTaskId == null) return;
    const uts = userTasks.filter(
      (ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId),
    );
    if (uts.length > 0 && uts.every((ut) => isUserTaskAssigneeComplete(ut))) {
      setMultiDoneTaskId(null);
    }
  }, [userTasks, multiDoneTaskId]);

  const markAssigneeDone = async (taskId, ut) => {
    const uid = Number(ut.user?.id ?? ut.user?.ID);
    try {
      const res = await fetch(`${API_BASE}/api/user-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          taskId: Number(taskId),
          status: 'COMPLETED',
        }),
      });
      if (res.ok) await loadData();
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
      if (directName) return directName;
      return null;
    },
    [users, projectDevelopers],
  );

  const developersByTaskId = useMemo(() => {
    const map = new Map();
    userTasks.forEach((ut) => {
      const rawTaskId = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId ?? ut?.taskId;
      const taskId = rawTaskId != null ? String(rawTaskId) : null;
      const devName = resolveUserTaskDeveloperName(ut);
      if (!taskId || !devName) return;
      const existing = map.get(taskId);
      if (!existing) map.set(taskId, [devName]);
      else if (!existing.includes(devName)) existing.push(devName);
    });
    return map;
  }, [userTasks, resolveUserTaskDeveloperName]);

  const items = useMemo(
    () =>
      rawTasks.map((task) => mapTaskToKanban(task, developersByTaskId.get(String(task.id)) ?? [])),
    [rawTasks, developersByTaskId],
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

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: ORACLE_RED }} />
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: pageEase }}
      sx={{ maxWidth: 1200, width: '100%' }}
    >
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.34, ease: pageEase }}
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF' }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}
            >
              Kanban Board
            </Typography>
            <Chip
              label={`${pendingCount} pending`}
              size="small"
              sx={{ mt: 1, bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700 }}
            />
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.25}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
          >
            <FormControl
              size="small"
              sx={{ minWidth: { xs: '100%', sm: 180 }, ...pageFormFieldOutline() }}
            >
              <InputLabel id="tasks-header-sprint-select-label">Sprint</InputLabel>
              <Select
                labelId="tasks-header-sprint-select-label"
                value={kanbanSprintId || ''}
                label="Sprint"
                inputProps={{ 'aria-label': 'Sprint' }}
                onChange={(e) => setSelectedSprintId(String(e.target.value))}
                disabled={!sprints.length}
              >
                {(projectIdNum != null && Number.isFinite(projectIdNum)
                  ? sprints.filter((s) => Number(s.assignedProject?.id) === projectIdNum)
                  : sprints
                ).map((s) => (
                  <MenuItem key={s.id} value={String(s.id)}>
                    Sprint {s.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{
                textTransform: 'none',
                borderColor: '#DDD',
                color: '#555',
                borderRadius: 2,
                minHeight: 40,
              }}
            >
              Sync data
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{
                bgcolor: ORACLE_RED,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2,
                '&:hover': { bgcolor: '#A83B2D' },
              }}
            >
              New task
            </Button>
          </Stack>
        </Box>
        {!sprints.length && !isLoading ? (
          <Typography variant="body2" sx={{ mt: 1.25, color: '#757575' }}>
            No sprints available.
          </Typography>
        ) : null}
      </Paper>

      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.34, ease: pageEase }}
        elevation={0}
        sx={{ p: 1.5, mb: 1.25, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FAFAFA' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <FilterListIcon sx={{ fontSize: 21, color: ORACLE_RED }} />
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1rem' }}>
            Filter tasks
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'flex-end' }}>
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
              onClick={clearAllFilters}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderColor: ORACLE_RED,
                color: ORACLE_RED,
                flexShrink: 0,
                minHeight: 34,
                py: 0.25,
              }}
            >
              Clear filters
            </Button>
          )}
          <Chip
            label={`${filteredItems.length} shown`}
            size="small"
            sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 22 }}
          />
        </Box>
      </Paper>

      <Grid
        component={motion.div}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.36, ease: pageEase }}
        container
        spacing={3}
      >
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A1A1A' }}>
              Tasks
            </Typography>
            <Chip
              label={filteredItems.length}
              size="small"
              sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700 }}
            />
          </Box>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 3,
              border: '1px solid #ECECEC',
              bgcolor: '#FFFFFF',
              overflow: 'hidden',
            }}
          >
            <KanbanBoard
              items={filteredItems}
              onStatusChange={handleStatusChange}
              onDeleteTask={handleDeleteTask}
              onOpenTask={handleOpenTaskFromKanban}
            />
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={multiDoneTaskId != null}
        onClose={() => setMultiDoneTaskId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
          Complete each assignment
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The task moves to Done only when every developer assigned has been marked complete.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>
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
                        <Typography variant="body2">{name}</Typography>
                        {done ? (
                          <Chip
                            label="Done"
                            size="small"
                            sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }}
                          />
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => markAssigneeDone(multiDoneTaskId, ut)}
                            sx={{ textTransform: 'none', fontWeight: 600 }}
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
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button
            onClick={() => setMultiDoneTaskId(null)}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <TasksNewTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          loadData();
        }}
        sprints={sprintsForActiveProject}
        projectDevelopers={projectDevelopers}
        defaultSprintId={selectedSprintId}
        pickerProjectId={effectiveProjectId}
      />

      <TaskDetailDialog
        open={taskDetailOpen}
        initialTask={taskForDetailDialog}
        sprints={sprintsForActiveProject}
        projectDevelopers={projectDevelopers}
        activeProjectId={selectedProjectId}
        onClose={closeTaskDetailDialog}
        onSaved={(updated) => {
          setRawTasks((prev) =>
            prev.map((t) => (Number(t.id) === Number(updated.id) ? updated : t)),
          );
          closeTaskDetailDialog();
          loadData();
        }}
        onDeleted={(taskId) => {
          setRawTasks((prev) => prev.filter((t) => Number(t.id) !== Number(taskId)));
          closeTaskDetailDialog();
          loadData();
        }}
      />
    </Box>
  );
}
