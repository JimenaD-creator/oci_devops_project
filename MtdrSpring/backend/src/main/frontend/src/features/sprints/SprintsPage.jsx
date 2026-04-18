import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, Grid, Button,
  CircularProgress,
  TextField, Stack, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { developerNumericId, finiteUserIds } from '../../utils/userIds';
import TaskTable from '../tasks/TaskTable';
import {
  EditSprintDialog,
  NewSprintDialog,
  NewTaskDialog,
  SprintCard,
  TaskDetailDialog,
  API_BASE,
  EASE_OUT,
  ORACLE_RED,
  ORACLE_RED_ACTION,
  fetchJsonNoStore,
  pickDefaultSelectedSprint,
  resolveActiveProjectIdNum,
  sortSprintsForDisplay,
  sprintProjectIdFromJson,
  sprintsOverviewVariants,
  taskDisplayName,
} from './index';

export default function SprintsPage({ projectId }) {
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
  const [projectName, setProjectName] = useState(() => localStorage.getItem('currentProjectName') || '');
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);

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
        const res = await fetch(`${API_BASE}/api/projects/${effectiveProjectIdNum}/developers`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setProjectDevelopers(Array.isArray(data) ? data : []);
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
        const res = await fetch(`${API_BASE}/api/projects/${effectiveProjectIdNum}`);
        if (!res.ok) return;
        const p = await res.json();
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

  const loadData = async () => {
    setLoading(true);
    try {
      const pid = resolveActiveProjectIdNum(projectId);
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
      const [sprintsRes, tasksRes, userTasksRes] = await Promise.all([
        fetchJsonNoStore(sprintsUrl),
        fetchJsonNoStore(tasksUrl),
        fetchJsonNoStore(userTasksUrl),
      ]);
      let sprintsData = await sprintsRes.json();
      const tasksData = await tasksRes.json();
      const userTasksData = await userTasksRes.json();
      const tasksList = Array.isArray(tasksData) ? tasksData : [];
      const userTasksList = Array.isArray(userTasksData) ? userTasksData : [];
      if (pid != null && Array.isArray(sprintsData)) {
        sprintsData = sprintsData.filter((s) => sprintProjectIdFromJson(s) === pid);
      }
      const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
      const sorted = sortSprintsForDisplay(sprintsList, tasksList);
      setSprints(sorted);
      setTasks(tasksList);
      setUserTasks(userTasksList);
      setSelectedSprint((prev) => {
        if (prev) {
          const stillThere = sorted.find((s) => s.id === prev.id);
          if (stillThere) return stillThere;
        }
        return pickDefaultSelectedSprint(sorted) ?? sorted[0];
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId, effectiveProjectIdNum]);

  const handleSprintCreated = (newSprint) => { setSprints((prev) => sortSprintsForDisplay([newSprint, ...prev], tasks)); setSelectedSprint(newSprint); };
  const handleDeleteSprint = async () => {
    if (!selectedSprint?.id) return;
    if (
      !window.confirm(
        `Delete Sprint ${selectedSprint.id} permanently? This action cannot be undone.`,
      )
    ) {
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
  const selectedSprintTasks = useMemo(
    () => (selectedSprint ? tasks.filter((t) => t.assignedSprint?.id === selectedSprint.id) : []),
    [tasks, selectedSprint],
  );
  const assignmentsByTaskId = useMemo(() => {
    return (Array.isArray(userTasks) ? userTasks : []).reduce((acc, ut) => {
      const tidRaw = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId;
      const tid = Number(tidRaw);
      if (!Number.isFinite(tid)) return acc;
      if (!acc[tid]) acc[tid] = [];
      acc[tid].push(ut);
      return acc;
    }, {});
  }, [userTasks]);
  const selectedSprintRows = useMemo(
    () =>
      selectedSprintTasks.map((task) => ({
        ...(function deriveTaskRowFields() {
          const taskAssignments = assignmentsByTaskId[Number(task.id)] || [];
          const names = [...new Set(
            taskAssignments
              .map((ut) => {
                const direct = String(
                  ut?.user?.name ?? ut?.user?.NAME ?? ut?.user?.fullName ?? ut?.user?.displayName ?? ''
                ).trim();
                if (direct) return direct;
                const uid = Number(ut?.user?.id ?? ut?.user?.ID ?? ut?.id?.userId ?? ut?.userId);
                if (Number.isFinite(uid)) {
                  const known = (projectDevelopers || []).find((u) => developerNumericId(u) === uid);
                  if (known?.name) return String(known.name).trim();
                  return `User ${uid}`;
                }
                return null;
              })
              .filter(Boolean),
          )];
          const workedHours = taskAssignments.reduce((sum, ut) => {
            const n = Number(ut?.workedHours ?? ut?.worked_hours ?? ut?.hours ?? 0);
            return sum + (Number.isFinite(n) ? n : 0);
          }, 0);
          return {
            developers: names,
            developer: names[0] ?? null,
            actualHours: workedHours > 0 ? workedHours : null,
          };
        })(),
        id: task.id,
        description: taskDisplayName(task),
        priority: task.priority ?? null,
        assignedHours: task.assignedHours ?? null,
        done: task.status === 'DONE',
        status: task.status,
        statusRaw: task.status,
        dueDate: task.dueDate,
        completedAt: task.finishDate,
      })),
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
  useEffect(() => {
    if (statusFilter === 'all') return;
    const exists = selectedSprintRows.some((r) => String(r.status || '').toUpperCase() === String(statusFilter).toUpperCase());
    if (!exists) setStatusFilter('all');
  }, [statusFilter, selectedSprintRows]);
  const hasTaskTableFilters = developerFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || Boolean(dueDateFilter);
  const clearTaskTableFilters = () => {
    setDeveloperFilter('all');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDueDateFilter('');
  };
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
        const rowStatus = String(row.status || '').toUpperCase();
        if (rowStatus !== String(statusFilter).toUpperCase()) return false;
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

  if (loading) return (<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress sx={{ color: ORACLE_RED }} /></Box>);

  const subtitleProjectName =
    projectName
    || (effectiveProjectIdNum === 1 ? 'Software Manager Tool' : null)
    || sprints[0]?.assignedProject?.name
    || 'Project';
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
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px', fontSize: { xs: '1.65rem', sm: '1.85rem' } }}>Sprints</Typography>
          <Typography variant="body1" sx={{ color: '#757575', mt: 0.75 }}>
            {subtitleProjectName}
            {subtitleProjectId != null && (
              <>
                {' '}
                · ID {subtitleProjectId}
              </>
            )}
            {' '}
            · {sprints.length} total sprints
          </Typography>
        </Box>
        <Box>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => selectedSprint && setSprintForEdit(selectedSprint)}
            disabled={!selectedSprint}
            size="small"
            sx={{ textTransform: 'none', borderColor: '#DDD', color: '#555', borderRadius: 2, mr: 1 }}
          >
            Edit sprint
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDeleteSprint}
            disabled={!selectedSprint}
            size="small"
            sx={{ textTransform: 'none', borderColor: '#E0B4AF', color: '#B64536', borderRadius: 2, mr: 1 }}
          >
            Delete sprint
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} size="small" sx={{ textTransform: 'none', borderColor: '#DDD', color: '#555', borderRadius: 2, mr: 1 }}>Sync</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} disabled={effectiveProjectIdNum == null} sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: ORACLE_RED_ACTION } }}>Create new sprint</Button>
        </Box>
      </Box>
      <Box component={motion.div} variants={sprintsOverviewVariants.block}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography sx={{ fontWeight: 800, color: '#333', mb: 1.5, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
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
                  />
                </Box>
              ))}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 800, color: '#333', fontSize: '1.02rem' }}>
                {selectedSprint ? `Tasks · Sprint ${selectedSprint.id}` : 'Tasks'}
              </Typography>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                <InputLabel id="overview-sprint-dev-filter">Developer</InputLabel>
                <Select
                  labelId="overview-sprint-dev-filter"
                  value={developerFilter}
                  label="Developer"
                  onChange={(e) => setDeveloperFilter(e.target.value)}
                >
                  <MenuItem value="all">All developers</MenuItem>
                  {developerFilterOptions.map((name) => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 170 } }}>
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
              <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 170 } }}>
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
                sx={{ minWidth: { xs: '100%', sm: 160 } }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<TaskAltIcon />}
                onClick={handleOpenNewTask}
                disabled={effectiveProjectIdNum == null}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  minHeight: 40,
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
                  onClick={clearTaskTableFilters}
                  sx={{ textTransform: 'none', fontWeight: 600, borderColor: ORACLE_RED_ACTION, color: ORACLE_RED_ACTION, minHeight: 40 }}
                >
                  Clear filters
                </Button>
              ) : null}
            </Stack>
            <TaskTable
              items={filteredSprintRows}
              variant="manager"
              onRowClick={(row) => {
                const task = selectedSprintTasks.find((t) => Number(t.id) === Number(row.id));
                if (task) setSelectedTaskForDialog(task);
              }}
              scrollMaxHeight={420}
            />
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
            const byId = new Map((projectDevelopers || []).map((u) => [Number(developerNumericId(u)), u]));
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
          setSprints((prev) => sortSprintsForDisplay(prev.map((s) => (s.id === updated.id ? updated : s)), tasks));
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
        onSaved={(updated) => {
          setTasks((prev) => {
            const next = prev.map((x) => (x.id === updated.id ? updated : x));
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
          setSelectedTaskForDialog(null);
        }}
        onDeleted={(taskId) => {
          setTasks((prev) => {
            const next = prev.filter((x) => x.id !== taskId);
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
          setSelectedTaskForDialog(null);
        }}
      />

    </Box>
  );
}
