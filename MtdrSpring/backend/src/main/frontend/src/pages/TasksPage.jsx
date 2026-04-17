import React, { useMemo, useState, useEffect } from 'react';
import { Box, Grid, Typography, Paper, Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, Stack, Button, Dialog, DialogTitle, DialogContent, IconButton, DialogActions, OutlinedInput, Checkbox, ListItemText, Alert } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import KanbanBoard from '../components/tasks/KanbanBoard';
import { matchesDueDateRange } from '../components/dashboard/taskFilters';
import { developerAvatarColors } from '../utils/developerColors';

const ORACLE_RED = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

/** USER_TASK row finished: COMPLETED (canonical) or DONE (legacy rows). */
function isUserTaskAssigneeComplete(ut) {
  const u = String(ut?.status || '').trim().toUpperCase();
  return u === 'COMPLETED' || u === 'DONE';
}

/** Create-task dialog fields: Oracle red focus + grays (aligned with Tasks page). */
function pageFormFieldOutline() {
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.35)' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.55)' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: ORACLE_RED },
    '& .MuiInputLabel-root': { color: '#616161' },
    '& .MuiInputLabel-root.Mui-focused': { color: ORACLE_RED },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiSelect-select': { color: '#1A1A1A' },
    '& .MuiSelect-icon': { color: '#616161' },
  };
}

function mapTaskToKanban(task, developerNames = []) {
  const statusMap = { 'DONE': 'done', 'IN_PROGRESS': 'in_progress', 'IN_REVIEW': 'in_review', 'TODO': 'todo' };
  const list = Array.isArray(developerNames) ? [...new Set(developerNames.filter(Boolean))] : (developerNames ? [developerNames] : []);
  return { 
    id: task.id, 
    description: task.title || `Task #${task.id}`, 
    details: task.description || task.classification || '', 
    classification: task.classification ?? '', 
    priority: task.priority ?? 'MEDIUM', 
    done: task.status === 'DONE', 
    status: statusMap[task.status] ?? 'todo', 
    rawStatus: task.status, 
    actualHours: task.assignedHours ?? null, 
    developers: list, 
    developer: list[0] ?? null, 
    dueDate: task.dueDate, 
    sprintId: task.assignedSprint?.id ?? null, 
    _raw: task 
  };
}

function inferSprintIsActive(sprint) {
  const now = Date.now();
  const start = new Date(sprint?.startDate).getTime();
  const due = new Date(sprint?.dueDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due)) return false;
  return start <= now && now <= due;
}

