import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Box, Grid, Typography, Paper, Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem, TextField, Stack, Button, Dialog, DialogTitle, DialogContent, IconButton, DialogActions, OutlinedInput, Checkbox, Alert } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import KanbanBoard from '../components/tasks/KanbanBoard';
import { matchesDueDateRange } from '../components/dashboard/taskFilters';
import { developerAvatarColors } from '../utils/developerColors';
import { developerNumericId, finiteUserIds, multiselectNumericIds } from '../utils/userIds';

const ORACLE_RED = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
const pageEase = [0.22, 1, 0.36, 1];

function resolveActiveProjectId(projectIdProp) {
  const trim = (v) => (v == null ? '' : String(v).trim());
  const fromProp = trim(projectIdProp);
  const fromLs =
    typeof localStorage !== 'undefined' ? trim(localStorage.getItem('currentProjectId')) : '';
  const raw = fromProp !== '' ? fromProp : fromLs;
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Project id on sprint JSON (nested or flat — Oracle/JPA shapes differ). */
function sprintProjectIdFromJson(s) {
  const raw = s?.assignedProject?.id ?? s?.assignedProject?.ID ?? s?.assignedProjectId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** USER_TASK row finished: COMPLETED (canonical) or DONE (legacy rows). */
function isUserTaskAssigneeComplete(ut) {
  const u = String(ut?.status || '').trim().toUpperCase();
  return u === 'COMPLETED' || u === 'DONE';
}

/** Create-task dialog fields: Oracle red focus + grays (aligned with Tasks page). */
function pageFormFieldOutline() {
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.35)' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.55)' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: ORACLE_RED },
    '& .MuiInputLabel-root': { color: '#616161' },
    '& .MuiInputLabel-root.Mui-focused': { color: ORACLE_RED },
    '& .MuiSelect-select': { color: '#1A1A1A' },
    '& .MuiSelect-icon': { color: '#616161' },
  };
}

