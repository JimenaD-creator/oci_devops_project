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
import { developerAvatarColors } from '../utils/developerColors';

const ORACLE_RED = '#E53935';
/** Same primary red as Tasks page (Create task / New task). */
const ORACLE_RED_ACTION = '#C74634';

/** Planning block: mixed accents (not green-only); borders align with Overview / Oracle. */
const PLANNING_CARD_SX = {
  p: 2.25,
  borderRadius: 2,
  bgcolor: '#FFFFFF',
  border: '1px solid rgba(21, 101, 192, 0.22)',
  borderTop: `3px solid ${ORACLE_RED_ACTION}`,
  boxShadow: '0 2px 10px rgba(21, 101, 192, 0.06)',
};
const PLANNING_LABEL_SPRINT = '#1565C0';
const PLANNING_LABEL_ASSIGNED = '#6A1B9A';
const PLANNING_DATE_START_BORDER = '#FB8C00';
const PLANNING_DATE_START_LABEL = '#E65100';
const PLANNING_DATE_DUE_BORDER = '#1E88E5';
const PLANNING_DATE_DUE_LABEL = '#1565C0';

/** New sprint dialog: colored outlines + labels (same idea as Tasks create form). */
function sprintFormFieldOutline(accent) {
  return {
    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: `${accent}AA` },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: accent },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: accent },
    '& .MuiInputLabel-root': { color: `${accent}DD` },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiFormHelperText-root': { color: `${accent}AA` },
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
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const STATUS_CONFIG = {
  active:    { label: 'In progress', color: '#E8F5E9', textColor: '#2E7D32' },
  completed: { label: 'Completed',   color: '#EEF2FF', textColor: '#3730A3' },
  planned:   { label: 'Planned',     color: '#FFF8E1', textColor: '#F57F17' },
};

const AVATAR_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

/** Calendar-only phase when the sprint has no tasks (fallback). */
function inferStatusByDate(sprint) {
  const now = new Date();
  const start = new Date(sprint.startDate);
  const due = new Date(sprint.dueDate);
  if (now < start) return 'planned';
  if (now > due) return 'completed';
  return 'active';
}

/**
 * Sprint phase from task completion:
 * - No tasks in sprint → same as calendar (planned / in progress by dates / completed by dates).
 * - Has tasks, none DONE → planned (work not finished yet).
 * - Has tasks, some but not all DONE → active ("In progress").
 * - Has tasks, all DONE → completed.
 */
function inferSprintStatus(sprint, allTasks) {
  const list = Array.isArray(allTasks) ? allTasks : [];
  const sprintTasks = list.filter((t) => t.assignedSprint?.id === sprint.id);
  if (sprintTasks.length === 0) {
    return inferStatusByDate(sprint);
  }
  const done = sprintTasks.filter((t) => t.status === 'DONE').length;
  if (done === sprintTasks.length) return 'completed';
  if (done > 0) return 'active';
  return 'planned';
}

/**
 * Sprint history order: (1) In progress, (2) Planned, (3) Completed.
 * Within each group: higher id first (newer sprints on top).
 */
