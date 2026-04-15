import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Grid, Typography, Paper, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Stack, Button, Dialog, DialogTitle, DialogContent, IconButton,
  DialogActions, OutlinedInput, Checkbox, ListItemText, Alert,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import KanbanBoard from '../components/tasks/KanbanBoard';
import { matchesDueDateRange } from '../components/dashboard/taskFilters';
import { developerAvatarColors } from '../utils/developerColors';

const ORACLE_RED = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

/** Border + label/input text color only (no fill). */
function createTaskFieldOutline(accent) {
  return {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      bgcolor: '#FFFFFF',
    },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
      borderColor: `${accent}AA`,
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: accent,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderWidth: 2,
      borderColor: accent,
    },
    '& .MuiInputLabel-root': { color: `${accent}DD` },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
    '& .MuiOutlinedInput-input': { color: '#1A1A1A' },
    '& .MuiSelect-select': { color: '#1A1A1A' },
  };
}

function mapTaskToKanban(task, developerNames = []) {
  const statusMap = {
    'DONE':        'done',
    'IN_PROGRESS': 'in_progress',
    'IN_REVIEW':   'in_review',
    'TODO':        'todo',
  };
  const list = Array.isArray(developerNames)
    ? [...new Set(developerNames.filter(Boolean))]
    : (developerNames ? [developerNames] : []);
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
    _raw: task,
  };
}

