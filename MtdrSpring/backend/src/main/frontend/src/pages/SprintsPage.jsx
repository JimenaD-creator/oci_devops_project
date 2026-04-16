import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, IconButton, Divider, Paper,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import RefreshIcon from '@mui/icons-material/Refresh';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { developerAvatarColors } from '../utils/developerColors';
import TaskTable from '../components/dashboard/TaskTable';

const ORACLE_RED = '#E53935';
const ORACLE_RED_ACTION = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const PLANNING_CARD_SX = {
  p: 2.25,
  borderRadius: 2,
  bgcolor: '#FFFFFF',
  border: '1px solid rgba(21, 101, 192, 0.22)',
  borderTop: `3px solid ${ORACLE_RED_ACTION}`,
  boxShadow: '0 2px 10px rgba(21, 101, 192, 0.06)',
};

function newSprintDialogFieldOutline() {
  const accent = ORACLE_RED_ACTION;
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.35)' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(199, 70, 52, 0.55)' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: accent },
    '& .MuiInputLabel-root': { color: '#616161' },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiSelect-icon': { color: '#616161' },
  };
}

const CLASSIFICATION_CHIP_SX = {
  FEATURE: { bgcolor: '#E8F5E9', color: '#2E7D32' },
  BUG: { bgcolor: '#FFEBEE', color: '#C62828' },
  TASK: { bgcolor: '#E8EAF6', color: '#3949AB' },
  USER_STORY: { bgcolor: '#F3E5F5', color: '#6A1B9A' },
};

const PRIORITY_CHIP_SX = {
  LOW: { bgcolor: '#ECEFF1', color: '#455A64' },
  MEDIUM: { bgcolor: '#FFF8E1', color: '#F57F17' },
  HIGH: { bgcolor: '#FFF3E0', color: '#E65100' },
  CRITICAL: { bgcolor: '#FFEBEE', color: '#B71C1C' },
};

const STATUS_CHIP_SX = {
  TODO: { bgcolor: '#ECEFF1', color: '#455A64' },
  IN_PROGRESS: { bgcolor: '#E3F2FD', color: '#1565C0' },
  IN_REVIEW: { bgcolor: '#F3E5F5', color: '#6A1B9A' },
  PENDING: { bgcolor: '#FFF8E1', color: '#F57F17' },
  DONE: { bgcolor: '#E8F5E9', color: '#1B5E20' },
};

const STATUS_CONFIG = {
  active:    { label: 'In progress', color: '#E8F5E9', textColor: '#2E7D32' },
  completed: { label: 'Completed',   color: '#EEF2FF', textColor: '#3730A3' },
  planned:   { label: 'Planned',     color: '#FFF8E1', textColor: '#F57F17' },
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toInputDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function inferStatusByDate(sprint) {
  const now = new Date();
  const start = new Date(sprint.startDate);
  const due = new Date(sprint.dueDate);
  if (now < start) return 'planned';
  if (now > due) return 'completed';
  return 'active';
}

function inferSprintStatus(sprint, allTasks) {
  const list = Array.isArray(allTasks) ? allTasks : [];
  const sprintTasks = list.filter((t) => t.assignedSprint?.id === sprint.id);
  if (sprintTasks.length === 0) return inferStatusByDate(sprint);
  const done = sprintTasks.filter((t) => t.status === 'DONE').length;
  if (done === sprintTasks.length) return 'completed';
  if (done > 0) return 'active';
  return 'planned';
}

function sortSprintsForDisplay(list, allTasks) {
  const rank = (s) => {
    const st = inferSprintStatus(s, allTasks);
    if (st === 'active') return 0;
    if (st === 'planned') return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return b.id - a.id;
  });
}

function taskDisplayName(task) {
  const t = typeof task.title === 'string' ? task.title.trim() : '';
  if (t) return t;
  const c = typeof task.classification === 'string' ? task.classification.trim() : '';
  return c || '—';
}

const TASK_STATUS_LABEL = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  PENDING: 'Pending',
  DONE: 'Done',
};

function userRecordId(u) {
  return u?.id ?? u?.ID;
}