function createTaskSelectFillSx() {
  return {
    ...pageFormFieldOutline(),
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgba(199, 70, 52, 0.08)' },
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

function NewTaskDialog({ open, onClose, onCreated, sprints, projectDevelopers, defaultSprintId, pickerProjectId }) {
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
  /** null = not loaded for this open session; avoids empty list while parent list is still loading. */
  const [fetchedDevelopers, setFetchedDevelopers] = useState(null);
  const [developersLoading, setDevelopersLoading] = useState(false);

  const resetForm = () => { 
    setTitle(''); setDescription(''); setClassification('FEATURE'); setStatus('TODO'); 
    setPriority('MEDIUM'); setAssignedHours(''); setStartDate(''); setDueDate(''); 
    setAssignedToIds([]); setSprintId(''); setError(''); setFetchedDevelopers(null); 
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

  useEffect(() => {
    if (!open) {
      setFetchedDevelopers(null);
      setDevelopersLoading(false);
      return;
    }
    const pid = pickerProjectId != null && Number.isFinite(Number(pickerProjectId)) ? Number(pickerProjectId) : null;
    console.log('NewTaskDialog project fetch', { open, pickerProjectId, pid });
    if (pid == null) {
      setFetchedDevelopers([]);
      setDevelopersLoading(false);
      return;
    }
    let cancelled = false;
    setDevelopersLoading(true);
    (async () => {
      try {
        const url = `${API_BASE}/api/projects/${pid}/developers`;
        console.log('Fetching developers URL:', url);
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        const data = res.ok ? await res.json() : [];
        console.log('Developers response', { status: res.status, ok: res.ok, data });
        if (!cancelled) {
          setFetchedDevelopers(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed fetching developers:', error);
        if (!cancelled) setFetchedDevelopers([]);
      } finally {
        if (!cancelled) setDevelopersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pickerProjectId]);

  const availableDevelopers = useMemo(() => {
    if (Array.isArray(fetchedDevelopers) && fetchedDevelopers.length > 0) return fetchedDevelopers;
    return Array.isArray(projectDevelopers) ? projectDevelopers : [];
  }, [fetchedDevelopers, projectDevelopers]);

  const normalizedAvailableDevelopers = useMemo(() => {
    return (availableDevelopers || []).map((u, index) => {
      const uid = developerNumericId(u);
      const displayName = u?.name ?? u?.NAME ?? u?.email ?? u?.phoneNumber ?? `Developer ${index + 1}`;
      return { ...u, uid, displayName };
    });
  }, [availableDevelopers]);

  const validAvailableDevelopers = useMemo(() => {
    return normalizedAvailableDevelopers.filter((u) => u.uid != null && Number.isFinite(u.uid));
  }, [normalizedAvailableDevelopers]);

  useEffect(() => {
    console.groupCollapsed('NewTaskDialog developers debug');
    console.log('availableDevelopers raw:', availableDevelopers);
    console.log('normalizedAvailableDevelopers:', normalizedAvailableDevelopers);
    console.log('validAvailableDevelopers:', validAvailableDevelopers.map((u) => ({ uid: u.uid, displayName: u.displayName })));
    console.groupEnd();

    if (normalizedAvailableDevelopers.length > 0 && validAvailableDevelopers.length === 0) {
      console.warn('NewTaskDialog has developers but no valid numeric IDs', normalizedAvailableDevelopers);
    }
    setAssignedToIds((prev) => {
      const allowed = new Set(validAvailableDevelopers.map((u) => u.uid));
      return finiteUserIds(prev).filter((id) => allowed.has(id));
    });
  }, [availableDevelopers, normalizedAvailableDevelopers, validAvailableDevelopers]);

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
    // 1. Crear la tarea
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
      const createdTask = await res.json();
      console.log('Task created:', createdTask);
      
      // 2. Crear asignaciones USER_TASK para cada developer
      const assignmentPromises = assignedToIds.map(async (uid) => {
        const assignRes = await fetch(`${API_BASE}/api/user-tasks`, { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ 
            userId: Number(uid), 
            taskId: createdTask.id, 
            status: status,
            workedHours: 0
          }) 
        });
        if (!assignRes.ok) {
          const errorText = await assignRes.text();
          console.error('Assignment failed for user', uid, errorText);
          throw new Error(`Assignment failed for user ${uid}`);
        }
        return assignRes.json();
      });
      
      await Promise.all(assignmentPromises);
      console.log('All assignments created successfully');
      
      onCreated(createdTask, assignedToIds, status, null);
      handleClose();
    } else { 
      const errorText = await res.text();
      console.error('Task creation failed:', errorText);
      setError('Could not create task: ' + errorText); 
    }
  } catch (err) { 
    console.error('Error:', err);
    setError('Connection error: ' + err.message); 
  } finally { 
    setSaving(false); 
  }
};
  
  const canSave = Boolean(title.trim() && description.trim() && classification && status && priority && startDate && dueDate && sprintId && finiteUserIds(assignedToIds).length > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ 
      elevation: 0, 
      sx: { 
        borderRadius: 3, 
        border: '1px solid #ECECEC', 
        borderLeft: `4px solid ${ORACLE_RED}`, 
        bgcolor: '#FFFFFF', 
        boxShadow: '0 16px 40px rgba(199, 70, 52, 0.12)', 
        height: { xs: 'auto', sm: '88vh' },
        maxHeight: 'calc(100vh - 24px)', 
        overflow: 'hidden', 
        maxWidth: { xs: 'calc(100% - 32px)', sm: 980 } 
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
      <DialogContent sx={{ pt: 3.5, px: { xs: 3.5, sm: 5 }, pb: 3.25, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <Stack spacing={2.25} sx={{ mx: { xs: 0.75, sm: 1.25 }, my: { xs: 0.5, sm: 0.75 } }}>
          <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth multiline minRows={2} sx={{ ...pageFormFieldOutline(), '& .MuiOutlinedInput-root': { bgcolor: 'rgba(199, 70, 52, 0.07)' } }} />
          <TextField label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={5} sx={pageFormFieldOutline()} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
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
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
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
            <FormControl size="small" fullWidth sx={createTaskSelectFillSx()}>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {sprints.map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} sx={pageFormFieldOutline()} />
          </Stack>
          {pickerProjectId == null || !Number.isFinite(Number(pickerProjectId)) ? (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              No se pudo determinar el proyecto activo. Vuelve a elegir un proyecto en la app (Change project) y abre de nuevo esta ventana.
            </Alert>
          ) : null}
          {developersLoading ? (
            <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600 }}>
              Cargando equipo del proyecto…
            </Typography>
          ) : null}
          {!developersLoading && pickerProjectId != null && Number.isFinite(Number(pickerProjectId)) && validAvailableDevelopers.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              No hay desarrolladores asignables en este proyecto (equipo vacío o solo managers). Revisa el equipo en base de datos o el endpoint{' '}
              <Typography component="span" variant="caption" sx={{ fontWeight: 700 }}>{`/api/projects/${pickerProjectId}/developers`}</Typography>.
            </Alert>
          ) : null}
          <FormControl fullWidth size="small" sx={pageFormFieldOutline()}>
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={finiteUserIds(assignedToIds)}
              onChange={(e) => setAssignedToIds(multiselectNumericIds(e.target.value))}
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
                  {finiteUserIds(selected).map((id) => {
                    const u = normalizedAvailableDevelopers.find((x) => x.uid === id);
                    const name = u?.displayName ?? `#${id}`;
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
              {validAvailableDevelopers.map((u) => {
                const uid = u.uid;
                const selectedIds = finiteUserIds(assignedToIds);
                return (
                  <MenuItem key={uid} value={uid}>
                    <Checkbox checked={selectedIds.includes(uid)} size="small" sx={{ py: 0 }} />
                    <Typography variant="body2" sx={{ color: '#1A1A1A' }}>
                      {u.displayName}
                    </Typography>
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
  const effectiveProjectId = resolveActiveProjectId(projectId);
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
        const taskIds = new Set((Array.isArray(tasksData) ? tasksData : []).map((t) => Number(t.id)));
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

  /** Resolved sprint for Kanban: selected value, or first sprint by id, or none. */
  const kanbanSprintId = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return '';
    const ids = sprints.map((s) => String(s.id));
    if (selectedSprintId !== '' && selectedSprintId != null && ids.includes(String(selectedSprintId))) {
      return String(selectedSprintId);
    }
    const active = sprints.find((s) => inferSprintIsActive(s));
    if (active?.id != null) return String(active.id);
    const sorted = [...sprints].sort((a, b) => Number(a.id) - Number(b.id));
    return String(sorted[0]?.id ?? '');
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
      }
    };
    
    try {
      if (assignees.length === 0) { await putTask(); return; }
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

  const resolveUserTaskDeveloperName = useCallback((ut) => {
    if (!ut) return null;
    const user = ut.user;
    const numericUserId = developerNumericId(ut?.id?.userId) ?? developerNumericId(ut?.userId) ?? developerNumericId(ut?.user?.ID) ?? developerNumericId(user);
    if (numericUserId != null && Number.isFinite(numericUserId)) {
      const known = users.find((u) => developerNumericId(u) === numericUserId)
        || projectDevelopers.find((u) => developerNumericId(u) === numericUserId);
      if (known) return String(known.name ?? known.displayName ?? known.email ?? `User ${numericUserId}`);
      return `User ${numericUserId}`;
    }
    const directName = String(
      user?.name ?? user?.NAME ?? user?.fullName ?? user?.displayName ?? user?.email ?? user?.username ?? user?.userName ?? ''
    ).trim();
    if (directName) return directName;
    return null;
  }, [users, projectDevelopers]);

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
    () => rawTasks.map((task) => mapTaskToKanban(task, developersByTaskId.get(String(task.id)) ?? [])),
    [rawTasks, developersByTaskId],
  );

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
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>Kanban Board</Typography>
            <Chip label={`${pendingCount} pending`} size="small" sx={{ mt: 1, bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700 }} />
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
                {(projectId
                    ? sprints.filter(s => s.assignedProject?.id == projectId)
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
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1rem' }}>Filter tasks</Typography>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'flex-end' }}>
          <FormControl size="small" sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}>
            <InputLabel>Developer</InputLabel>
            <Select value={developerFilter} onChange={e => setDeveloperFilter(e.target.value)} label="Developer">
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
          <FormControl size="small" sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} label="Priority">
              <MenuItem value="all">All priorities</MenuItem>
              <MenuItem value="LOW">Low</MenuItem>
              <MenuItem value="MEDIUM">Medium</MenuItem>
              <MenuItem value="HIGH">High</MenuItem>
              <MenuItem value="CRITICAL">Critical</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" type="date" label="Due from" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }} />
          <TextField size="small" type="date" label="Due to" value={dueTo} onChange={(e) => setDueTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ flex: '1 1 130px', minWidth: { xs: '100%', sm: 130 }, maxWidth: { sm: 180 } }} />
          {hasActiveFilters && <Button size="small" variant="outlined" onClick={clearAllFilters} sx={{ textTransform: 'none', fontWeight: 600, borderColor: ORACLE_RED, color: ORACLE_RED, flexShrink: 0, minHeight: 34, py: 0.25 }}>Clear filters</Button>}
          <Chip label={`${filteredItems.length} shown`} size="small" sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 22 }} />
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
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A1A1A' }}>Tasks</Typography>
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
      onCreated={(task, assignedUserIds, assignmentStatus) => {
        console.log('Task created:', task);
        console.log('Assigned user IDs:', assignedUserIds);
        // Recargar todos los datos para que las asignaciones aparezcan
        loadData();
      }}
      sprints={sprintsForActiveProject}
      projectDevelopers={projectDevelopers}
      defaultSprintId={selectedSprintId}
      pickerProjectId={effectiveProjectId}
    />
    </Box>
  );
}