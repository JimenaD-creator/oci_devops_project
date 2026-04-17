import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, IconButton, Paper,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Stack, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { developerAvatarColors } from '../utils/developerColors';
import { developerNumericId, finiteUserIds, multiselectNumericIds, normalizeUserId } from '../utils/userIds';
import TaskTable from '../components/dashboard/TaskTable';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

/** Primary actions / brand (red, black, gray — not blue). */
const ORACLE_RED = '#E53935';
const ORACLE_RED_ACTION = '#C74634';
/** Progress bars & % labels: no red/green in the bar fill (neutral blue/indigo). */
const PROGRESS_BAR = '#1565C0';
const PROGRESS_BAR_COMPLETE = '#2E7D32';
const PROGRESS_TRACK = '#ECEFF1';
const PROGRESS_LABEL = '#424242';

function oracleRgba(a) {
  return `rgba(199, 70, 52, ${a})`;
}

const PLANNING_CARD_SX = {
  p: 2.25,
  borderRadius: 2,
  bgcolor: '#FFFFFF',
  border: `1px solid ${oracleRgba(0.22)}`,
  borderTop: `3px solid ${ORACLE_RED_ACTION}`,
  boxShadow: `0 2px 10px ${oracleRgba(0.06)}`,
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
  PENDING: { bgcolor: '#FFF1F0', color: '#C62828' },
  DONE: { bgcolor: '#E8F5E9', color: '#2E7D32' },
};

const STATUS_CONFIG = {
  active:    { label: 'In progress', color: '#E8F5E9', textColor: '#2E7D32' },
  completed: { label: 'Completed',   color: '#E8F5E9', textColor: '#2E7D32' },
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

/**
 * Active project id from props + localStorage. Treats empty-string prop as missing so we
 * still use localStorage (otherwise `??` skips localStorage and /api/sprints loads everything).
 */
function resolveActiveProjectIdNum(projectIdProp) {
  const trim = (v) => (v == null ? '' : String(v).trim());
  const fromProp = trim(projectIdProp);
  const fromLs =
    typeof localStorage !== 'undefined' ? trim(localStorage.getItem('currentProjectId')) : '';
  const raw = fromProp !== '' ? fromProp : fromLs;
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fetchJsonNoStore = (url) =>
  fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });

const EASE_OUT = [0.25, 0.1, 0.25, 1];

const sprintsOverviewVariants = {
  page: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: 0.35, staggerChildren: 0.07, delayChildren: 0.04 },
    },
  },
  block: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE_OUT } },
  },
};

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

/** USER_TASK row: user id from nested user or embedded id.userId (API may omit lazy user). */
function userIdFromUserTaskRow(row) {
  if (!row) return null;
  const u = row.user;
  const raw =
    u?.id ??
    u?.ID ??
    u?.userId ??
    row?.userId ??
    row?.USER_ID ??
    row?.id?.userId ??
    row?.id?.user_id;
  return normalizeUserId(raw);
}

/** Positive project id from prop, env, or null. */
function normalizeProjectIdNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Project id from sprint JSON (matches backend Sprint → assignedProject). */
function sprintProjectIdFromJson(s) {
  const raw = s?.assignedProject?.id ?? s?.assignedProject?.ID ?? s?.assignedProjectId;
  return normalizeProjectIdNum(raw);
}

/**
 * Project whose team populates "Assigned to": selected app project, else task sprint's project from JSON.
 */
function resolveProjectIdForDevelopers(taskLike, sprintsList, parentProjectId) {
  const fromParent = normalizeProjectIdNum(parentProjectId);
  if (fromParent != null) return fromParent;
  if (!taskLike) return null;
  const nestedPid = normalizeProjectIdNum(
    taskLike.assignedSprint?.assignedProject?.id ?? taskLike.assignedSprint?.assignedProject?.ID,
  );
  if (nestedPid != null) return nestedPid;
  const sprintIdRaw =
    taskLike.assignedSprint?.id ??
    taskLike.assignedSprint?.ID ??
    taskLike.assignedSprintId ??
    taskLike.sprintId;
  const sprintId = sprintIdRaw != null && sprintIdRaw !== '' ? Number(sprintIdRaw) : null;
  if (sprintId == null || !Number.isFinite(sprintId) || !Array.isArray(sprintsList)) return null;
  const sp = sprintsList.find((s) => Number(s.id) === Number(sprintId));
  return sp ? sprintProjectIdFromJson(sp) : null;
}