function NewTaskDialog({ open, onClose, onCreated, sprints, projectDevelopers, defaultSprintId }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('FEATURE');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assignedToIds, setAssignedToIds] = useState([]);
  const [sprintId, setSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => { 
    setTitle(''); setDescription(''); setClassification('FEATURE'); setStatus('TODO'); 
    setPriority('MEDIUM'); setAssignedHours(''); setStartDate(''); setDueDate(''); 
    setAssignedToIds([]); setSprintId(''); setError(''); 
  };

  useEffect(() => {
    if (!open) return;
    const fallbackSprintId = defaultSprintId != null ? String(defaultSprintId) : '';
    const isValidDefault = sprints.some((s) => String(s.id) === fallbackSprintId);
    setSprintId(isValidDefault ? fallbackSprintId : '');
  }, [open, defaultSprintId, sprints]);

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const availableDevelopers = useMemo(
    () => (Array.isArray(projectDevelopers) ? projectDevelopers : []),
    [projectDevelopers],
  );

  useEffect(() => {
    setAssignedToIds((prev) => {
      const allowed = new Set(
        (availableDevelopers || [])
          .map((u) => Number(u?.id ?? u?.ID))
          .filter((id) => Number.isFinite(id)),
      );
      return prev.filter((id) => allowed.has(Number(id)));
    });
  }, [availableDevelopers]);

  const handleSave = async () => {
    const hasSprintPick = sprintId !== '' && sprintId != null;
    if (!title.trim() || !description.trim() || !classification || !status || !priority || !startDate || !dueDate || !hasSprintPick || assignedToIds.length === 0) { 
      setError('Please fill in all required fields (including at least one developer).'); 
      return; 
    }
    if (new Date(startDate) > new Date(dueDate)) { 
      setError('Start date must be on or before due date.'); 
      return; 
    }
    setSaving(true); 
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: title.trim(), 
          description: description.trim(), 
          classification, 
          status, 
          priority, 
          assignedHours: assignedHours ? Number(assignedHours) : null, 
          startDate: new Date(startDate).toISOString(), 
          dueDate: new Date(dueDate).toISOString(), 
          finishDate: new Date(dueDate).toISOString(), 
          assignedSprint: { id: Number(sprintId) } 
        }),
      });
      if (res.ok) {
        const created = await res.json();
        for (const uid of assignedToIds) { 
          await fetch(`${API_BASE}/api/user-tasks`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ userId: Number(uid), taskId: created.id, status }) 
          }); 
        }
        onCreated(created, assignedToIds, status, null);
        handleClose();
      } else { 
        setError('Could not create task.'); 
      }
    } catch { 
      setError('Connection error.'); 
    } finally { 
      setSaving(false); 
    }
  };
  
  const canSave = Boolean(title.trim() && description.trim() && classification && status && priority && startDate && dueDate && sprintId && assignedToIds.length > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ 
      elevation: 0, 
      sx: { 
        borderRadius: 3, 
        border: '1px solid #ECECEC', 
        borderLeft: `4px solid ${ORACLE_RED}`, 
        bgcolor: '#FFFFFF', 
        boxShadow: '0 16px 40px rgba(199, 70, 52, 0.12)', 
        maxHeight: 'calc(100vh - 48px)', 
        overflow: 'hidden', 
        maxWidth: { xs: 'calc(100% - 24px)', sm: 820 } 
      } 
    }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, borderBottom: '1px solid rgba(199, 70, 52, 0.12)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(199,70,52,0.10)', border: '1px solid rgba(199, 70, 52, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A1A1A' }}>Create task</Typography>
              <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Details, planning & assignees</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={saving}><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5, px: { xs: 2.5, sm: 3 }, pb: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Stack spacing={2}>
          <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth multiline minRows={2} sx={{ ...pageFormFieldOutline(), '& .MuiOutlinedInput-root': { bgcolor: 'rgba(199, 70, 52, 0.07)' } }} />
          <TextField label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={5} sx={pageFormFieldOutline()} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={pageFormFieldOutline()}>
              <InputLabel>Work item type</InputLabel>
              <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={pageFormFieldOutline()}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={pageFormFieldOutline()}>
              <InputLabel>Priority</InputLabel>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={pageFormFieldOutline()}>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {sprints.map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} sx={pageFormFieldOutline()} />
          </Stack>
          <FormControl fullWidth size="small" sx={pageFormFieldOutline()}>
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={assignedToIds}
              onChange={(e) => setAssignedToIds(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value.map(Number))}
              input={<OutlinedInput label="Developers" />}
              renderValue={(selected) => (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    maxHeight: 80,
                    overflowY: 'auto',
                    py: 0.25,
                    width: '100%',
                  }}
                >
                  {selected.map((id) => {
                    const u = availableDevelopers.find((x) => Number(x.id ?? x.ID) === Number(id));
                    const name = u?.name ?? `#${id}`;
                    const av = developerAvatarColors(name);
                    return (
                      <Chip
                        key={id}
                        size="small"
                        label={name}
                        variant="outlined"
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'transparent',
                          color: av.color,
                          borderColor: av.color,
                          borderWidth: 1,
                        }}
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
            >
              {availableDevelopers.map((u) => {
                const uid = Number(u.id ?? u.ID);
                return (
                  <MenuItem key={uid} value={uid}>
                    <Checkbox checked={assignedToIds.includes(uid)} size="small" sx={{ py: 0 }} />
                    <ListItemText primary={u.name} primaryTypographyProps={{ variant: 'body2' }} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={pageFormFieldOutline()} />
            <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={pageFormFieldOutline()} />
          </Stack>
          {error && <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.25, pt: 1.5, borderTop: '1px solid rgba(199, 70, 52, 0.12)' }}>
        <Button onClick={handleClose} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating...' : 'Create task'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TasksPage({ projectId }) {
  const [rawTasks, setRawTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
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

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Obtener sprints filtrados por projectId
      const sprintsUrl = projectId ? `${API_BASE}/api/sprints?projectId=${projectId}` : `${API_BASE}/api/sprints`;
      const [tasksRes, sprintsRes, usersRes, userTasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks`),
        fetch(sprintsUrl),
        fetch(`${API_BASE}/users`),
        fetch(`${API_BASE}/api/user-tasks`)
      ]);
      
      let tasksData = await tasksRes.json();
      let sprintsData = await sprintsRes.json();
      
      // Filtrar sprints por projectId (por si acaso)
      if (projectId) {
        sprintsData = sprintsData.filter(s => s.assignedProject?.id == projectId);
        // Filtrar tareas que pertenecen a estos sprints
        const sprintIds = new Set(sprintsData.map(s => Number(s.id)));
        tasksData = tasksData.filter(t => t.assignedSprint?.id != null && sprintIds.has(Number(t.assignedSprint.id)));
      }
      
      setRawTasks(Array.isArray(tasksData) ? tasksData : []);
      setSprints(Array.isArray(sprintsData) ? sprintsData : []);
      setUsers(await usersRes.json());
      setUserTasks(await userTasksRes.json());
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
  }, [projectId]);

  /** Resolved sprint for Kanban: selected value, or first sprint by id, or none. */
  const kanbanSprintId = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return '';
    const ids = sprints.map((s) => String(s.id));
    if (selectedSprintId && ids.includes(String(selectedSprintId))) {
      return String(selectedSprintId);
    }
    const active = sprints.find((s) => inferSprintIsActive(s));
    if (active?.id != null) return String(active.id);
    const sorted = [...sprints].sort((a, b) => Number(a.id) - Number(b.id));
    return String(sorted[0]?.id ?? '');
  }, [selectedSprintId, sprints]);

  const selectedProjectId = useMemo(() => {
    if (!kanbanSprintId) return null;
    const sprint = (sprints || []).find((s) => String(s.id) === String(kanbanSprintId));
    const pid = Number(sprint?.assignedProject?.id);
    return Number.isFinite(pid) ? pid : null;
  }, [kanbanSprintId, sprints]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedProjectId) {
      setProjectDevelopers([]);
      return () => { cancelled = true; };
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
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  const developerFilterOptions = useMemo(
    () => (Array.isArray(projectDevelopers) ? projectDevelopers : []),
    [projectDevelopers],
  );

  const sprintsForActiveProject = useMemo(() => {
    if (!selectedProjectId) return [];
    return (sprints || []).filter((s) => Number(s?.assignedProject?.id) === Number(selectedProjectId));
  }, [sprints, selectedProjectId]);

  useEffect(() => {
    if (developerFilter === 'all') return;
    const stillExists = developerFilterOptions.some((u) => u?.name === developerFilter);
    if (!stillExists) setDeveloperFilter('all');
  }, [developerFilter, developerFilterOptions]);

  const handleStatusChange = async (taskId, newStatus) => {
    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) return;
    const assignees = userTasks.filter((ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(taskId));
    const ns = String(newStatus || '').toUpperCase();
    
    const putTask = async () => {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ ...task, status: newStatus }) 
      });
      if (res.ok) { 
        const updated = await res.json(); 
        setRawTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t))); 
        await loadData(); 
      }
    };
    
    try {
      if (assignees.length === 0) { await putTask(); return; }
      if (assignees.length === 1) {
        if (ns === 'DONE') {
          const ut = assignees[0];
          const uid = Number(ut.user?.id ?? ut.user?.ID);
          const res = await fetch(`${API_BASE}/api/user-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: uid,
              taskId: Number(taskId),
              status: 'COMPLETED',
            }),
          });
          await loadData();
        } else { await putTask(); }
        return;
      }
      if (ns === 'DONE') {
        const allDone = assignees.every((ut) => isUserTaskAssigneeComplete(ut));
        if (allDone) { await putTask(); } else { setMultiDoneTaskId(taskId); }
        return;
      }
      await putTask();
    } catch (e) { console.error('Error updating task status:', e); }
  };

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

  const developersByTaskId = useMemo(() => {
    const map = new Map();
    userTasks.forEach((ut) => { 
      const taskId = ut?.task?.id ?? ut?.id?.taskId; 
      const devName = ut?.user?.name; 
      if (taskId && devName) { 
        const existing = map.get(taskId); 
        if (!existing) map.set(taskId, [devName]); 
        else if (!existing.includes(devName)) existing.push(devName); 
      } 
    });
    return map;
  }, [userTasks]);

  const items = useMemo(() => rawTasks.map((task) => mapTaskToKanban(task, developersByTaskId.get(task.id) ?? [])), [rawTasks, developersByTaskId]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!kanbanSprintId || String(item.sprintId) !== String(kanbanSprintId)) return false;
      if (developerFilter !== 'all') {
        const names = item.developers?.length ? item.developers : (item.developer ? [item.developer] : []);
        if (!names.some((n) => String(n) === String(developerFilter))) return false;
      }
      if (priorityFilter !== 'all' && String(item.priority ?? '').toUpperCase() !== String(priorityFilter).toUpperCase()) return false;
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
    developerFilter !== 'all'
    || priorityFilter !== 'all'
    || Boolean(dueFrom)
    || Boolean(dueTo);

  const clearAllFilters = () => {
    setDeveloperFilter('all');
    setPriorityFilter('all');
    setDueFrom('');
    setDueTo('');
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: ORACLE_RED }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>Tasks</Typography>
            <Chip label={`${pendingCount} pending`} size="small" sx={{ mt: 1.5, bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700 }} />
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ minWidth: { xs: '100%', sm: 'auto' } }}>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 180 }, ...pageFormFieldOutline() }}>
              <InputLabel id="tasks-header-sprint-select-label">Sprint</InputLabel>
              <Select
                labelId="tasks-header-sprint-select-label"
                value={kanbanSprintId || ''}
                label="Sprint"
                onChange={(e) => setSelectedSprintId(String(e.target.value))}
                disabled={!sprints.length}
              >
                {sprints.map((s) => (
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
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
              sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>
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

      <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FAFAFA' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterListIcon sx={{ fontSize: 26, color: ORACLE_RED }} />
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.2rem' }}>Filter tasks</Typography>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }}>
            <InputLabel>Developer</InputLabel>
            <Select value={developerFilter} onChange={e => setDeveloperFilter(e.target.value)} label="Developer">
              <MenuItem value="all">All developers</MenuItem>
              {developerFilterOptions.map((u) => (
                <MenuItem key={u.id ?? u.ID} value={u.name}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} label="Priority">
              <MenuItem value="all">All priorities</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="CRITICAL">Critical</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="Due from" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }} />
          <TextField size="small" type="date" label="Due to" value={dueTo} onChange={(e) => setDueTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }} />
          {hasActiveFilters && <Button size="small" variant="outlined" onClick={clearAllFilters} sx={{ textTransform: 'none', fontWeight: 600, borderColor: ORACLE_RED, color: ORACLE_RED, flexShrink: 0 }}>Clear filters</Button>}
          <Chip label={`${filteredItems.length} shown`} size="small" sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 24 }} />
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <Box sx={{ width: 10, height: 10, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A1A1A' }}>Kanban board</Typography>
            <Chip label={filteredItems.length} size="small" sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700 }} />
          </Box>
          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
            <KanbanBoard items={filteredItems} onStatusChange={handleStatusChange} onDeleteTask={handleDeleteTask} />
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={multiDoneTaskId != null} onClose={() => setMultiDoneTaskId(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Complete each assignment</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>The task moves to Done only when every developer assigned has been marked complete.</Alert>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600 }}>{multiDoneTaskId != null ? (rawTasks.find((t) => t.id === multiDoneTaskId)?.title || `Task #${multiDoneTaskId}`) : ''}</Typography>
          <Stack spacing={1.5}>
            {multiDoneTaskId != null
              ? userTasks
                .filter((ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId))
                .map((ut) => {
                  const done = isUserTaskAssigneeComplete(ut);
                  const name = ut.user?.name || `User ${ut.user?.id ?? ut.user?.ID ?? '?'}`;
                  return (
                    <Box
                      key={`${ut.user?.id ?? ut.user?.ID}-${multiDoneTaskId}`}
                      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}
                    >
                      <Typography variant="body2">{name}</Typography>
                      {done ? (
                        <Chip label="Done" size="small" sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700 }} />
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
        <DialogActions sx={{ px: 2.5, pb: 2 }}><Button onClick={() => setMultiDoneTaskId(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button></DialogActions>
      </Dialog>

      <NewTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(task, assignedUserIds, assignmentStatus, workedHours) => {
          const ids = Array.isArray(assignedUserIds) ? assignedUserIds : [];
          setRawTasks((prev) => [...prev, task]);
          setUserTasks((prev) => [
            ...prev,
            ...ids.map((assignedUserId) => {
              const user = users.find((u) => Number(u.id ?? u.ID) === Number(assignedUserId));
              return {
                id: { userId: assignedUserId, taskId: task.id },
                user: user ?? null,
                task,
                status: assignmentStatus,
                workedHours,
              };
            }),
          ]);
        }}
        sprints={sprintsForActiveProject}
        projectDevelopers={projectDevelopers}
        defaultSprintId={kanbanSprintId}
      />
    </Box>
  );
}