function TaskDetailDialog({ open, initialTask, sprints, onClose, onSaved, onDeleted }) {
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadedAssigneeUserIds, setLoadedAssigneeUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState('FEATURE');
  const [status, setStatus] = useState('TODO');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState([]);

  const loadProjectDevelopersForSprint = async (sid, taskFallback = null) => {
    const sprintFromList = (sprints || []).find((s) => String(s.id) === String(sid));
    const projectId = Number(
      sprintFromList?.assignedProject?.id
      ?? taskFallback?.assignedSprint?.assignedProject?.id,
    );
    if (!Number.isFinite(projectId)) {
      setUsers([]);
      return;
    }
    try {
      const usersRes = await fetch(`${API_BASE}/api/projects/${projectId}/developers`);
      const usersData = usersRes.ok ? await usersRes.json() : [];
      setUsers(Array.isArray(usersData) ? usersData : []);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    if (!open) {
      setTask(null);
      setUsers([]);
      setLoadedAssigneeUserIds([]);
      setEditMode(false);
      setError('');
      return;
    }
    if (!initialTask?.id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const taskRes = await fetch(`${API_BASE}/api/tasks/${initialTask.id}`);
        const t = taskRes.ok ? await taskRes.json() : null;
        if (cancelled || !t) return;
        setTask(t);
        await loadProjectDevelopersForSprint(t.assignedSprint?.id, t);

        const utRes = await fetch(`${API_BASE}/api/user-tasks/task/${t.id}`);
        const utList = utRes.ok ? await utRes.json() : [];
        if (cancelled) return;
        const ids = Array.isArray(utList)
          ? [...new Set(utList.map((row) => row?.user?.id ?? row?.user?.ID).filter((id) => id != null).map((id) => Number(id)))]
          : [];
        setLoadedAssigneeUserIds(ids);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, initialTask?.id]);

  useEffect(() => {
    if (!open || !editMode || !sprintId) return;
    loadProjectDevelopersForSprint(sprintId, task);
  }, [open, editMode, sprintId, sprints, task]);

  useEffect(() => {
    if (!editMode) return;
    setAssignedUserIds((prev) => {
      const allowed = new Set(
        users
          .map((u) => Number(userRecordId(u)))
          .filter((id) => Number.isFinite(id)),
      );
      return prev.filter((id) => allowed.has(Number(id)));
    });
  }, [users, editMode]);

  const applyTaskToForm = (t) => {
    if (!t) return;
    setTitle(typeof t.title === 'string' ? t.title : '');
    setDescription(typeof t.description === 'string' ? t.description : '');
    setClassification(t.classification || 'FEATURE');
    setStatus(t.status || 'TODO');
    setPriority(t.priority || 'MEDIUM');
    setAssignedHours(t.assignedHours != null ? String(t.assignedHours) : '');
    setStartDate(t.startDate ? t.startDate.slice(0, 10) : '');
    setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '');
    setSprintId(t.assignedSprint?.id != null ? String(t.assignedSprint.id) : '');
    setAssignedUserIds([...loadedAssigneeUserIds]);
  };

  const handleStartEdit = () => {
    if (!task) return;
    applyTaskToForm(task);
    setEditMode(true);
    setError('');
  };

  const handleCancelEdit = () => {
    if (task) applyTaskToForm(task);
    setEditMode(false);
    setError('');
  };

  const handleSave = async () => {
    if (!task) return;
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!startDate || !dueDate) { setError('Start and due dates are required.'); return; }
    if (!sprintId) { setError('Sprint is required.'); return; }
    if (new Date(startDate) > new Date(dueDate)) { setError('Start date must be on or before due date.'); return; }
    setSaving(true);
    setError('');
    try {
      const { finishDate: _omitFinish, ...taskRest } = task;
      const payload = {
        ...taskRest,
        title: title.trim(),
        description: (description || '').trim(),
        classification,
        status,
        priority,
        assignedHours: assignedHours === '' ? null : Number(assignedHours),
        startDate: new Date(startDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        assignedSprint: { id: Number(sprintId) },
      };
      const res = await fetch(`${API_BASE}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        const nextIds = [...new Set(assignedUserIds.map(Number).filter((n) => Number.isFinite(n)))].sort();
        const prevIds = [...loadedAssigneeUserIds].sort();
        const sameSet = nextIds.length === prevIds.length && nextIds.every((id, i) => id === prevIds[i]);

        if (nextIds.length === 0) {
          if (prevIds.length > 0) {
            await fetch(`${API_BASE}/api/user-tasks/task/${updated.id}`, { method: 'DELETE' });
            setLoadedAssigneeUserIds([]);
          }
        } else if (!sameSet) {
          await fetch(`${API_BASE}/api/user-tasks/task/${updated.id}`, { method: 'DELETE' });
          for (const uid of nextIds) {
            await fetch(`${API_BASE}/api/user-tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: uid, taskId: updated.id, status }),
            });
          }
          setLoadedAssigneeUserIds(nextIds);
        }
        setTask(updated);
        onSaved(updated);
        setEditMode(false);
      } else {
        setError('Could not save changes.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => { if (!saving) onClose(); };

  const handleDeleteTask = async () => {
    if (!task?.id) return;
    if (!window.confirm('Delete this task permanently? Assignments and user-task rows will be removed. This cannot be undone.')) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.(task.id);
        onClose();
      } else {
        setError('Could not delete task.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = task ? (TASK_STATUS_LABEL[task.status] ?? task.status) : '';
  const classificationKey = task?.classification && CLASSIFICATION_CHIP_SX[task.classification] ? task.classification : null;
  const priorityKey = task?.priority && PRIORITY_CHIP_SX[task.priority] ? task.priority : null;
  const statusKey = task?.status && STATUS_CHIP_SX[task.status] ? task.status : null;

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid rgba(229, 57, 53, 0.12)` }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(229,57,53,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A1A1A' }}>{editMode ? 'Edit task' : 'Task details'}</Typography>
              {task?.id != null && <Typography variant="caption" sx={{ color: ORACLE_RED, fontWeight: 700 }}>ID #{task.id}</Typography>}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {!editMode && task && !loading ? (
              <>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={handleStartEdit}
                  sx={{
                    bgcolor: ORACLE_RED_ACTION,
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#A83B2D' },
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={handleDeleteTask}
                  disabled={saving}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                >
                  Delete
                </Button>
              </>
            ) : null}
            <IconButton aria-label="Close" onClick={handleDialogClose} disabled={saving} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, pt: 2.5, pb: 1, background: 'linear-gradient(180deg, #EEF5FB 0%, #F7F9FC 24%, #FFFFFF 100%)' }}>
        {loading && !task && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={36} sx={{ color: ORACLE_RED }} /></Box>}
        {task && !editMode && (
          <Stack spacing={2.25}>
            <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, border: '1px solid #E3F2FD', borderTop: `3px solid ${ORACLE_RED}` }}>
              <Typography variant="overline" sx={{ color: ORACLE_RED, fontWeight: 800, display: 'block', mb: 1.25 }}>Overview</Typography>
              <Box><Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0' }}>Title</Typography><Typography variant="body1" sx={{ fontWeight: 700, mt: 0.5 }}>{taskDisplayName(task)}</Typography></Box>
              <Box sx={{ mt: 2 }}><Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0' }}>Description</Typography><Typography variant="body2" sx={{ mt: 0.5 }}>{(task.description && String(task.description).trim()) || '—'}</Typography></Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>
                <Chip label={task.classification || '—'} size="small" sx={{ fontWeight: 700, ...(classificationKey ? CLASSIFICATION_CHIP_SX[classificationKey] : {}) }} />
                <Chip label={statusLabel} size="small" sx={{ fontWeight: 700, ...(statusKey ? STATUS_CHIP_SX[statusKey] : {}) }} />
                <Chip label={task.priority || '—'} size="small" sx={{ fontWeight: 700, ...(priorityKey ? PRIORITY_CHIP_SX[priorityKey] : {}) }} />
                <Chip label={`${task.assignedHours ?? 0}h assigned`} size="small" sx={{ fontWeight: 700, bgcolor: '#E0F2F1', color: '#00695C' }} />
              </Stack>
            </Paper>
            <Paper elevation={0} sx={PLANNING_CARD_SX}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, display: 'block', mb: 1.25 }}>Planning</Typography>
              <Box><Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0' }}>Sprint</Typography><Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{task.assignedSprint?.id != null ? `Sprint ${task.assignedSprint.id}` : '—'}</Typography></Box>
              <Box sx={{ mt: 2 }}><Typography variant="caption" sx={{ fontWeight: 800, color: '#6A1B9A' }}>Assigned to</Typography>
                {loadedAssigneeUserIds.length ? <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.75 }}>{loadedAssigneeUserIds.map((uid) => {
                  const name = users.find((u) => Number(userRecordId(u)) === uid)?.name ?? `User #${uid}`;
                  const av = developerAvatarColors(name);
                  return <Chip key={uid} size="small" variant="outlined" label={name} sx={{ fontWeight: 600, color: av.color, borderColor: av.color }} />;
                })}</Stack> : <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>—</Typography>}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, border: `1px solid #FB8C00` }}><Typography variant="caption" sx={{ fontWeight: 800, color: '#E65100' }}>Start Date</Typography><Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{formatDate(task.startDate)}</Typography></Box>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, border: `1px solid #1E88E5` }}><Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0' }}>Due Date</Typography><Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{formatDate(task.dueDate)}</Typography></Box>
              </Stack>
            </Paper>
          </Stack>
        )}
        {task && editMode && (
          <Stack spacing={2.25}>
            <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, border: '1px solid #E3F2FD', borderTop: `3px solid ${ORACLE_RED}` }}>
              <Typography variant="overline" sx={{ color: ORACLE_RED, fontWeight: 800, display: 'block', mb: 1.5 }}>Overview</Typography>
              <Stack spacing={2}>
                <TextField label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth multiline minRows={2} />
                <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={4} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl size="small" fullWidth><InputLabel>Work item type</InputLabel><Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type"><MenuItem value="FEATURE">Feature</MenuItem><MenuItem value="BUG">Bug</MenuItem><MenuItem value="TASK">Task</MenuItem><MenuItem value="USER_STORY">User Story</MenuItem></Select></FormControl>
                  <FormControl size="small" fullWidth><InputLabel>Status</InputLabel><Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status"><MenuItem value="TODO">To do</MenuItem><MenuItem value="IN_PROGRESS">In progress</MenuItem><MenuItem value="IN_REVIEW">In review</MenuItem><MenuItem value="PENDING">Pending</MenuItem><MenuItem value="DONE">Done</MenuItem></Select></FormControl>
                  <FormControl size="small" fullWidth><InputLabel>Priority</InputLabel><Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority"><MenuItem value="LOW">Low</MenuItem><MenuItem value="MEDIUM">Medium</MenuItem><MenuItem value="HIGH">High</MenuItem><MenuItem value="CRITICAL">Critical</MenuItem></Select></FormControl>
                </Stack>
              </Stack>
            </Paper>
            <Paper elevation={0} sx={PLANNING_CARD_SX}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, display: 'block', mb: 1.5 }}>Planning</Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl size="small" fullWidth><InputLabel>Sprint</InputLabel><Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">{sprints.map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}</Select></FormControl>
                  <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} />
                </Stack>
                <FormControl fullWidth size="small"><InputLabel id="task-assignees-label">Assigned to</InputLabel><Select labelId="task-assignees-label" multiple value={assignedUserIds} onChange={(e) => setAssignedUserIds(typeof e.target.value === 'string' ? e.target.value.split(',').map(Number) : e.target.value)} input={<OutlinedInput label="Assigned to" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.length === 0 ? <Typography component="span" variant="body2" sx={{ color: '#9E9E9E' }}>Unassigned</Typography> : selected.map((uid) => { const nm = users.find((u) => Number(userRecordId(u)) === uid)?.name ?? `User #${uid}`; const av = developerAvatarColors(nm); return <Chip key={uid} size="small" variant="outlined" label={nm} sx={{ fontWeight: 600, color: av.color, borderColor: av.color }} />; })}</Box>)}><MenuItem value="">Select developers</MenuItem></Select></FormControl>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
                  <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" />
                </Stack>
              </Stack>
            </Paper>
            {error && <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>{error}</Typography>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: `1px solid rgba(229, 57, 53, 0.12)` }}>
        {editMode ? <><Button onClick={handleCancelEdit} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button><Button onClick={handleSave} disabled={saving} variant="contained" sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700 }}>{saving ? 'Saving…' : 'Save changes'}</Button></> : <Button onClick={handleDialogClose} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Close</Button>}
      </DialogActions>
    </Dialog>
  );
}