function sortSprintsForDisplay(list, allTasks) {
  const rank = (s) => {
    const st = inferSprintStatus(s, allTasks);
    if (st === 'active') return 0; // in progress
    if (st === 'planned') return 1;
    return 2; // completed
  };
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    return b.id - a.id;
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function taskDisplayName(task) {
  const t = typeof task.title === 'string' ? task.title.trim() : '';
  if (t) return t;
  const c = typeof task.classification === 'string' ? task.classification.trim() : '';
  return c || '—';
}

function toInputDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
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

function TaskDetailDialog({ open, initialTask, sprints, onClose, onSaved }) {
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
  const [assignedUserIds, setAssignedUserIds] = useState([]);

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
        const [taskRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/api/tasks/${initialTask.id}`),
          fetch(`${API_BASE}/users`),
        ]);
        const t = taskRes.ok ? await taskRes.json() : null;
        const usersData = usersRes.ok ? await usersRes.json() : [];
        if (cancelled || !t) return;
        setTask(t);
        setUsers(Array.isArray(usersData) ? usersData : []);

        const utRes = await fetch(`${API_BASE}/api/user-tasks/task/${t.id}`);
        const utList = utRes.ok ? await utRes.json() : [];
        if (cancelled) return;
        const ids = Array.isArray(utList)
          ? [...new Set(
              utList
                .map((row) => row?.user?.id ?? row?.user?.ID)
                .filter((id) => id != null)
                .map((id) => Number(id)),
            )].sort((a, b) => a - b)
          : [];
        setLoadedAssigneeUserIds(ids);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialTask?.id]);

  const applyTaskToForm = (t) => {
    if (!t) return;
    setTitle(typeof t.title === 'string' ? t.title : '');
    setDescription(typeof t.description === 'string' ? t.description : '');
    setClassification(t.classification || 'FEATURE');
    setStatus(t.status || 'TODO');
    setPriority(t.priority || 'MEDIUM');
    setAssignedHours(t.assignedHours != null ? String(t.assignedHours) : '');
    setStartDate(toInputDate(t.startDate));
    setDueDate(toInputDate(t.dueDate));
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
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!startDate || !dueDate) {
      setError('Start and due dates are required.');
      return;
    }
    if (!sprintId) {
      setError('Sprint is required.');
      return;
    }
    if (new Date(startDate) > new Date(dueDate)) {
      setError('Start date must be on or before due date.');
      return;
    }
    if (assignedHours && Number(assignedHours) < 0) {
      setError('Assigned hours must be zero or greater.');
      return;
    }
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
        const nextIds = [...new Set(assignedUserIds.map(Number).filter((n) => Number.isFinite(n)))].sort(
          (a, b) => a - b,
        );
        const prevIds = [...loadedAssigneeUserIds].sort((a, b) => a - b);
        const sameSet =
          nextIds.length === prevIds.length && nextIds.every((id, i) => id === prevIds[i]);

        try {
          if (nextIds.length === 0) {
            if (prevIds.length > 0) {
              const del = await fetch(`${API_BASE}/api/user-tasks/task/${updated.id}`, { method: 'DELETE' });
              if (!del.ok) throw new Error('Task saved, but clearing assignment failed.');
              setLoadedAssigneeUserIds([]);
            }
          } else if (!sameSet) {
            const del = await fetch(`${API_BASE}/api/user-tasks/task/${updated.id}`, { method: 'DELETE' });
            if (!del.ok) throw new Error('Task saved, but updating assignment failed.');
            const wh = assignedHours === '' ? 0 : Number(assignedHours);
            for (const uid of nextIds) {
              const post = await fetch(`${API_BASE}/api/user-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: uid,
                  taskId: updated.id,
                  workedHours: wh,
                  status,
                }),
              });
              if (!post.ok) throw new Error('Task saved, but assignment sync failed.');
            }
            setLoadedAssigneeUserIds(nextIds);
          }
        } catch (assignErr) {
          setTask(updated);
          onSaved(updated);
          setError(assignErr.message || 'Task saved, but assignment sync failed.');
          setSaving(false);
          return;
        }

        setTask(updated);
        onSaved(updated);
        setEditMode(false);
      } else {
        setError('Could not save changes. Please try again.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const handleDialogClose = () => {
    if (!saving) onClose();
  };

  const statusLabel = task ? (TASK_STATUS_LABEL[task.status] ?? task.status) : '';
  const classificationKey = task?.classification && CLASSIFICATION_CHIP_SX[task.classification] ? task.classification : null;
  const priorityKey = task?.priority && PRIORITY_CHIP_SX[task.priority] ? task.priority : null;
  const statusKey = task?.status && STATUS_CHIP_SX[task.status] ? task.status : null;

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid #E8E0DE',
          borderLeft: `4px solid ${ORACLE_RED}`,
          bgcolor: '#FFFFFF',
          boxShadow: '0 16px 44px rgba(229, 57, 53, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 64px)',
          m: 2,
          maxWidth: { xs: 'calc(100% - 32px)', sm: 820 },
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
            pt: 2.25,
            pb: 2,
            borderBottom: `1px solid rgba(229, 57, 53, 0.12)`,
            background: 'linear-gradient(135deg, #FFF3F0 0%, #FFFFFF 58%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                bgcolor: 'rgba(229,57,53,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A1A1A', letterSpacing: '-0.02em' }}>
                {editMode ? 'Edit task' : 'Task details'}
              </Typography>
              {task?.id != null ? (
                <Typography variant="caption" sx={{ color: ORACLE_RED, fontWeight: 700, fontSize: '0.85rem', mt: 0.25, display: 'block' }}>
                  ID #{task.id}
                </Typography>
              ) : null}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {!editMode && task && !loading ? (
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
            ) : null}
            <IconButton aria-label="Close" onClick={handleDialogClose} disabled={saving} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          px: { xs: 2.5, sm: 3 },
          pt: 2.5,
          pb: 1,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #EEF5FB 0%, #F7F9FC 24%, #FFFFFF 100%)',
        }}
      >
        {loading && !task ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={36} sx={{ color: ORACLE_RED }} />
          </Box>
        ) : null}

        {task && !editMode ? (
          <Stack spacing={2.25} sx={{ width: '100%' }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: 2,
                bgcolor: '#FFFFFF',
                border: '1px solid #E3F2FD',
                borderTop: `3px solid ${ORACLE_RED}`,
                boxShadow: '0 2px 10px rgba(21, 101, 192, 0.06)',
              }}
            >
              <Typography variant="overline" sx={{ color: ORACLE_RED, fontWeight: 800, letterSpacing: 1.1, display: 'block', mb: 1.25, fontSize: '0.95rem', lineHeight: 1.35 }}>
                Overview
              </Typography>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0', letterSpacing: 0.4, fontSize: '0.875rem' }}>
                  Title
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 700, color: '#1A1A1A', mt: 0.5, fontSize: '1.05rem' }}>
                  {taskDisplayName(task)}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#1565C0', letterSpacing: 0.4, fontSize: '0.875rem' }}>
                  Description
                </Typography>
                <Typography variant="body2" sx={{ color: '#333', mt: 0.5, whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: '0.98rem' }}>
                  {(task.description && String(task.description).trim()) || '—'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 0.75, mt: 2 }}>
                <Chip
                  label={task.classification || '—'}
                  size="small"
                  sx={{ fontWeight: 700, ...(classificationKey ? CLASSIFICATION_CHIP_SX[classificationKey] : { bgcolor: '#ECEFF1', color: '#37474F' }) }}
                />
                <Chip
                  label={statusLabel}
                  size="small"
                  sx={{ fontWeight: 700, ...(statusKey ? STATUS_CHIP_SX[statusKey] : { bgcolor: '#ECEFF1', color: '#546E7A' }) }}
                />
                <Chip
                  label={task.priority || '—'}
                  size="small"
                  sx={{ fontWeight: 700, ...(priorityKey ? PRIORITY_CHIP_SX[priorityKey] : { bgcolor: '#FFF8E1', color: '#F57F17' }) }}
                />
                <Chip
                  label={`${task.assignedHours ?? 0}h assigned`}
                  size="small"
                  sx={{ fontWeight: 700, bgcolor: '#E0F2F1', color: '#00695C' }}
                />
              </Stack>
            </Paper>

            <Paper elevation={0} sx={PLANNING_CARD_SX}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, letterSpacing: 1.1, display: 'block', mb: 1.25, fontSize: '0.95rem', lineHeight: 1.35 }}>
                Planning
              </Typography>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: PLANNING_LABEL_SPRINT, letterSpacing: 0.4, fontSize: '0.875rem' }}>
                  Sprint
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700, color: '#1A1A1A', fontSize: '1.02rem' }}>
                  {task.assignedSprint?.id != null ? `Sprint ${task.assignedSprint.id}` : '—'}
                </Typography>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: PLANNING_LABEL_ASSIGNED, letterSpacing: 0.4, fontSize: '0.875rem' }}>
                  Assigned to
                </Typography>
                {loadedAssigneeUserIds.length ? (
                  <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.75, gap: 0.5 }}>
                    {loadedAssigneeUserIds.map((uid) => {
                      const name = users.find((u) => Number(userRecordId(u)) === uid)?.name ?? `User #${uid}`;
                      const av = developerAvatarColors(name);
                      return (
                        <Chip
                          key={uid}
                          size="small"
                          variant="outlined"
                          label={name}
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
                  </Stack>
                ) : (
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>—</Typography>
                )}
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'transparent', border: `1px solid ${PLANNING_DATE_START_BORDER}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: PLANNING_DATE_START_LABEL, fontSize: '0.8125rem' }}>Start Date</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700, color: '#1A1A1A', fontSize: '1rem' }}>{formatDate(task.startDate)}</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'transparent', border: `1px solid ${PLANNING_DATE_DUE_BORDER}` }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: PLANNING_DATE_DUE_LABEL, fontSize: '0.8125rem' }}>Due Date</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700, color: '#1A1A1A', fontSize: '1rem' }}>{formatDate(task.dueDate)}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Stack>
        ) : null}

        {task && editMode ? (
          <Stack spacing={2.25} sx={{ mt: 0.5, width: '100%' }}>
            <Paper
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: 2,
                bgcolor: '#FFFFFF',
                border: '1px solid #E3F2FD',
                borderTop: `3px solid ${ORACLE_RED}`,
                boxShadow: '0 2px 10px rgba(21, 101, 192, 0.06)',
              }}
            >
              <Typography variant="overline" sx={{ color: ORACLE_RED, fontWeight: 800, letterSpacing: 1.1, display: 'block', mb: 1.5, fontSize: '0.95rem', lineHeight: 1.35 }}>
                Overview
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                  required
                  inputProps={{ maxLength: 500 }}
                  helperText={`${title.length} / 500`}
                  sx={{ '& .MuiInputBase-input': { fontSize: '1rem', lineHeight: 1.5 } }}
                />
                <TextField
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  minRows={6}
                  inputProps={{ maxLength: 4000 }}
                  helperText={`${description.length} / 4000`}
                  sx={{ '& .MuiInputBase-root': { alignItems: 'flex-start' }, '& .MuiInputBase-input': { fontSize: '0.95rem', lineHeight: 1.6 } }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Work item type</InputLabel>
                    <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                      <MenuItem value="FEATURE">Feature</MenuItem>
                      <MenuItem value="BUG">Bug</MenuItem>
                      <MenuItem value="TASK">Task</MenuItem>
                      <MenuItem value="USER_STORY">User Story</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                      <MenuItem value="TODO">To do</MenuItem>
                      <MenuItem value="IN_PROGRESS">In progress</MenuItem>
                      <MenuItem value="IN_REVIEW">In review</MenuItem>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="DONE">Done</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select value={priority} onChange={(e) => setPriority(e.target.value)} label="Priority">
                      <MenuItem value="LOW">Low</MenuItem>
                      <MenuItem value="MEDIUM">Medium</MenuItem>
                      <MenuItem value="HIGH">High</MenuItem>
                      <MenuItem value="CRITICAL">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ ...PLANNING_CARD_SX, mb: 0 }}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, letterSpacing: 1.1, display: 'block', mb: 1.5, fontSize: '0.95rem', lineHeight: 1.35 }}>
                Planning
              </Typography>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl size="small" fullWidth sx={{ '& .MuiInputLabel-root': { color: PLANNING_LABEL_SPRINT } }}>
                    <InputLabel>Sprint</InputLabel>
                    <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                      {sprints.map((s) => (
                        <MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Assigned hours"
                    type="number"
                    value={assignedHours}
                    onChange={(e) => setAssignedHours(e.target.value)}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0 }}
                  />
                </Stack>
                <FormControl fullWidth size="small" sx={{ '& .MuiInputLabel-root': { color: PLANNING_LABEL_ASSIGNED } }}>
                  <InputLabel id="task-assignees-label">Assigned to</InputLabel>
                  <Select
                    labelId="task-assignees-label"
                    multiple
                    value={assignedUserIds}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAssignedUserIds(typeof v === 'string' ? v.split(',').map(Number) : v);
                    }}
                    input={<OutlinedInput label="Assigned to" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.25 }}>
                        {selected.length === 0 ? (
                          <Typography component="span" variant="body2" sx={{ color: '#9E9E9E' }}>
                            Unassigned
                          </Typography>
                        ) : (
                          selected.map((uid) => {
                            const nm = users.find((u) => Number(userRecordId(u)) === uid)?.name ?? `User #${uid}`;
                            const av = developerAvatarColors(nm);
                            return (
                              <Chip
                                key={uid}
                                size="small"
                                variant="outlined"
                                label={nm}
                                sx={{
                                  fontWeight: 600,
                                  bgcolor: 'transparent',
                                  color: av.color,
                                  borderColor: av.color,
                                  borderWidth: 1,
                                }}
                              />
                            );
                          })
                        )}
                      </Box>
                    )}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
                  >
                    {users.map((u) => {
                      const uid = Number(userRecordId(u));
                      return (
                        <MenuItem key={uid} value={uid}>
                          {u.name ?? `User #${uid}`}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'transparent', border: `1px solid ${PLANNING_DATE_START_BORDER}` }}>
                    <TextField
                      label="Start Date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      size="small"
                      sx={{
                        '& .MuiInputLabel-root': { color: `${PLANNING_DATE_START_LABEL}CC` },
                        '& .MuiInputLabel-root.Mui-focused': { color: PLANNING_DATE_START_LABEL },
                        '& .MuiOutlinedInput-root': { bgcolor: '#FFFFFF' },
                        '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: `${PLANNING_DATE_START_BORDER}AA` },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: PLANNING_DATE_START_BORDER },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: PLANNING_DATE_START_BORDER, borderWidth: 2 },
                        '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'transparent', border: `1px solid ${PLANNING_DATE_DUE_BORDER}` }}>
                    <TextField
                      label="Due Date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      size="small"
                      sx={{
                        '& .MuiInputLabel-root': { color: `${PLANNING_DATE_DUE_LABEL}CC` },
                        '& .MuiInputLabel-root.Mui-focused': { color: PLANNING_DATE_DUE_LABEL },
                        '& .MuiOutlinedInput-root': { bgcolor: '#FFFFFF' },
                        '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: `${PLANNING_DATE_DUE_BORDER}AA` },
                        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: PLANNING_DATE_DUE_BORDER },
                        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: PLANNING_DATE_DUE_BORDER, borderWidth: 2 },
                        '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
                      }}
                    />
                  </Box>
                </Stack>
              </Stack>
            </Paper>
            {error ? (
              <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>
                {error}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderTop: `1px solid rgba(229, 57, 53, 0.12)`,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #FFF8F6 100%)',
          justifyContent: 'flex-end',
        }}
      >
        {editMode ? (
          <>
            <Button onClick={handleCancelEdit} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="contained"
              disableElevation
              sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#C62828' } }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        ) : (
          <Button onClick={handleDialogClose} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>
            Close
          </Button>
        )}
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
    <Card onClick={onClick} sx={{
      borderRadius: 3,
      border: isSelected ? `2px solid ${ORACLE_RED}` : '1px solid #EFEFEF',
      boxShadow: isSelected ? '0 4px 16px rgba(229,57,53,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' },
      bgcolor: isSelected ? '#FFFAFA' : 'white',
    }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box sx={{ minWidth: 0, pr: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.08rem', letterSpacing: '-0.02em' }}>Sprint {sprint.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} />
              <Typography variant="caption" sx={{ color: '#999' }}>
                {formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}
              </Typography>
            </Box>
            {sprint.goal ? (
              <Typography
                variant="caption"
                sx={{
                  color: '#777',
                  mt: 0.75,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.35,
                }}
              >
                {sprint.goal}
              </Typography>
            ) : null}
          </Box>
          <Chip label={statusCfg.label} size="small"
            sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>

        {total > 0 && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progress</Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, color: progress === 100 ? '#2E7D32' : ORACLE_RED }}>
                {progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} sx={{
              height: 6, borderRadius: 3, bgcolor: '#F0F0F0', mb: 2,
              '& .MuiLinearProgress-bar': { bgcolor: progress === 100 ? '#4CAF50' : ORACLE_RED, borderRadius: 3 }
            }} />
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{done}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: ORACLE_RED }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{total - done}</Typography>
            </Box>
          </Box>
          <Typography variant="caption" sx={{ color: '#AAA', fontWeight: 600 }}>
            {total} tasks · {Math.round((sprint.completionRate ?? 0) * 100)}% KPI
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function SprintDetail({ sprint, tasks, onSelectTask }) {
  const sprintPhase = inferSprintStatus(sprint, tasks);
  const phaseCfg = STATUS_CONFIG[sprintPhase];
  const sprintTasks = tasks.filter(t => t.assignedSprint?.id === sprint.id);
  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const inProgress = sprintTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const inReview = sprintTasks.filter(t => t.status === 'IN_REVIEW').length;
  const total = sprintTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : Math.round((sprint.completionRate ?? 0) * 100);

  const statusIcon = {
    'DONE': <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />,
    'IN_PROGRESS': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#1E88E5' }} />,
    'IN_REVIEW': <RateReviewOutlinedIcon sx={{ fontSize: 16, color: '#7B1FA2' }} />,
    'PENDING': <PauseCircleIcon sx={{ fontSize: 16, color: ORACLE_RED }} />,
    'TODO': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#CCC' }} />,
  };

  const statusLabel = {
    'DONE':        { label: 'Done',        bg: '#F0FFF4', color: '#2E7D32' },
    'IN_PROGRESS': { label: 'In progress', bg: '#E3F2FD', color: '#1565C0' },
    'IN_REVIEW':   { label: 'In review',   bg: '#F3E5F5', color: '#7B1FA2' },
    'PENDING':     { label: 'Pending',     bg: '#FFF1F0', color: '#C62828' },
    'TODO':        { label: 'To do',       bg: '#F5F5F5', color: '#757575' },
  };

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
      <Paper sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none', overflow: 'hidden' }}>
        {sprintTasks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#CCC' }}>No tasks in this sprint</Typography>
          </Box>
        ) : sprintTasks.map((task, i) => (
          <Box key={task.id}>
            <Box
              role="button"
              tabIndex={0}
              onClick={() => onSelectTask?.(task)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTask?.(task);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 3,
                py: 2,
                gap: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: '#FAFAFA' },
                transition: 'background 0.1s',
              }}
            >
              {statusIcon[task.status] ?? statusIcon['TODO']}
              <Typography variant="body2" sx={{
                flexGrow: 1, fontWeight: 500,
                color: task.status === 'DONE' ? '#AAA' : '#1A1A1A',
                textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
              }}>
                {taskDisplayName(task)}
              </Typography>
              <Chip
                label={(statusLabel[task.status] ?? statusLabel['TODO']).label}
                size="small"
                sx={{
                  bgcolor: (statusLabel[task.status] ?? statusLabel['TODO']).bg,
                  color: (statusLabel[task.status] ?? statusLabel['TODO']).color,
                  fontWeight: 600, fontSize: '0.68rem', height: 20,
                }}
              />
              <Chip label={`${task.assignedHours}h`} size="small"
                sx={{ bgcolor: '#F5F5F5', color: '#888', fontWeight: 600, fontSize: '0.68rem', height: 20 }} />
            </Box>
            {i < sprintTasks.length - 1 && <Divider />}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

function NewSprintDialog({ open, onClose, onCreated, projectId }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStartDate('');
    setDueDate('');
    setGoal('');
  }, [open]);

  const resetForm = () => {
    setStartDate('');
    setDueDate('');
    setGoal('');
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handleSave = async () => {
    if (!startDate || !dueDate) return;
    setSaving(true);
    try {
      const goalTrim = goal.trim();
      const res = await fetch(`${API_BASE}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedProject: { id: projectId ?? 1 },
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          completionRate: 0,
          onTimeDelivery: 0,
          teamParticipation: 0,
          workloadBalance: 0,
          goal: goalTrim || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        handleClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const canSave = Boolean(startDate && dueDate);

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
          border: '1px solid rgba(21, 101, 192, 0.2)',
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
            background: 'linear-gradient(135deg, #FFF3F0 0%, #E3F2FD 42%, #FFFFFF 100%)',
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
              <AddIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, color: '#1A1A1A', lineHeight: 1.25, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>
                New sprint
              </Typography>
              <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 600, display: 'block', mt: 0.35 }}>
                Schedule & goal
              </Typography>
            </Box>
          </Box>
          <IconButton
            aria-label="Close"
            onClick={handleClose}
            disabled={saving}
            size="small"
            sx={{ color: '#5C6BC0', '&:hover': { bgcolor: 'rgba(30, 136, 229, 0.08)' } }}
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
          background: 'linear-gradient(180deg, #FFF8F5 0%, #E8F4FD 38%, #F3E8FF 62%, #FFFFFF 100%)',
        }}
      >
        <Typography variant="body2" sx={{ color: '#5E35B1', fontWeight: 600, lineHeight: 1.5, mb: 2 }}>
          Pick start and end dates, then add an optional sprint goal if you want one.
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
              sx={sprintFormFieldOutline(PLANNING_DATE_START_BORDER)}
            />
            <TextField
              label="End date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={sprintFormFieldOutline(PLANNING_DATE_DUE_BORDER)}
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
              ...sprintFormFieldOutline('#6A1B9A'),
              '& .MuiOutlinedInput-root': { alignItems: 'flex-start' },
            }}
          />
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderTop: '1px solid rgba(21, 101, 192, 0.12)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #E3F2FD 45%, #FFF8F6 100%)',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{ color: '#1565C0', textTransform: 'none', fontWeight: 600, px: 2 }}
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
          {saving ? 'Creating…' : 'Create sprint'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function SprintsPage() {
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTaskForDialog, setSelectedTaskForDialog] = useState(null);

  const loadData = async () => {
  setLoading(true);
  try {
    const [sprintsRes, tasksRes] = await Promise.all([
      fetch(`${API_BASE}/api/sprints`),
      fetch(`${API_BASE}/api/tasks`),
    ]);
    const sprintsData = await sprintsRes.json();
    const tasksData = await tasksRes.json();
    const sprintsList = Array.isArray(sprintsData) ? sprintsData : [];
    const tasksList = Array.isArray(tasksData) ? tasksData : [];
    const sorted = sortSprintsForDisplay(sprintsList, tasksList);
    setSprints(sorted);
    setTasks(tasksList);
    setSelectedSprint((prev) =>
      prev
        ? sorted.find((s) => s.id === prev.id) ?? sorted[0]
        : sorted.find((s) => inferSprintStatus(s, tasksList) === 'active')
          ?? sorted.find((s) => inferSprintStatus(s, tasksList) === 'planned')
          ?? sorted[0],
    );
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { loadData(); }, []);

  const handleSprintCreated = (newSprint) => {
    setSprints((prev) => sortSprintsForDisplay([newSprint, ...prev], tasks));
    setSelectedSprint(newSprint);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: ORACLE_RED }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px', fontSize: { xs: '1.65rem', sm: '1.85rem' } }}>
            Sprints
          </Typography>
          <Typography variant="body1" sx={{ color: '#757575', mt: 0.75, fontSize: '1.05rem', lineHeight: 1.5 }}>
            {sprints[0]?.assignedProject?.name ?? 'Project'} · {sprints.length} total sprints
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} size="small"
            sx={{ textTransform: 'none', borderColor: '#DDD', color: '#555', borderRadius: 2 }}>
            Sync
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, borderRadius: 2,
              '&:hover': { bgcolor: '#C62828' } }}>
            Create new sprint
          </Button>
        </Box>
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
              onSelectTask={(t) => setSelectedTaskForDialog(t)}
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
        projectId={sprints[0]?.assignedProject?.id ?? 1}
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
      />
    </Box>
  );
}