// eslint-disable-next-line no-unused-vars
function TaskDetailDialog({ open, initialTask, sprints, projectDevelopers, activeProjectId, onClose, onSaved, onDeleted }) {
  const [task, setTask] = useState(null);
  const [loadedAssigneeUserIds, setLoadedAssigneeUserIds] = useState([]);
  /** Names from USER_TASK rows (API includes user); used when project developers list does not match id. */
  const [assigneeNamesByUserId, setAssigneeNamesByUserId] = useState({});
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
  /** Fetched inside dialog so assignees always match the task’s project / sprint (parent list can be empty or stale). */
  const [pickerDevelopers, setPickerDevelopers] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const resolvedDeveloperProjectId = useMemo(() => {
    const source =
      task && initialTask && Number(task.id) === Number(initialTask.id) ? task : initialTask;
    return resolveProjectIdForDevelopers(source, sprints, activeProjectId);
  }, [task, initialTask, sprints, activeProjectId]);

  useEffect(() => {
    if (!open) {
      setPickerDevelopers([]);
      setPickerLoading(false);
      return;
    }
    const pid = resolvedDeveloperProjectId;
    if (pid == null) {
      setPickerDevelopers([]);
      setPickerLoading(false);
      return;
    }
    let cancelled = false;
    setPickerLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${pid}/developers`, {
          headers: { Accept: 'application/json' },
        });
        const data = res.ok ? await res.json() : [];
        if (!cancelled) {
          setPickerDevelopers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) setPickerDevelopers([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, resolvedDeveloperProjectId]);

  const availableDevelopers = useMemo(() => {
    if (Array.isArray(pickerDevelopers) && pickerDevelopers.length > 0) return pickerDevelopers;
    return Array.isArray(projectDevelopers) ? projectDevelopers : [];
  }, [pickerDevelopers, projectDevelopers]);

  const displayNameForAssignee = (uidRaw) => {
    const uid = normalizeUserId(uidRaw);
    if (uid == null || !Number.isFinite(uid)) return 'Unknown assignee';
    const fromDev = availableDevelopers.find((x) => developerNumericId(x) === uid);
    if (fromDev?.name) return String(fromDev.name).trim();
    const fromUt = assigneeNamesByUserId[String(uid)];
    if (fromUt) return fromUt;
    return `User #${uid}`;
  };

  useEffect(() => {
    if (!open) {
      setTask(null);
      setLoadedAssigneeUserIds([]);
      setAssigneeNamesByUserId({});
      setPickerDevelopers([]);
      setPickerLoading(false);
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

        const utRes = await fetch(`${API_BASE}/api/user-tasks/task/${t.id}`);
        const utList = utRes.ok ? await utRes.json() : [];
        if (cancelled) return;
        const ids = Array.isArray(utList)
          ? [...new Set(utList.map(userIdFromUserTaskRow).filter((id) => id != null && Number.isFinite(id)))]
          : [];
        const nameMap = {};
        if (Array.isArray(utList)) {
          utList.forEach((row) => {
            const uid = userIdFromUserTaskRow(row);
            if (uid == null) return;
            const nm = String(row?.user?.name ?? '').trim();
            if (nm) nameMap[String(uid)] = nm;
          });
        }
        setAssigneeNamesByUserId(nameMap);
        setLoadedAssigneeUserIds(ids);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, initialTask?.id]);

  /**
   * Drop assignee ids that are not in the project developer list. Only shrink the selection when
   * something would be removed (avoids replacing the array reference on every parent re-render).
   */
  useEffect(() => {
    if (!editMode) return;
    if (availableDevelopers.length === 0) return;
    setAssignedUserIds((prev) => {
      const allowed = new Set(
        (availableDevelopers || [])
          .map((u) => developerNumericId(u))
          .filter((id) => id != null && Number.isFinite(id)),
      );
      const next = finiteUserIds(prev).filter((id) => allowed.has(id));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [availableDevelopers, editMode]);

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
    setAssignedUserIds(finiteUserIds(loadedAssigneeUserIds));
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
      const nextIds = [...finiteUserIds(assignedUserIds)].sort();
      const prevIds = [...finiteUserIds(loadedAssigneeUserIds)].sort();
      const sameSet = nextIds.length === prevIds.length && nextIds.every((id, i) => id === prevIds[i]);

      /**
       * When assignees change, sync USER_TASK before PUT. Otherwise TaskController may return 409
       * (e.g. status DONE while old assignee rows are not all COMPLETED) and the new assignees are never saved.
       */
      if (!sameSet) {
        const tid = task.id;
        if (nextIds.length === 0) {
          if (prevIds.length > 0) {
            const delRes = await fetch(`${API_BASE}/api/user-tasks/task/${tid}`, { method: 'DELETE' });
            if (!delRes.ok) {
              setError('Could not update assignees.');
              return;
            }
            setLoadedAssigneeUserIds([]);
          }
        } else {
          const delRes = await fetch(`${API_BASE}/api/user-tasks/task/${tid}`, { method: 'DELETE' });
          if (!delRes.ok) {
            setError('Could not update assignees.');
            return;
          }
          for (const uid of nextIds) {
            const postRes = await fetch(`${API_BASE}/api/user-tasks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: uid, taskId: tid, status }),
            });
            if (!postRes.ok) {
              setError('Could not update assignees.');
              return;
            }
          }
          setLoadedAssigneeUserIds(nextIds);
        }
      }

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
        setTask(updated);
        onClose();
        onSaved(updated);
      } else if (res.status === 409) {
        setError(
          'Cannot set this task to Done until every assigned developer is marked complete, or change assignees first.',
        );
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
  const viewAssigneeIds = useMemo(() => finiteUserIds(loadedAssigneeUserIds), [loadedAssigneeUserIds]);
  const editAssigneeIds = useMemo(() => finiteUserIds(assignedUserIds), [assignedUserIds]);

  return (
    <Dialog open={open} onClose={handleDialogClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid rgba(229, 57, 53, 0.12)` }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: oracleRgba(0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
            <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, border: '1px solid #ECECEC', borderTop: `3px solid ${ORACLE_RED_ACTION}` }}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, display: 'block', mb: 1.25 }}>Overview</Typography>
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
                {viewAssigneeIds.length ? <Stack direction="row" flexWrap="wrap" spacing={0.5} sx={{ mt: 0.75 }}>{viewAssigneeIds.map((uidRaw) => {
                  const name = displayNameForAssignee(uidRaw);
                  const av = developerAvatarColors(name);
                  return <Chip key={String(uidRaw)} size="small" variant="outlined" label={name} sx={{ fontWeight: 600, color: av.color, borderColor: av.color }} />;
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
            <Paper elevation={0} sx={{ p: 2.25, borderRadius: 2, border: '1px solid #ECECEC', borderTop: `3px solid ${ORACLE_RED_ACTION}` }}>
              <Typography variant="overline" sx={{ color: ORACLE_RED_ACTION, fontWeight: 800, display: 'block', mb: 1.5 }}>Overview</Typography>
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
                <FormControl fullWidth size="small">
                  <InputLabel id="task-assignees-label">Assigned to</InputLabel>
                  <Select
                    labelId="task-assignees-label"
                    multiple
                    value={editAssigneeIds}
                    onChange={(e) => setAssignedUserIds(multiselectNumericIds(e.target.value))}
                    input={<OutlinedInput label="Assigned to" />}
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
                        {selected.length === 0 ? (
                          <Typography component="span" variant="body2" sx={{ color: '#9E9E9E' }}>
                            Unassigned
                          </Typography>
                        ) : (
                          selected.map((id) => {
                            const name = displayNameForAssignee(id);
                            const av = developerAvatarColors(name);
                            return (
                              <Chip
                                key={id}
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
                          })
                        )}
                      </Box>
                    )}
                    MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                  >
                    {availableDevelopers.map((u) => {
                      const uid = developerNumericId(u);
                      if (uid == null || !Number.isFinite(uid)) return null;
                      const selectedIds = editAssigneeIds;
                      return (
                        <MenuItem key={uid} value={uid}>
                          <Checkbox
                            checked={selectedIds.includes(uid)}
                            size="small"
                            sx={{ py: 0 }}
                          />
                          <ListItemText primary={u.name} primaryTypographyProps={{ variant: 'body2' }} />
                        </MenuItem>
                      );
                    })}
                  </Select>
                  {editMode && pickerLoading ? (
                    <LinearProgress sx={{ mt: 1, borderRadius: 1, height: 3 }} />
                  ) : null}
                  {editMode && !pickerLoading && resolvedDeveloperProjectId == null ? (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#C62828', fontWeight: 600 }}>
                      Could not determine the project for this task (missing sprint/project on the task). Select a project in the app or fix the task sprint.
                    </Typography>
                  ) : null}
                  {editMode && !pickerLoading && resolvedDeveloperProjectId != null && availableDevelopers.length === 0 ? (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#757575', fontWeight: 500 }}>
                      {`No developers returned for project #${resolvedDeveloperProjectId}. Add developers to the team or check GET /api/projects/${resolvedDeveloperProjectId}/developers.`}
                    </Typography>
                  ) : null}
                </FormControl>
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
        {editMode ? <><Button onClick={handleCancelEdit} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button><Button onClick={handleSave} disabled={saving} variant="contained" sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Saving…' : 'Save changes'}</Button></> : <Button onClick={handleDialogClose} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Close</Button>}
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

  const outlineColor = statusCfg.textColor;
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        border: isSelected ? `2px solid ${outlineColor}` : '1px solid #EFEFEF',
        boxShadow: isSelected ? `0 4px 14px ${outlineColor}33` : '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' },
        bgcolor: isSelected ? statusCfg.color : 'white',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box><Typography sx={{ fontWeight: 800, fontSize: '1.08rem' }}>Sprint {sprint.id}</Typography><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}><CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} /><Typography variant="caption" sx={{ color: '#999' }}>{formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}</Typography></Box></Box>
          <Chip label={statusCfg.label} size="small" sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>
        {total > 0 && (<><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progress</Typography><Typography variant="caption" sx={{ fontWeight: 800, color: PROGRESS_LABEL }}>{progress}%</Typography></Box><LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3, bgcolor: PROGRESS_TRACK, mb: 2, '& .MuiLinearProgress-bar': { bgcolor: progress === 100 ? PROGRESS_BAR_COMPLETE : PROGRESS_BAR, borderRadius: 3 } }} /></>)}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Box sx={{ display: 'flex', gap: 1.5 }}><CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{done}</Typography><RadioButtonUncheckedIcon sx={{ fontSize: 14, color: ORACLE_RED }} /><Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{total - done}</Typography></Box><Typography variant="caption" sx={{ color: '#AAA', fontWeight: 600 }}>{total} tasks</Typography></Box>
      </CardContent>
    </Card>
  );
}

function NewSprintDialog({ open, onClose, onCreated, projectId }) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [goal, setGoal] = useState('');
  const [saving, setSaving] = useState(false);

  const resolvedProjectId =
    projectId == null || projectId === ''
      ? NaN
      : Number(projectId);
  const hasValidProject = Number.isFinite(resolvedProjectId) && resolvedProjectId > 0;

  useEffect(() => { if (!open) return; setStartDate(''); setDueDate(''); setGoal(''); }, [open]);

  const handleClose = () => { if (!saving) onClose(); };
  const handleSave = async () => {
    if (!hasValidProject || !startDate || !dueDate) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/sprints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedProject: { id: resolvedProjectId }, startDate: new Date(startDate).toISOString(), dueDate: new Date(dueDate).toISOString(), completionRate: 0, onTimeDelivery: 0, teamParticipation: 0, workloadBalance: 0, goal: goal.trim() || null }),
      });
      if (res.ok) { const created = await res.json(); onCreated(created); handleClose(); }
    } finally { setSaving(false); }
  };
  const canSave = Boolean(hasValidProject && startDate && dueDate);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: { borderRadius: 3, border: '1px solid #ECECEC', borderLeft: `4px solid ${ORACLE_RED_ACTION}`, bgcolor: '#FFFFFF', boxShadow: `0 16px 40px ${oracleRgba(0.1)}`, overflow: 'hidden', maxWidth: { xs: 'calc(100% - 24px)', sm: 640 } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${oracleRgba(0.12)}`, backgroundColor: '#FFFFFF' }}>
          <Box sx={{ display: 'flex', gap: 1.75 }}><Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: oracleRgba(0.12), border: `1px solid ${oracleRgba(0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><AddIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} /></Box><Box><Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.3rem' }}>New sprint</Typography><Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Schedule & goal</Typography></Box></Box>
          <IconButton onClick={handleClose} disabled={saving} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pt: 2.25, pb: 1.5, backgroundColor: '#FFFFFF' }}>
        <Typography variant="body2" sx={{ color: '#424242', fontWeight: 600, mb: 2 }}>Pick start and end dates, then add an optional sprint goal.</Typography>
        {!hasValidProject && (
          <Typography variant="caption" sx={{ color: ORACLE_RED_ACTION, fontWeight: 600, display: 'block', mb: 1 }}>
            No active project is selected. Select a project in the app or sign in again.
          </Typography>
        )}
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
            <TextField label="End date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
          </Stack>
          <TextField label="Sprint goal (optional)" placeholder="What should this sprint achieve?" value={goal} onChange={(e) => setGoal(e.target.value)} fullWidth multiline minRows={4} inputProps={{ maxLength: 2000 }} helperText={`${goal.length} / 2000 characters`} sx={newSprintDialogFieldOutline()} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: `1px solid ${oracleRgba(0.12)}` }}>
        <Button onClick={handleClose} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" disableElevation sx={{ bgcolor: ORACLE_RED_ACTION, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating…' : 'Create sprint'}</Button>
      </DialogActions>
    </Dialog>
  );
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

  useEffect(() => {
    if (!open) return;
    const fallbackSprintId = defaultSprintId != null ? String(defaultSprintId) : '';
    const isValidDefault = (sprints || []).some((s) => String(s.id) === fallbackSprintId);
    setSprintId(isValidDefault ? fallbackSprintId : '');
    setTitle('');
    setDescription('');
    setClassification('FEATURE');
    setStatus('TODO');
    setPriority('MEDIUM');
    setAssignedHours('');
    setStartDate('');
    setDueDate('');
    setAssignedToIds([]);
    setError('');
  }, [open, defaultSprintId, sprints]);

  const validDevelopers = useMemo(
    () =>
      (projectDevelopers || [])
        .map((u, idx) => ({
          uid: developerNumericId(u),
          displayName: u?.name ?? u?.NAME ?? u?.email ?? `Developer ${idx + 1}`,
        }))
        .filter((u) => u.uid != null && Number.isFinite(u.uid)),
    [projectDevelopers],
  );

  const canSave = Boolean(
    title.trim()
    && description.trim()
    && startDate
    && dueDate
    && sprintId
    && assignedToIds.length > 0,
  );

  const handleClose = () => {
    if (!saving) onClose();
  };

  const handleSave = async () => {
    if (!canSave) {
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
          assignedSprint: { id: Number(sprintId) },
        }),
      });
      if (!res.ok) {
        setError(`Could not create task (${res.status}).`);
        return;
      }
      const task = await res.json();
      const userIds = finiteUserIds(assignedToIds);
      for (const uid of userIds) {
        await fetch(`${API_BASE}/api/user-tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, taskId: Number(task.id), status }),
        });
      }
      onCreated?.(task, userIds, status);
      onClose();
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth PaperProps={{ elevation: 0, sx: { borderRadius: 3, border: '1px solid #ECECEC', borderLeft: `4px solid ${ORACLE_RED_ACTION}`, bgcolor: '#FFFFFF', boxShadow: `0 16px 40px ${oracleRgba(0.1)}`, overflow: 'hidden', maxWidth: { xs: 'calc(100% - 24px)', sm: 760 } } }}>
      <DialogTitle sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, px: 2.5, pt: 2.5, pb: 2, borderBottom: `1px solid ${oracleRgba(0.12)}`, backgroundColor: '#FFFFFF' }}>
          <Box sx={{ display: 'flex', gap: 1.75 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: oracleRgba(0.12), border: `1px solid ${oracleRgba(0.2)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TaskAltIcon sx={{ color: ORACLE_RED_ACTION, fontSize: 26 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.3rem' }}>Create task</Typography>
              <Typography variant="caption" sx={{ color: '#616161', fontWeight: 600, display: 'block' }}>Details, planning & assignees</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} disabled={saving} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 3.5, px: { xs: 3.5, sm: 4.5 }, pb: 3, overflowY: 'auto' }}>
        <Stack spacing={2.25} sx={{ mx: { xs: 0.5, sm: 0.75 }, my: { xs: 0.5, sm: 0.75 } }}>
          <TextField
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            sx={{ ...newSprintDialogFieldOutline(), mt: 0.5 }}
          />
          <TextField label="Task description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth multiline minRows={4} sx={newSprintDialogFieldOutline()} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Work item type</InputLabel>
              <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
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
            <FormControl size="small" fullWidth sx={newSprintDialogFieldOutline()}>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {(sprints || []).map((s) => (<MenuItem key={s.id} value={String(s.id)}>{`Sprint ${s.id}`}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField label="Assigned hours" type="number" value={assignedHours} onChange={(e) => setAssignedHours(e.target.value)} fullWidth size="small" inputProps={{ min: 0 }} sx={newSprintDialogFieldOutline()} />
          </Stack>
          <FormControl fullWidth size="small" sx={newSprintDialogFieldOutline()}>
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={finiteUserIds(assignedToIds)}
              onChange={(e) => setAssignedToIds(multiselectNumericIds(e.target.value))}
              input={<OutlinedInput label="Developers" />}
              renderValue={(selected) => finiteUserIds(selected).map((id) => validDevelopers.find((u) => u.uid === id)?.displayName ?? `#${id}`).join(', ')}
            >
              {validDevelopers.map((u) => (
                <MenuItem key={u.uid} value={u.uid}>
                  <Checkbox checked={finiteUserIds(assignedToIds).includes(u.uid)} size="small" />
                  <ListItemText primary={u.displayName} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
            <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth size="small" sx={newSprintDialogFieldOutline()} />
          </Stack>
          {error && <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>{error}</Typography>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 2, gap: 1, borderTop: `1px solid ${oracleRgba(0.12)}` }}>
        <Button onClick={handleClose} disabled={saving} sx={{ color: '#616161', textTransform: 'none', fontWeight: 600 }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !canSave} variant="contained" disableElevation sx={{ bgcolor: ORACLE_RED_ACTION, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>{saving ? 'Creating…' : 'Create task'}</Button>
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
          boxShadow: `0 16px 40px ${oracleRgba(0.1)}, 0 8px 24px rgba(30, 136, 229, 0.08)`,
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
            borderBottom: `1px solid ${oracleRgba(0.12)}`,
            backgroundColor: '#FFFFFF',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: oracleRgba(0.12),
                border: `1px solid ${oracleRgba(0.2)}`,
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
            sx={{ color: '#616161', '&:hover': { bgcolor: oracleRgba(0.08) } }}
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
          <Typography variant="caption" sx={{ color: ORACLE_RED_ACTION, fontWeight: 600, mt: 1.5, display: 'block' }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 2,
          gap: 1,
          borderTop: `1px solid ${oracleRgba(0.12)}`,
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

  const sprintProjectIdFromJson = (s) => {
    const raw = s?.assignedProject?.id ?? s?.assignedProject?.ID ?? s?.assignedProjectId;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

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