function SprintCard({ sprint, tasks, isSelected, onClick }) {
  const status = inferSprintStatus(sprint, tasks);
  const statusCfg = STATUS_CONFIG[status];
  const sprintTasks = tasks.filter(t => t.assignedSprint?.id === sprint.id);
  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const total = sprintTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : Math.round((sprint.completionRate ?? 0) * 100);

  return (
    <Card onClick={onClick} sx={{ borderRadius: 3, border: isSelected ? `2px solid ${ORACLE_RED}` : '1px solid #EFEFEF', boxShadow: isSelected ? '0 4px 16px rgba(229,57,53,0.12)' : '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'all 0.15s ease', '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' }, bgcolor: isSelected ? '#FFFAFA' : 'white' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box><Typography sx={{ fontWeight: 800, fontSize: '1.08rem' }}>Sprint {sprint.id}</Typography><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} /><Typography variant="caption" sx={{ color: '#999' }}>{formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}</Typography></Box></Box>
          <Chip label={statusCfg.label} size="small" sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>
        {total > 0 && (<><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progress</Typography><Typography variant="caption" sx={{ fontWeight: 800, color: progress === 100 ? '#2E7D32' : ORACLE_RED }}>{progress}%</Typography></Box><LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: '#F0F0F0', mb: 2, '& .MuiLinearProgress-bar': { bgcolor: progress === 100 ? '#4CAF50' : ORACLE_RED, borderRadius: 3 } }} /></>)}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box sx={{ display: 'flex', gap: 1.5 }}><CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{done}</Typography><RadioButtonUncheckedIcon sx={{ fontSize: 14, color: ORACLE_RED }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{total - done}</Typography></Box><Typography variant="caption" sx={{ color: '#AAA', fontWeight: 600 }}>{total} tasks</Typography></Box>
      </CardContent>
    </Card>
  );
}

function SprintDetail({ sprint, tasks, userTasks, onSelectTask, onEditSprint }) {
  const sprintPhase = inferSprintStatus(sprint, tasks);
  const phaseCfg = STATUS_CONFIG[sprintPhase];
  const sprintTasks = tasks.filter(t => t.assignedSprint?.id === sprint.id);
  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const inProgress = sprintTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const inReview = sprintTasks.filter(t => t.status === 'IN_REVIEW').length;
  const total = sprintTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : Math.round((sprint.completionRate ?? 0) * 100);

  const userTasksList = Array.isArray(userTasks) ? userTasks : [];
  const assignmentsByTaskId = userTasksList.reduce((acc, ut) => {
    const tidRaw = ut?.task?.id ?? ut?.task?.ID ?? ut?.id?.taskId;
    const tid = Number(tidRaw);
    if (!Number.isFinite(tid)) return acc;
    if (!acc[tid]) acc[tid] = [];
    acc[tid].push(ut);
    return acc;
  }, {});

  const sprintTaskRows = sprintTasks.map((task) => ({
    ...(function deriveTaskRowFields() {
      const taskAssignments = assignmentsByTaskId[Number(task.id)] || [];
      const names = [...new Set(
        taskAssignments
          .map((ut) => String(ut?.user?.name || '').trim())
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
    done: task.status === 'DONE',
    status: task.status,
    statusRaw: task.status,
    dueDate: task.dueDate,
    completedAt: task.finishDate,
    _task: task,
  }));
  const statusIcon = { 'DONE': <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />, 'IN_PROGRESS': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#1E88E5' }} />, 'IN_REVIEW': <RateReviewOutlinedIcon sx={{ fontSize: 16, color: '#7B1FA2' }} />, 'PENDING': <PauseCircleIcon sx={{ fontSize: 16, color: ORACLE_RED }} />, 'TODO': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#CCC' }} /> };
  const statusLabel = { 'DONE': { label: 'Done', bg: '#F0FFF4', color: '#2E7D32' }, 'IN_PROGRESS': { label: 'In progress', bg: '#E3F2FD', color: '#1565C0' }, 'IN_REVIEW': { label: 'In review', bg: '#F3E5F5', color: '#7B1FA2' }, 'PENDING': { label: 'Pending', bg: '#FFF1F0', color: '#C62828' }, 'TODO': { label: 'To do', bg: '#F5F5F5', color: '#757575' } };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.02em' }}>Sprint {sprint.id} — Detail</Typography>
            <Chip
              label={phaseCfg.label}
              size="small"
              sx={{ bgcolor: phaseCfg.color, color: phaseCfg.textColor, fontWeight: 700, fontSize: '0.78rem' }}
            />
          </Box>
          <Typography variant="body1" sx={{ color: '#757575', mt: 0.6, fontSize: '1.05rem' }}>
            {formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => onEditSprint?.(sprint)}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            borderColor: ORACLE_RED_ACTION,
            color: ORACLE_RED_ACTION,
            flexShrink: 0,
            '&:hover': { borderColor: '#A83B2D', bgcolor: 'rgba(199, 70, 52, 0.06)' },
          }}
        >
          Edit sprint
        </Button>
      </Box>

      {sprint.goal ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            border: '1px solid #ECECEC',
            bgcolor: '#FAFAFA',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FlagOutlinedIcon sx={{ fontSize: 18, color: ORACLE_RED }} />
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#616161', letterSpacing: 0.45, fontSize: '0.875rem' }}>
              Sprint goal
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontSize: '1.02rem' }}>
            {sprint.goal}
          </Typography>
        </Paper>
      ) : null}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total',       value: total,       color: '#555' },
          { label: 'Completed',   value: done,        color: '#2E7D32' },
          { label: 'In progress', value: inProgress,  color: '#1565C0' },
          { label: 'In review',   value: inReview,    color: '#7B1FA2' },
          { label: 'Completion',  value: `${progress}%`, color: ORACLE_RED },
        ].map((s) => (
          <Grid item xs key={s.label}>
            <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #EFEFEF', boxShadow: 'none', textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: s.color, fontSize: '1.35rem' }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.8125rem', fontWeight: 600, mt: 0.5, display: 'block' }}>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 700, color: '#424242', fontSize: '1.05rem' }}>Sprint progress</Typography>
          <Typography sx={{ fontWeight: 800, color: ORACLE_RED, fontSize: '1.05rem' }}>{progress}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{
          height: 10, borderRadius: 5, bgcolor: '#F0F0F0',
          '& .MuiLinearProgress-bar': { bgcolor: ORACLE_RED, borderRadius: 5 }
        }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#757575', fontSize: '0.8125rem' }}>Start: {formatDate(sprint.startDate)}</Typography>
          <Typography variant="caption" sx={{ color: '#757575', fontSize: '0.8125rem' }}>End: {formatDate(sprint.dueDate)}</Typography>
        </Box>
      </Box>

      <Typography sx={{ display: 'block', color: '#666', fontWeight: 600, mb: 1, fontSize: '0.9rem' }}>
        Click a task to view details or edit.
      </Typography>
      <TaskTable
        items={sprintTaskRows}
        variant="manager"
        onRowClick={(row) => onSelectTask?.(row._task)}
        scrollMaxHeight={380}
      />
    </Box>
  );
}

function NewSprintDialog({ open, onClose, onCreated, projectId }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!open) return; setStartDate(''); setDueDate(''); setGoal(''); }, [open]);

  const handleClose = () => { if (!saving) onClose(); };
  const handleSave = async () => {
    if (!startDate || !dueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedProject: { id: projectId }, startDate: new Date(startDate).toISOString(), dueDate: new Date(dueDate).toISOString(), completionRate: 0, onTimeDelivery: 0, teamParticipation: 0, workloadBalance: 0, goal: goal.trim() || null }),
      });
      if (res.ok) { const created = await res.json(); onCreated(created); handleClose(); }
    } finally { setSaving(false); }
  };
  const canSave = Boolean(startDate && dueDate);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: { borderRadius: 3, border: '1px solid #ECECEC', borderLeft: `4px solid ${ORACLE_RED_ACTION}`, bgcolor: '#FFFFFF', boxShadow: '0 16px 40px rgba(199, 70, 52, 0.1)', overflow: 'hidden', maxWidth: { xs: 'calc(100% - 24px)', sm: 640 } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.5, pb: 2, borderBottom: '1px solid rgba(199, 70, 52, 0.12)', backgroundColor: '#FFFFFF' }}>
          <Box sx={{ display: 'flex', gap: 1.75 }}><Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'rgba(199, 70, 52, 0.12)', border: '1px solid rgba(199, 70, 52, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AddIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} /></Box><Box><Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.3rem' }}>New sprint</Typography><Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Schedule & goal</Typography></Box></Box>
          <IconButton onClick={handleClose} disabled={saving} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: 2.25, pb: 1.5, backgroundColor: '#FFFFFF' }}>
        <Typography variant="body2" sx={{ color: '#424242', fontWeight: 600, mb: 2 }}>Pick start and end dates, then add an optional sprint goal.</Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
            <TextField label="End date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
          </Stack>
          <TextField label="Sprint goal (optional)" placeholder="What should this sprint achieve?" value={goal} onChange={(e) => setGoal(e.target.value)} fullWidth multiline minRows={4} inputProps={{ maxLength: 2000 }} helperText={`${goal.length} / 2000 characters`} sx={newSprintDialogFieldOutline()} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: '1px solid rgba(199, 70, 52, 0.12)' }}>
        <Button onClick={handleClose} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" disableElevation sx={{ bgcolor: ORACLE_RED_ACTION, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating…' : 'Create sprint'}</Button>
      </DialogActions>
    </Dialog>
  );
}