function NewTaskDialog({ open, onClose, onCreated, sprints, users }) {
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
    setTitle('');
    setDescription('');
    setClassification('FEATURE');
    setStatus('TODO');
    setPriority('MEDIUM');
    setAssignedHours('');
    setStartDate('');
    setDueDate('');
    setAssignedToIds([]);
    setSprintId('');
    setError('');
  };

  const handleClose = () => {
    if (!saving) {
      resetForm();
      onClose();
    }
  };

  const handleSave = async () => {
    const hasSprintPick = sprintId !== '' && sprintId != null && sprintId !== undefined;
    if (!title.trim() || !description.trim() || !classification || !status || !priority || !startDate || !dueDate || !hasSprintPick || assignedToIds.length === 0) {
      setError('Please fill in all required fields (including at least one developer).');
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
      if (res.ok) {
        const created = await res.json();
        const worked = assignedHours ? Number(assignedHours) : 0;
        const successfulIds = [];
        for (const uid of assignedToIds) {
          const assignRes = await fetch(`${API_BASE}/api/user-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: Number(uid),
              taskId: created.id,
              workedHours: worked,
              status,
            }),
          });
          if (!assignRes.ok) {
            setError('Task created, but one or more developer assignments failed. You can assign developers from task details.');
            onCreated(created, successfulIds, status, worked);
            handleClose();
            return;
          }
          successfulIds.push(Number(uid));
        }
        onCreated(created, successfulIds, status, worked);
        handleClose();
      } else {
        setError('Could not create task. Please try again.');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setSaving(false);
    }
  };

  const hasSprintPick = sprintId !== '' && sprintId != null && sprintId !== undefined;
  const canSave = Boolean(
    title.trim()
    && description.trim()
    && classification
    && status
    && priority
    && startDate
    && dueDate
    && hasSprintPick
    && assignedToIds.length > 0
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        elevation: 0,
        sx: {
          borderRadius: 3,
          border: '1px solid rgba(21, 101, 192, 0.2)',
          borderLeft: `4px solid ${ORACLE_RED}`,
          bgcolor: '#FFFFFF',
          boxShadow: '0 16px 40px rgba(199, 70, 52, 0.12), 0 8px 28px rgba(30, 136, 229, 0.09)',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxWidth: { xs: 'calc(100% - 24px)', sm: 820 },
        },
      }}
    >
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1.5,
            px: 2.5,
            py: 2,
            borderBottom: '1px solid rgba(199, 70, 52, 0.12)',
            background: 'linear-gradient(135deg, #FFF3F0 0%, #E3F2FD 40%, #FFFFFF 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: 'rgba(199,70,52,0.10)',
                border: '1px solid rgba(199, 70, 52, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: '#1A1A1A', lineHeight: 1.2 }}>
                Create task
              </Typography>
              <Typography variant="caption" sx={{ color: '#1565C0', fontWeight: 600, display: 'block', mt: 0.35 }}>
                Details, planning & assignees
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={handleClose}
            size="small"
            disabled={saving}
            aria-label="Close"
            sx={{ color: '#5C6BC0', '&:hover': { bgcolor: 'rgba(30, 136, 229, 0.08)' } }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 2.5,
          px: { xs: 2.5, sm: 3 },
          pb: 2,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #FFF8F5 0%, #E3F2FD 28%, #F3E5F5 52%, #FFFFFF 100%)',
        }}
      >
        <Stack spacing={2} sx={{ width: '100%', mt: 0.5 }}>
          <TextField
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="medium"
            sx={{
              ...createTaskFieldOutline(ORACLE_RED),
              '& .MuiInputBase-root': { alignItems: 'flex-start' },
            }}
          />
          <TextField
            label="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            size="medium"
            sx={createTaskFieldOutline('#1565C0')}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#2E7D32') }}>
              <InputLabel>Work item type</InputLabel>
              <Select value={classification} onChange={(e) => setClassification(e.target.value)} label="Work item type">
                <MenuItem value="FEATURE">Feature</MenuItem>
                <MenuItem value="BUG">Bug</MenuItem>
                <MenuItem value="TASK">Task</MenuItem>
                <MenuItem value="USER_STORY">User Story</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#546E7A') }}>
              <InputLabel>Status</InputLabel>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} label="Status">
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
                <MenuItem value="DONE">Done</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#F57F17') }}>
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
            <FormControl size="small" fullWidth sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#6A1B9A') }}>
              <InputLabel>Sprint</InputLabel>
              <Select
                value={sprintId}
                onChange={(e) => setSprintId(e.target.value)}
                label="Sprint"
              >
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
              sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#00897B') }}
            />
          </Stack>
          <FormControl
            size="small"
            fullWidth
            sx={{
              ...createTaskFieldOutline('#5E35B1'),
              '& .MuiOutlinedInput-root': {
                alignItems: 'flex-start',
                py: 0.75,
                minHeight: 42,
              },
            }}
          >
            <InputLabel id="create-task-assigned-label">Developers</InputLabel>
            <Select
              labelId="create-task-assigned-label"
              multiple
              value={assignedToIds}
              onChange={(e) => {
                const v = e.target.value;
                const next = typeof v === 'string' ? v.split(',').map(Number) : v.map(Number);
                setAssignedToIds(next);
              }}
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
                    const u = users.find((x) => Number(x.id ?? x.ID) === Number(id));
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
              {users.map((u) => {
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
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#558B2F') }}
            />
            <TextField
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
              sx={{ flex: 1, minWidth: 0, ...createTaskFieldOutline('#0277BD') }}
            />
          </Stack>

          {error ? (
            <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          pb: 2.25,
          pt: 1.5,
          borderTop: '1px solid rgba(21, 101, 192, 0.12)',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #E3F2FD 42%, #FFF8F6 100%)',
        }}
      >
        <Button onClick={handleClose} sx={{ color: '#1565C0', textTransform: 'none', fontWeight: 600 }} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !canSave}
          variant="contained"
          sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#A83B2D' } }}
        >
          {saving ? 'Creating...' : 'Create task'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TasksPage() {
  const [rawTasks, setRawTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [users, setUsers] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [developerFilter, setDeveloperFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  /** When set, show dialog to mark each assignee DONE before the task can move to Done. */
  const [multiDoneTaskId, setMultiDoneTaskId] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, sprintsRes, usersRes, userTasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks`),
        fetch(`${API_BASE}/api/sprints`),
        fetch(`${API_BASE}/users`),
        fetch(`${API_BASE}/api/user-tasks`),
      ]);
      setRawTasks(await tasksRes.json());
      setSprints(await sprintsRes.json());
      const usersData = await usersRes.json();
      setUsers(Array.isArray(usersData) ? usersData : []);
      const userTasksData = await userTasksRes.json();
      setUserTasks(Array.isArray(userTasksData) ? userTasksData : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
        await loadData();
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
          const res = await fetch(`${API_BASE}/api/user-tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: uid,
              taskId: Number(taskId),
              status: 'DONE',
              workedHours: ut.workedHours ?? 0,
            }),
          });
          if (res.ok) await loadData();
        } else {
          await putTask();
        }
        return;
      }

      if (ns === 'DONE') {
        const allDone = assignees.every(
          (ut) => String(ut.status || '').toUpperCase() === 'DONE',
        );
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

  useEffect(() => {
    if (multiDoneTaskId == null) return;
    const uts = userTasks.filter(
      (ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId),
    );
    if (uts.length > 0 && uts.every((ut) => String(ut.status || '').toUpperCase() === 'DONE')) {
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
          status: 'DONE',
          workedHours: ut.workedHours ?? 0,
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
      if (taskId == null || !devName) return;
      const existing = map.get(taskId);
      if (!existing) {
        map.set(taskId, [devName]);
      } else if (!existing.includes(devName)) {
        existing.push(devName);
      }
    });
    return map;
  }, [userTasks]);

  const items = useMemo(
    () => rawTasks.map((task) => mapTaskToKanban(task, developersByTaskId.get(task.id) ?? [])),
    [rawTasks, developersByTaskId]
  );

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (developerFilter !== 'all') {
        const names = item.developers?.length ? item.developers : (item.developer ? [item.developer] : []);
        if (!names.some((n) => String(n) === String(developerFilter))) return false;
      }
      if (priorityFilter !== 'all' && String(item.priority ?? '').toUpperCase() !== String(priorityFilter).toUpperCase()) return false;
      if (sprintFilter !== 'all' && String(item.sprintId) !== String(sprintFilter)) return false;
      if (!matchesDueDateRange(item, dueFrom, dueTo)) return false;
      return true;
    });
  }, [items, developerFilter, priorityFilter, sprintFilter, dueFrom, dueTo]);

  const pendingCount = useMemo(() => items.filter(i => !i.done).length, [items]);

  const hasActiveFilters =
    developerFilter !== 'all'
    || priorityFilter !== 'all'
    || sprintFilter !== 'all'
    || Boolean(dueFrom)
    || Boolean(dueTo);

  const clearAllFilters = () => {
    setDeveloperFilter('all');
    setPriorityFilter('all');
    setSprintFilter('all');
    setDueFrom('');
    setDueTo('');
  };

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px', fontSize: { xs: '1.65rem', sm: '1.85rem' } }}>
              Tasks
            </Typography>
            <Chip label={`${pendingCount} pending`} size="small"
              sx={{ mt: 1.5, bgcolor: '#FFF3E0', color: '#E65100', fontWeight: 700, fontSize: '0.72rem' }} />
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}
            sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#A83B2D' } }}>
            New task
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FAFAFA', boxShadow: 'none' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <FilterListIcon sx={{ fontSize: 26, color: ORACLE_RED }} />
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>Filter tasks</Typography>
        </Stack>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'flex-end',
            '& .MuiFormControl-root': { flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } },
          }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel>Developer</InputLabel>
            <Select value={developerFilter} onChange={e => setDeveloperFilter(e.target.value)} label="Developer">
              <MenuItem value="all">All developers</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.id ?? u.ID} value={u.name}>
                  {u.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Sprint</InputLabel>
            <Select value={sprintFilter} onChange={e => setSprintFilter(e.target.value)} label="Sprint">
              <MenuItem value="all">All sprints</MenuItem>
              {sprints.map(s => (
                <MenuItem key={s.id} value={String(s.id)}>Sprint {s.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} label="Priority">
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
            fullWidth
            sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }}
          />
          <TextField
            size="small"
            type="date"
            label="Due to"
            value={dueTo}
            onChange={(e) => setDueTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            sx={{ flex: '1 1 150px', minWidth: { xs: '100%', sm: 150 }, maxWidth: { sm: 200 } }}
          />
          {hasActiveFilters ? (
            <Button
              size="small"
              variant="outlined"
              onClick={clearAllFilters}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#BDBDBD',
                color: '#424242',
                flexShrink: 0,
                alignSelf: { xs: 'stretch', sm: 'center' },
                minHeight: 40,
              }}
            >
              Clear filters
            </Button>
          ) : null}
          <Chip label={`${filteredItems.length} shown`} size="small"
            sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 24, fontSize: '0.72rem', alignSelf: { xs: 'flex-start', sm: 'center' } }} />
        </Box>
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: ORACLE_RED }} />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Box sx={{ width: 10, height: 10, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#1A1A1A', letterSpacing: '-0.02em' }}>Kanban board</Typography>
              <Chip label={filteredItems.length} size="small"
                sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
            </Box>
            <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
              <KanbanBoard items={filteredItems} onStatusChange={handleStatusChange} />
            </Paper>
          </Grid>
        </Grid>
      )}

      <Dialog
        open={multiDoneTaskId != null}
        onClose={() => setMultiDoneTaskId(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Complete each assignment</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            The task moves to Done only when every developer assigned has been marked complete (the task counts once in sprint metrics, not once per assignee).
          </Alert>
          <Typography variant="body2" sx={{ mb: 2, fontWeight: 600, color: '#1A1A1A' }}>
            {multiDoneTaskId != null
              ? (rawTasks.find((t) => t.id === multiDoneTaskId)?.title || `Task #${multiDoneTaskId}`)
              : ''}
          </Typography>
          <Stack spacing={1.5}>
            {multiDoneTaskId != null
              ? userTasks
                .filter((ut) => Number(ut?.task?.id ?? ut?.id?.taskId) === Number(multiDoneTaskId))
                .map((ut) => {
                  const done = String(ut.status || '').toUpperCase() === 'DONE';
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
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setMultiDoneTaskId(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Close
          </Button>
        </DialogActions>
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
        sprints={sprints}
        users={users}
      />
    </Box>
  );
}