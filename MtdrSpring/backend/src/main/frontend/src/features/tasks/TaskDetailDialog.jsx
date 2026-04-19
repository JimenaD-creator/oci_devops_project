import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Stack, Paper,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText,
  Button, IconButton, Chip, LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { developerAvatarColors } from '../../utils/developerColors';
import { developerNumericId, finiteUserIds, multiselectNumericIds, normalizeUserId } from '../../utils/userIds';
import {
  API_BASE,
  ORACLE_RED,
  ORACLE_RED_ACTION,
  CLASSIFICATION_CHIP_SX,
  PRIORITY_CHIP_SX,
  STATUS_CHIP_SX,
  TASK_STATUS_LABEL,
} from '../sprints/constants/sprintConstants';
import {
  formatDate,
  oracleRgba,
  PLANNING_CARD_SX,
  resolveProjectIdForDevelopers,
  taskDisplayName,
  userIdFromUserTaskRow,
} from '../sprints/utils/sprintUtils';
import { isUserTaskAssigneeComplete } from './utils/taskUtils';
import {
  ASSIGNEE_IDENTITY_PALETTE,
  assigneeIdentityPaletteIndex,
} from './utils/assigneeIdentityPalette';

export function TaskDetailDialog({
  open,
  initialTask,
  sprints,
  projectDevelopers,
  activeProjectId,
  onClose,
  onSaved,
  onDeleted,
}) {
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
  /** USER_TASK rows for this task (names + per-assignee completion for shared tasks). */
  const [taskUserTasks, setTaskUserTasks] = useState([]);

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
      setTaskUserTasks([]);
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
        const list = Array.isArray(utList) ? utList : [];
        setTaskUserTasks(list);
        const ids = [...new Set(list.map(userIdFromUserTaskRow).filter((id) => id != null && Number.isFinite(id)))];
        const nameMap = {};
        list.forEach((row) => {
          const uid = userIdFromUserTaskRow(row);
          if (uid == null) return;
          const nm = String(row?.user?.name ?? '').trim();
          if (nm) nameMap[String(uid)] = nm;
        });
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
            setTaskUserTasks([]);
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
          const refreshUt = await fetch(`${API_BASE}/api/user-tasks/task/${tid}`);
          const refreshed = refreshUt.ok ? await refreshUt.json() : [];
          setTaskUserTasks(Array.isArray(refreshed) ? refreshed : []);
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
            {taskUserTasks.length > 1 ? (
              <Paper elevation={0} sx={{ ...PLANNING_CARD_SX, borderTop: `3px solid #5C6BC0` }}>
                <Typography variant="overline" sx={{ color: '#3949AB', fontWeight: 800, display: 'block', mb: 1.25 }}>Assignee progress</Typography>
                <Stack spacing={1.1}>
                  {[...taskUserTasks]
                    .map((ut) => {
                      const uid = userIdFromUserTaskRow(ut);
                      const name = displayNameForAssignee(uid);
                      const done = isUserTaskAssigneeComplete(ut);
                      const hrs = Number(ut?.workedHours ?? ut?.worked_hours ?? ut?.hours ?? 0) || 0;
                      return { ut, uid, name, done, hrs };
                    })
                    .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }))
                    .map(({ ut, uid, name, done, hrs }) => {
                      const pal = ASSIGNEE_IDENTITY_PALETTE[
                        assigneeIdentityPaletteIndex({ userId: uid, name })
                      ];
                      return (
                        <Box
                          key={`${uid ?? 'x'}-${ut?.id?.taskId ?? task.id}`}
                          sx={{
                            display: 'flex',
                            alignItems: 'stretch',
                            flexWrap: 'wrap',
                            gap: 0.75,
                            py: 0.5,
                            borderBottom: '1px solid #EEEEEE',
                            '&:last-of-type': { borderBottom: 'none' },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              flex: 1,
                              minWidth: 140,
                              maxWidth: '100%',
                              borderRadius: '10px',
                              overflow: 'hidden',
                              border: '1px solid rgba(0,0,0,0.1)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                            }}
                          >
                            <Box
                              sx={{
                                flex: 1,
                                minWidth: 0,
                                pl: 0.9,
                                pr: 0.5,
                                py: 0.45,
                                display: 'flex',
                                alignItems: 'center',
                                bgcolor: pal.light,
                                borderLeft: `4px solid ${pal.strip}`,
                                color: pal.name,
                                fontSize: '0.8rem',
                                fontWeight: 800,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {name}
                            </Box>
                            <Box
                              sx={{
                                flexShrink: 0,
                                px: 0.85,
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#fff',
                                bgcolor: done ? '#1B5E20' : '#E65100',
                              }}
                            >
                              {done ? 'Finished' : 'Pending'}
                            </Box>
                          </Box>
                          {hrs > 0 ? (
                            <Chip
                              size="small"
                              label={`${hrs}h`}
                              sx={{
                                alignSelf: 'center',
                                fontWeight: 700,
                                height: 24,
                                bgcolor: '#E3F2FD',
                                color: '#0D47A1',
                                border: '1px solid rgba(13, 71, 161, 0.2)',
                              }}
                            />
                          ) : null}
                        </Box>
                      );
                    })}
                </Stack>
              </Paper>
            ) : null}
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
                <FormControl
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiSelect-select': {
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      alignContent: 'center',
                      gap: 0.5,
                      minHeight: 40,
                      whiteSpace: 'normal',
                      overflow: 'visible',
                      textOverflow: 'clip',
                      py: 0.75,
                    },
                  }}
                >
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
