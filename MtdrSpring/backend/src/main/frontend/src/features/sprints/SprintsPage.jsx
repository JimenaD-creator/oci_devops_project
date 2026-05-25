import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { developerNumericId, finiteUserIds } from '../../utils/userIds';
import TaskTable from '../tasks/TaskTable';
import {
  deriveTaskStatusFromAssignments,
  isUserTaskAssigneeComplete,
  normalizeTaskStatus,
  taskEntityId,
  userTaskRowStatus,
  userTaskRowTaskId,
} from '../tasks/utils/taskUtils';
import {
  EditSprintDialog,
  NewSprintDialog,
  NewTaskDialog,
  SprintCard,
  TaskDetailDialog,
  API_BASE,
  deleteSprintConfirmMessage,
  EASE_OUT,
  ORACLE_RED,
  ORACLE_RED_ACTION,
  pickDefaultSelectedSprint,
  resolveActiveProjectIdNum,
  sortSprintsForDisplay,
  sortTasksForSprintTable,
  sprintsOverviewVariants,
  taskDisplayName,
} from './index';
import {
  fetchSprintsProjectDevelopers,
  fetchSprintsProjectSummary,
  fetchSprintsTasksAndAssignments,
} from './sprintsPageApi';

export default function SprintsPage({ projectId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueDateFilter, setDueDateFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const [sprintForEdit, setSprintForEdit] = useState(null);
  const [selectedTaskForDialog, setSelectedTaskForDialog] = useState(null);
  const [projectName, setProjectName] = useState(
    () => localStorage.getItem('currentProjectName') || '',
  );
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);
  const sprintNumberMap = useMemo(() => {
  const map = new Map();
  [...sprints].sort((a, b) => a.id - b.id).forEach((s, i) => map.set(s.id, i + 1));
  return map;
}, [sprints]);
  /** Prevents a background reload (e.g. after confirm dialog focus) from re-adding a deleted task. */
  const recentlyDeletedTaskIdsRef = useRef(new Set());

  useEffect(() => {
    if (effectiveProjectIdNum != null) {
      try {
        localStorage.setItem('currentProjectId', String(effectiveProjectIdNum));
      } catch (e) {
        // ignore localStorage errors
      }
    }
  }, [effectiveProjectIdNum]);

  useEffect(() => {
    let cancelled = false;
    if (effectiveProjectIdNum == null) {
      setProjectDevelopers([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const data = await fetchSprintsProjectDevelopers(effectiveProjectIdNum);
        if (!cancelled) setProjectDevelopers(data);
      } catch {
        if (!cancelled) setProjectDevelopers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectIdNum]);

  useEffect(() => {
    if (effectiveProjectIdNum == null) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await fetchSprintsProjectSummary(effectiveProjectIdNum);
        if (!cancelled && p?.name) {
          setProjectName(String(p.name).trim());
          try {
            localStorage.setItem('currentProjectName', String(p.name).trim());
          } catch {
            // ignore
          }
        }
      } catch {
        // keep previous / fallback below
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectIdNum]);

  const loadData = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      if (!silent) setLoading(true);
      try {
        const { sprintsList, tasksList, userTasksList } =
          await fetchSprintsTasksAndAssignments(projectId);
        const deleted = recentlyDeletedTaskIdsRef.current;
        const visibleTasks = (Array.isArray(tasksList) ? tasksList : []).filter(
          (t) => !deleted.has(taskEntityId(t)),
        );
        const visibleUserTasks = (Array.isArray(userTasksList) ? userTasksList : []).filter(
          (ut) => !deleted.has(String(userTaskRowTaskId(ut))),
        );
        const sorted = sortSprintsForDisplay(sprintsList, visibleTasks);
        setSprints(sorted);
        setTasks(visibleTasks);
        setUserTasks(visibleUserTasks);
        setSelectedSprint((prev) => {
          if (prev) {
            const stillThere = sorted.find((s) => s.id === prev.id);
            if (stillThere) return stillThere;
          }
          return pickDefaultSelectedSprint(sorted) ?? sorted[0];
        });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    loadData();
  }, [loadData, effectiveProjectIdNum]);

  const handleTaskDeleted = useCallback((taskId) => {
    const tid = String(taskId);
    recentlyDeletedTaskIdsRef.current.add(tid);
    setTimeout(() => recentlyDeletedTaskIdsRef.current.delete(tid), 15000);

    setTasks((prev) => {
      const next = prev.filter((t) => taskEntityId(t) !== tid);
      setSprints((sp) => sortSprintsForDisplay(sp, next));
      return next;
    });
    setUserTasks((prev) =>
      prev.filter((ut) => {
        const utTid = userTaskRowTaskId(ut);
        return !Number.isFinite(utTid) || String(utTid) !== tid;
      }),
    );
    setSelectedTaskForDialog(null);
  }, []);

  const handleSprintCreated = (newSprint) => {
    setSprints((prev) => sortSprintsForDisplay([newSprint, ...prev], tasks));
    setSelectedSprint(newSprint);
  };
  const handleDeleteSprint = async () => {
    if (!selectedSprint?.id) return;
    if (!window.confirm(deleteSprintConfirmMessage(selectedSprint.id))) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/sprints/${selectedSprint.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const msg = (await res.text()) || `Request failed (${res.status})`;
        window.alert(`Could not delete sprint. ${msg}`);
        return;
      }
      setSelectedTaskForDialog(null);
      await loadData();
    } catch {
      window.alert('Connection error deleting sprint.');
    }
  };
  const selectedSprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    return sortTasksForSprintTable(tasks.filter((t) => t.assignedSprint?.id === selectedSprint.id));
  }, [tasks, selectedSprint]);
  const assignmentsByTaskId = useMemo(() => {
    return (Array.isArray(userTasks) ? userTasks : []).reduce((acc, ut) => {
      const tid = userTaskRowTaskId(ut);
      if (!Number.isFinite(tid)) return acc;
      if (!acc[tid]) acc[tid] = [];
      acc[tid].push(ut);
      return acc;
    }, {});
  }, [userTasks]);
  const selectedSprintRows = useMemo(
    () =>
      selectedSprintTasks.map((task) => {
        const taskAssignments = assignmentsByTaskId[Number(task.id)] || [];
        const resolveUtName = (ut) => {
          const direct = String(
            ut?.user?.name ?? ut?.user?.NAME ?? ut?.user?.fullName ?? ut?.user?.displayName ?? '',
          ).trim();
          if (direct) return direct;
          const uid = Number(ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId);
          if (Number.isFinite(uid)) {
            const known = (projectDevelopers || []).find((u) => developerNumericId(u) === uid);
            if (known?.name) return String(known.name).trim();
            return `User ${uid}`;
          }
          return null;
        };
        const names = [...new Set(taskAssignments.map((ut) => resolveUtName(ut)).filter(Boolean))];
        const workedHours = taskAssignments.reduce((sum, ut) => {
          const n = Number(ut?.workedHours ?? ut?.worked_hours ?? ut?.hours ?? 0);
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        const assigneeProgress =
          taskAssignments.length > 0
            ? [...taskAssignments]
                .map((ut) => {
                  const uid = Number(ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId);
                  const name =
                    resolveUtName(ut) || (Number.isFinite(uid) ? `User ${uid}` : 'Unknown');
                  return {
                    userId: Number.isFinite(uid) ? uid : null,
                    name,
                    status: normalizeTaskStatus(userTaskRowStatus(ut)),
                    completed: isUserTaskAssigneeComplete(ut),
                  };
                })
                .sort((a, b) =>
                  String(a.name).localeCompare(String(b.name), undefined, {
                    sensitivity: 'base',
                  }),
                )
            : undefined;
        const derivedStatus = deriveTaskStatusFromAssignments(task.status, taskAssignments);
        return {
          id: task.id,
          description: taskDisplayName(task),
          priority: task.priority ?? null,
          assignedHours: task.assignedHours ?? null,
          done: derivedStatus === 'DONE',
          status: derivedStatus,
          statusRaw: derivedStatus,
          dueDate: task.dueDate,
          completedAt: task.finishDate,
          developers: names,
          developer: names[0] ?? null,
          actualHours: workedHours > 0 ? workedHours : null,
          assigneeProgress,
        };
      }),
    [selectedSprintTasks, assignmentsByTaskId, projectDevelopers],
  );
  const developerFilterOptions = useMemo(() => {
    const set = new Set();
    selectedSprintRows.forEach((r) => {
      (r.developers || []).forEach((d) => d && set.add(String(d).trim()));
      if (r.developer) set.add(String(r.developer).trim());
    });
    (projectDevelopers || []).forEach((u) => {
      if (u?.name) set.add(String(u.name).trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selectedSprintRows, projectDevelopers]);
  useEffect(() => {
    if (developerFilter === 'all') return;
    if (!developerFilterOptions.includes(developerFilter)) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);
  const clearTaskTableFilters = () => {
    setDeveloperFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDueDateFilter('');
  };
  const hasTaskTableFilters =
    developerFilter !== 'all' ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    Boolean(dueDateFilter);
  const handleOpenNewTask = () => {
    if (effectiveProjectIdNum == null) return;
    setNewTaskDialogOpen(true);
  };
  const filteredSprintRows = useMemo(() => {
    return selectedSprintRows.filter((row) => {
      if (developerFilter !== 'all') {
        const f = String(developerFilter).trim();
        const names = [...(Array.isArray(row.developers) ? row.developers : []), row.developer]
          .filter(Boolean)
          .map((n) => String(n).trim());
        if (!names.includes(f)) return false;
      }
      if (statusFilter !== 'all') {
        const want = String(statusFilter).toUpperCase();
        const rowStatus = String(row.status || '').toUpperCase();
        let statusOk = rowStatus === want;
        if (!statusOk && developerFilter !== 'all') {
          const f = String(developerFilter).trim();
          const mine = (row.assigneeProgress || []).find((p) => String(p.name).trim() === f);
          if (mine?.status) {
            statusOk = normalizeTaskStatus(mine.status) === want;
          } else if (want === 'DONE') {
            statusOk = Boolean(mine?.completed);
          }
        }
        if (!statusOk) return false;
      }
      if (priorityFilter !== 'all') {
        const rowPriority = String(row.priority || '').toUpperCase();
        if (rowPriority !== String(priorityFilter).toUpperCase()) return false;
      }
      if (dueDateFilter) {
        const dueStr = row.dueDate ? String(row.dueDate).slice(0, 10) : '';
        if (!dueStr) return false;
        if (dueStr !== dueDateFilter) return false;
      }
      return true;
    });
  }, [selectedSprintRows, developerFilter, statusFilter, priorityFilter, dueDateFilter]);

  if (loading) return <PageLoadingSpinner color={ORACLE_RED} />;

  const subtitleProjectName =
    projectName ||
    (effectiveProjectIdNum === 1 ? 'Software Manager Tool' : null) ||
    sprints[0]?.assignedProject?.name ||
    'Project';
  const subtitleProjectId = effectiveProjectIdNum;
  return (
    <Box
      component={motion.div}
      variants={sprintsOverviewVariants.page}
      initial="hidden"
      animate="show"
      sx={{ maxWidth: 1200, width: '100%' }}
    >
      <Box
        component={motion.div}
        variants={sprintsOverviewVariants.block}
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.5px',
              fontSize: { xs: '1.65rem', sm: '1.85rem' },
            }}
          >
            Sprints
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.75 }}>
            {subtitleProjectName}
            {subtitleProjectId != null && <> · ID {subtitleProjectId}</>} · {sprints.length} total
            sprints
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => selectedSprint && setSprintForEdit(selectedSprint)}
            disabled={!selectedSprint}
            size="small"
            sx={{
              textTransform: 'none',
              borderColor: isDark ? '#2A2C32' : '#DDD',
              color: isDark ? '#9A9A9A' : '#555',
              borderRadius: 2,
              mr: 1,
            }}
          >
            Edit sprint
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDeleteSprint}
            disabled={!selectedSprint}
            size="small"
            sx={{
              textTransform: 'none',
              borderColor: isDark ? '#7F3030' : '#E0B4AF',
              color: '#B64536',
              borderRadius: 2,
              mr: 1,
            }}
          >
            Delete sprint
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={effectiveProjectIdNum == null}
            sx={{
              bgcolor: ORACLE_RED,
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              '&:hover': { bgcolor: ORACLE_RED_ACTION },
            }}
          >
            Create new sprint
          </Button>
        </Box>
      </Box>
      <Box component={motion.div} variants={sprintsOverviewVariants.block}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                mb: 1.5,
                fontSize: '1.15rem',
                letterSpacing: '-0.02em',
              }}
            >
              Sprint history
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                overflowX: 'auto',
                pb: 0.5,
                pr: 0.5,
                scrollSnapType: 'x proximity',
              }}
            >
              {sprints.map((sprint, i) => (
                <Box
                  key={sprint.id}
                  component={motion.div}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 0.08 + i * 0.045,
                    duration: 0.36,
                    ease: EASE_OUT,
                  }}
                  sx={{ flex: '0 0 320px', minWidth: 280, maxWidth: 360, scrollSnapAlign: 'start' }}
                >
<SprintCard
  sprint={sprint}
  tasks={tasks}
  isSelected={selectedSprint?.id === sprint.id}
  onClick={() => setSelectedSprint(sprint)}
  sprintNumber={sprintNumberMap.get(sprint.id)}
/>
                </Box>
              ))}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Typography
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                fontSize: '1.02rem',
                mb: 1.25,
                display: 'block',
              }}
            >
{selectedSprint ? `Tasks · Sprint ${sprintNumberMap.get(selectedSprint.id) ?? selectedSprint.id}` : 'Tasks'}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1.25,
                mb: 1.5,
                rowGap: 1.25,
              }}
            >
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 220 },
                  width: { xs: '100%', sm: 'auto' },
                  flex: { xs: '1 1 100%', sm: '0 1 auto' },
                }}
              >
                <InputLabel id="overview-sprint-dev-filter">Developer</InputLabel>
                <Select
                  labelId="overview-sprint-dev-filter"
                  value={developerFilter}
                  label="Developer"
                  onChange={(e) => setDeveloperFilter(e.target.value)}
                >
                  <MenuItem value="all">All developers</MenuItem>
                  {developerFilterOptions.map((name) => (
                    <MenuItem key={name} value={name}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 170 },
                  width: { xs: '100%', sm: 'auto' },
                  flex: { xs: '1 1 100%', sm: '0 1 auto' },
                }}
              >
                <InputLabel id="overview-sprint-status-filter">Status</InputLabel>
                <Select
                  labelId="overview-sprint-status-filter"
                  value={statusFilter}
                  label="Status"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">All statuses</MenuItem>
                  <MenuItem value="TODO">To do</MenuItem>
                  <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                  <MenuItem value="IN_REVIEW">In review</MenuItem>
                  <MenuItem value="DONE">Done</MenuItem>
                </Select>
              </FormControl>
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 170 },
                  width: { xs: '100%', sm: 'auto' },
                  flex: { xs: '1 1 100%', sm: '0 1 auto' },
                }}
              >
                <InputLabel id="overview-sprint-priority-filter">Priority</InputLabel>
                <Select
                  labelId="overview-sprint-priority-filter"
                  value={priorityFilter}
                  label="Priority"
                  onChange={(e) => setPriorityFilter(e.target.value)}
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
                label="Due date"
                value={dueDateFilter}
                onChange={(e) => setDueDateFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  minWidth: { xs: '100%', sm: 160 },
                  width: { xs: '100%', sm: 'auto' },
                  flex: { xs: '1 1 100%', sm: '0 1 auto' },
                }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<TaskAltIcon sx={{ fontSize: 20 }} />}
                onClick={handleOpenNewTask}
                disabled={effectiveProjectIdNum == null}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  height: 40,
                  minHeight: 40,
                  px: 2,
                  width: { xs: '100%', sm: 'auto' },
                  flex: { xs: '1 1 100%', sm: '0 0 auto' },
                  whiteSpace: 'nowrap',
                  bgcolor: ORACLE_RED,
                  '&:hover': { bgcolor: ORACLE_RED_ACTION },
                }}
              >
                New Task
              </Button>
              {hasTaskTableFilters ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disableRipple
                  onClick={clearTaskTableFilters}
                  sx={{
                    '&&': {
                      textTransform: 'none',
                      fontWeight: 600,
                      height: 40,
                      minHeight: 40,
                      width: { xs: '100%', sm: 'auto' },
                      flex: { xs: '1 1 100%', sm: '0 0 auto' },
                      border: `1px solid ${ORACLE_RED_ACTION}`,
                      color: ORACLE_RED_ACTION,
                      outline: 0,
                      boxShadow: 'none',
                      WebkitTapHighlightColor: 'transparent',
                      '&:hover': {
                        borderColor: ORACLE_RED_ACTION,
                        bgcolor: alpha(ORACLE_RED_ACTION, 0.06),
                      },
                      '&:focus': {
                        outline: 0,
                        border: `1px solid ${ORACLE_RED_ACTION}`,
                        boxShadow: 'none',
                      },
                      '&:focus-visible': {
                        outline: 0,
                        border: `1px solid ${ORACLE_RED_ACTION}`,
                        boxShadow: 'none',
                      },
                      '&.Mui-focusVisible': {
                        outline: 0,
                        border: `1px solid ${ORACLE_RED_ACTION}`,
                        boxShadow: 'none',
                      },
                      '&:active': {
                        border: `1px solid ${ORACLE_RED_ACTION}`,
                        boxShadow: 'none',
                      },
                    },
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </Box>
            {selectedSprint &&
            selectedSprintRows.length > 0 &&
            filteredSprintRows.length === 0 &&
            hasTaskTableFilters ? (
              <Box
                sx={{
                  py: 3.5,
                  px: 2,
                  textAlign: 'center',
                  border: `1px dashed ${isDark ? '#2A2C32' : '#E0E0E0'}`,
                  borderRadius: 2,
                  bgcolor: isDark ? '#16181C' : '#FAFAFA',
                  mt: 0.5,
                }}
              >
                <Typography sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.95rem' }}>
                  {statusFilter !== 'all' &&
                  developerFilter === 'all' &&
                  priorityFilter === 'all' &&
                  !dueDateFilter
                    ? 'No tasks with this status.'
                    : 'No tasks match the selected filters.'}
                </Typography>
              </Box>
            ) : (
              <TaskTable
                items={filteredSprintRows}
                variant="manager"
                onRowClick={(row) => {
                  const task = selectedSprintTasks.find((t) => Number(t.id) === Number(row.id));
                  if (task) setSelectedTaskForDialog(task);
                }}
                scrollMaxHeight={420}
              />
            )}
          </Grid>
        </Grid>
      </Box>

      <NewSprintDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleSprintCreated}
        projectId={effectiveProjectIdNum}
      />
      <NewTaskDialog
        open={newTaskDialogOpen}
        onClose={() => setNewTaskDialogOpen(false)}
        onCreated={(createdTask, assignedUserIds = [], assignmentStatus = 'TODO') => {
          setTasks((prev) => {
            const exists = prev.some((t) => Number(t.id) === Number(createdTask?.id));
            const next = exists ? prev : [createdTask, ...prev];
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
          if (createdTask?.id) {
            const byId = new Map(
              (projectDevelopers || []).map((u) => [Number(developerNumericId(u)), u]),
            );
            const optimisticRows = finiteUserIds(assignedUserIds).map((uid) => {
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
              setUserTasks((prev) => [...optimisticRows, ...prev]);
            }
          }
          setNewTaskDialogOpen(false);
        }}
        sprints={sprints}
        projectDevelopers={projectDevelopers}
        defaultSprintId={selectedSprint?.id}
      />

      <EditSprintDialog
        open={Boolean(sprintForEdit)}
        sprint={sprintForEdit}
        onClose={() => setSprintForEdit(null)}
        onSaved={(updated) => {
          setSprints((prev) =>
            sortSprintsForDisplay(
              prev.map((s) => (s.id === updated.id ? updated : s)),
              tasks,
            ),
          );
          setSelectedSprint((prev) => (prev?.id === updated.id ? updated : prev));
        }}
      />

      <TaskDetailDialog
        open={Boolean(selectedTaskForDialog)}
        initialTask={selectedTaskForDialog}
        sprints={sprints}
        projectDevelopers={projectDevelopers}
        activeProjectId={effectiveProjectIdNum}
        onClose={() => setSelectedTaskForDialog(null)}
        onSaved={(updated, meta) => {
          setTasks((prev) => {
            const next = prev.map((x) =>
              Number(x.id) === Number(updated.id) ? { ...x, ...updated } : x,
            );
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
          if (meta?.assigneesChanged) {
            const tid = Number(updated.id);
            const ids = finiteUserIds(meta.assigneeUserIds);
            setUserTasks((prev) => {
              const rest = prev.filter((ut) => userTaskRowTaskId(ut) !== tid);
              if (ids.length === 0) return rest;
              const st = updated?.status ?? 'TODO';
              const added = ids.map((userId) => {
                const known = projectDevelopers.find((u) => developerNumericId(u) === userId);
                const name = String(
                  known?.name ?? known?.displayName ?? known?.email ?? `User ${userId}`,
                ).trim();
                return {
                  user: { id: userId, name: name || `User ${userId}` },
                  task: { id: tid },
                  status: st,
                };
              });
              return [...rest, ...added];
            });
          } else if (meta?.syncAssignmentStatuses && meta.assignmentStatus != null) {
            const tid = Number(updated.id);
            const st = meta.assignmentStatus;
            setUserTasks((prev) =>
              prev.map((ut) => (userTaskRowTaskId(ut) === tid ? { ...ut, status: st } : ut)),
            );
          }
          setSelectedTaskForDialog(null);
          void loadData({ silent: true });
        }}
        onDeleted={handleTaskDeleted}
      />
    </Box>
  );
}