function sprintKpiNumber(sprint, key) {
  const v = sprint?.[key];
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function EditSprintDialog({ open, sprint, onClose, onSaved }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !sprint) return;
    setStartDate(toInputDate(sprint.startDate));
    setDueDate(toInputDate(sprint.dueDate));
    setGoal(typeof sprint.goal === 'string' ? sprint.goal : '');
    setError('');
  }, [open, sprint]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const sprintId =
    sprint?.id == null || sprint?.id === ''
      ? null
      : Number.isFinite(Number(sprint.id))
        ? Number(sprint.id)
        : null;

  const handleSave = async () => {
    if (sprintId == null || !startDate || !dueDate) return;
    const projectIdRaw = sprint?.assignedProject?.id ?? sprint?.assignedProject?.ID;
    const projectId =
      projectIdRaw == null || projectIdRaw === ''
        ? null
        : Number.isFinite(Number(projectIdRaw))
          ? Number(projectIdRaw)
          : null;
    if (projectId == null) {
      setError('Sprint project is missing. Please refresh and try again.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const goalTrim = goal.trim();
      const res = await fetch(`${API_BASE}/api/sprints/${sprintId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedProject: { id: projectId },
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          completionRate: sprintKpiNumber(sprint, 'completionRate'),
          onTimeDelivery: sprintKpiNumber(sprint, 'onTimeDelivery'),
          teamParticipation: sprintKpiNumber(sprint, 'teamParticipation'),
          workloadBalance: sprintKpiNumber(sprint, 'workloadBalance'),
          goal: goalTrim || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onSaved(updated);
        onClose();
      } else {
        let detail = '';
        try {
          detail = (await res.text()).trim();
        } catch {
          detail = '';
        }
        if (res.status === 404) {
          setError(`Sprint #${sprintId} was not found in the API.`);
        } else if (detail) {
          setError(`Could not save sprint changes (${res.status}): ${detail}`);
        } else {
          setError(`Could not save sprint changes (${res.status}).`);
        }
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(startDate && dueDate && sprintId != null);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="body"
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid #ECECEC',
          borderLeft: `4px solid ${ORACLE_RED_ACTION}`,
          bgcolor: '#FFFFFF',
          boxShadow: '0 16px 40px rgba(199, 70, 52, 0.1), 0 8px 24px rgba(30, 136, 229, 0.08)',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 24px)', sm: 640 },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            px: 2.5,
            pt: 2.5,
            pb: 2,
            borderBottom: '1px solid rgba(199, 70, 52, 0.12)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'rgba(199, 70, 52, 0.12)',
                border: '1px solid rgba(199, 70, 52, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EditIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, color: '#1A1A1A', lineHeight: 1.25, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
                Edit sprint{sprint?.id != null ? ` #${sprint.id}` : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block', mt: 0.35 }}>
                Dates & goal
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            disabled={saving}
            size="small"
            sx={{ color: '#616161', '&:hover': { bgcolor: 'rgba(199, 70, 52, 0.08)' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 2.5,
          pt: 2.25,
          pb: 1.5,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Typography variant="body2" sx={{ color: '#424242', fontWeight: 600, lineHeight: 1.5, mb: 2 }}>
          Update the sprint window and optional goal. KPI metrics stored in the database are kept as-is.
        </Typography>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={newSprintDialogFieldOutline()}
            />
            <TextField
              label="End date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={newSprintDialogFieldOutline()}
            />
          </Stack>
          <TextField
            label="Sprint goal (optional)"
            placeholder="What should this sprint achieve?"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            fullWidth
            multiline
            minRows={4}
            inputProps={{ maxLength: 2000 }}
            helperText={`${goal.length} / 2000 characters`}
            sx={{
              ...newSprintDialogFieldOutline(),
              '& .MuiOutlinedInput-root': { alignItems: 'flex-start' },
            }}
          />
        </Stack>
        {error ? (
          <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600, mt: 1.5, display: 'block' }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderTop: '1px solid rgba(199, 70, 52, 0.12)',
          backgroundColor: '#FFFFFF',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{ color: '#616161', textTransform: 'none', fontWeight: 600, px: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          variant="contained"
          disableElevation
          sx={{
            bgcolor: ORACLE_RED_ACTION,
            textTransform: 'none',
            fontWeight: 700,
            px: 2.5,
            borderRadius: 2,
            '&:hover': { bgcolor: '#A83B2D' },
            '&.Mui-disabled': { bgcolor: '#E0E0E0', color: '#9E9E9E' },
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SprintsPage({ projectId }) {
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sprintForEdit, setSprintForEdit] = useState(null);
  const [selectedTaskForDialog, setSelectedTaskForDialog] = useState(null);
  const loadData = async () => {
    setLoading(true);
    try {
      const sprintsUrl = projectId ? `${API_BASE}/api/sprints?projectId=${projectId}` : `${API_BASE}/api/sprints`;
      const [sprintsRes, tasksRes, userTasksRes] = await Promise.all([
        fetch(sprintsUrl),
        fetch(`${API_BASE}/api/tasks`),
        fetch(`${API_BASE}/api/user-tasks`),
      ]);
      let sprintsData = await sprintsRes.json();
      const tasksData = await tasksRes.json();
      const userTasksData = await userTasksRes.json();
      const tasksList = Array.isArray(tasksData) ? tasksData : [];
      const userTasksList = Array.isArray(userTasksData) ? userTasksData : [];
      if (projectId) {
        sprintsData = sprintsData.filter((s) => s.assignedProject?.id == projectId);
      }
      const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
      const sorted = sortSprintsForDisplay(sprintsList, tasksList);
      setSprints(sorted);
      setTasks(tasksList);
      setUserTasks(userTasksList);
      setSelectedSprint((prev) =>
        prev
          ? sorted.find((s) => s.id === prev.id) ?? sorted[0]
          : sorted.find((s) => inferSprintStatus(s, tasksList) === 'active')
            ?? sorted.find((s) => inferSprintStatus(s, tasksList) === 'planned')
            ?? sorted[0]
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [projectId]);

  const handleSprintCreated = (newSprint) => { setSprints((prev) => sortSprintsForDisplay([newSprint, ...prev], tasks)); setSelectedSprint(newSprint); };

  if (loading) return (<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress sx={{ color: ORACLE_RED }} /></Box>);

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box><Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px', fontSize: { xs: '1.65rem', sm: '1.85rem' } }}>Sprints</Typography><Typography variant="body1" sx={{ color: '#757575', mt: 0.75 }}>{sprints[0]?.assignedProject?.name ?? 'Project'} · {sprints.length} total sprints</Typography></Box>
        <Box><Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} size="small" sx={{ textTransform: 'none', borderColor: '#DDD', color: '#555', borderRadius: 2, mr: 1 }}>Sync</Button><Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)} sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#C62828' } }}>Create new sprint</Button></Box>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={4}>
          <Typography sx={{ fontWeight: 800, color: '#333', mb: 1.5, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
            Sprint history
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sprints.map((sprint) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                tasks={tasks}
                isSelected={selectedSprint?.id === sprint.id}
                onClick={() => setSelectedSprint(sprint)}
              />
            ))}
          </Box>
        </Grid>

        <Grid item xs={8}>
          {selectedSprint ? (
            <SprintDetail
              sprint={selectedSprint}
              tasks={tasks}
              userTasks={userTasks}
              onSelectTask={(t) => setSelectedTaskForDialog(t)}
              onEditSprint={(s) => setSprintForEdit(s)}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <Typography variant="body1" sx={{ color: '#CCC' }}>
                Select a sprint to view details
              </Typography>
            </Box>
          )}
        </Grid>
      </Grid>

      <NewSprintDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleSprintCreated}
        projectId={projectId || (sprints[0]?.assignedProject?.id ?? 1)}
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
        onClose={() => setSelectedTaskForDialog(null)}
        onSaved={(updated) => {
          setTasks((prev) => {
            const next = prev.map((x) => (x.id === updated.id ? updated : x));
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
        }}
        onDeleted={(taskId) => {
          setTasks((prev) => {
            const next = prev.filter((x) => x.id !== taskId);
            setSprints((sp) => sortSprintsForDisplay(sp, next));
            return next;
          });
        }}
      />
    </Box>
  );
}