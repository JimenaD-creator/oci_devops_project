import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Grid, Typography, Paper, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Stack, Button, Dialog, DialogTitle, DialogContent, IconButton,
  DialogActions,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import KanbanBoard from '../components/tasks/KanbanBoard';

const ORACLE_RED = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

function mapTaskToKanban(task, developer = null) {
  const statusMap = {
    'DONE':        'done',
    'IN_PROGRESS': 'in_progress',
    'IN_REVIEW':   'in_review',
    'PENDING':     'todo',
    'TODO':        'todo',
  };
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
    developer,
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
  const [assignedTo, setAssignedTo] = useState('');
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
    setAssignedTo('');
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
    if (!title.trim() || !description.trim() || !classification || !status || !priority || !startDate || !dueDate || !sprintId || !assignedTo) {
      setError('Please fill in all required fields.');
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
        const assignRes = await fetch(`${API_BASE}/api/user-tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: Number(assignedTo),
            taskId: created.id,
            workedHours: assignedHours ? Number(assignedHours) : 0,
            status,
          }),
        });
        if (!assignRes.ok) {
          setError('Task created, but assignment failed. Please retry assignment.');
          return;
        }
        onCreated(created, Number(assignedTo), status, assignedHours ? Number(assignedHours) : 0);
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

  const canSave = Boolean(title.trim() && description.trim() && classification && status && priority && startDate && dueDate && sprintId && assignedTo);

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
          border: '1px solid #E5E5E5',
          boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
          width: 'min(820px, calc(100vw - 32px))',
          maxWidth: '820px',
          minHeight: 390,
          overflow: 'visible',
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
            borderBottom: '1px solid #F0F0F0',
            bgcolor: '#FAFAFA',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: 'rgba(199,70,52,0.10)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TaskAltIcon sx={{ color: ORACLE_RED }} />
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A1A1A' }}>Create task</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={saving} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          pt: 2.75,
          px: 2.5,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 780, mt: 0.75 }}>
          <TextField
            label="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            size="small"
          />
          <TextField
            label="Task description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            size="small"
          />
          <Stack direction="row" spacing={2}>
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
                <MenuItem value="TODO">To Do</MenuItem>
                <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                <MenuItem value="IN_REVIEW">In Review</MenuItem>
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

          <Stack direction="row" spacing={2}>
            <FormControl size="small" fullWidth>
              <InputLabel>Sprint</InputLabel>
              <Select value={sprintId} onChange={(e) => setSprintId(e.target.value)} label="Sprint">
                {sprints.map((s) => (
                  <MenuItem key={s.id} value={s.id}>{`Sprint ${s.id}`}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Assigned to</InputLabel>
              <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} label="Assigned to">
                {users.map((u) => (
                  <MenuItem key={u.id ?? u.ID} value={u.id ?? u.ID}>
                    {u.name}
                  </MenuItem>
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

          <Stack direction="row" spacing={2}>
            <TextField
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <TextField
              label="Due date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
          </Stack>

          {error ? (
            <Typography variant="caption" sx={{ color: '#C62828', fontWeight: 600 }}>
              {error}
            </Typography>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.25, pt: 1.25 }}>
        <Button onClick={handleClose} sx={{ color: '#666', textTransform: 'none', fontWeight: 600 }} disabled={saving}>
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
    const task = rawTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...task, status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRawTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      }
    } catch (e) {
      console.error('Error updating task status:', e);
    }
  };

  const developerByTaskId = useMemo(() => {
    const map = new Map();
    userTasks.forEach((ut) => {
      const taskId = ut?.task?.id ?? ut?.id?.taskId;
      const devName = ut?.user?.name;
      if (taskId != null && devName && !map.has(taskId)) {
        map.set(taskId, devName);
      }
    });
    return map;
  }, [userTasks]);

  const items = useMemo(
    () => rawTasks.map((task) => mapTaskToKanban(task, developerByTaskId.get(task.id) ?? null)),
    [rawTasks, developerByTaskId]
  );

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (developerFilter !== 'all' && String(item.developer ?? '') !== String(developerFilter)) return false;
      if (priorityFilter !== 'all' && String(item.priority ?? '').toUpperCase() !== String(priorityFilter).toUpperCase()) return false;
      if (sprintFilter !== 'all' && String(item.sprintId) !== String(sprintFilter)) return false;
      if (dueFrom && item.dueDate && new Date(item.dueDate) < new Date(dueFrom)) return false;
      if (dueTo && item.dueDate && new Date(item.dueDate) > new Date(dueTo)) return false;
      return true;
    });
  }, [items, developerFilter, priorityFilter, sprintFilter, dueFrom, dueTo]);

  const pendingCount = useMemo(() => items.filter(i => !i.done).length, [items]);

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>Tasks</Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 0.75, fontWeight: 500 }}>
              Manage project tasks: filter, complete, and track work in one place.
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
          <FilterListIcon sx={{ fontSize: 22, color: ORACLE_RED }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#1A1A1A' }}>Filter tasks</Typography>
        </Stack>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end',
          '& .MuiFormControl-root': { flex: '1 1 160px', minWidth: { xs: '100%', sm: 160 }, maxWidth: { sm: 220 } } }}>
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
          <TextField size="small" type="date" label="Due from" value={dueFrom}
            onChange={e => setDueFrom(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth
            sx={{ flex: '1 1 160px !important', maxWidth: { sm: 220 } }} />
          <TextField size="small" type="date" label="Due to" value={dueTo}
            onChange={e => setDueTo(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth
            sx={{ flex: '1 1 160px !important', maxWidth: { sm: 220 } }} />
          <Chip label={`${filteredItems.length} shown`} size="small"
            sx={{ bgcolor: '#F0F0F0', fontWeight: 700, height: 24, fontSize: '0.72rem' }} />
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
              <Box sx={{ width: 8, height: 8, bgcolor: ORACLE_RED, borderRadius: '50%' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Kanban board</Typography>
              <Chip label={filteredItems.length} size="small"
                sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
            </Box>
            <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF', overflow: 'hidden' }}>
              <KanbanBoard items={filteredItems} onStatusChange={handleStatusChange} />
            </Paper>
          </Grid>
        </Grid>
      )}

      <NewTaskDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(task, assignedUserId, assignmentStatus, workedHours) => {
          const user = users.find((u) => Number(u.id ?? u.ID) === Number(assignedUserId));
          setRawTasks((prev) => [...prev, task]);
          setUserTasks((prev) => [
            ...prev,
            {
              id: { userId: assignedUserId, taskId: task.id },
              user: user ?? null,
              task,
              status: assignmentStatus,
              workedHours,
            },
          ]);
        }}
        sprints={sprints}
        users={users}
      />
    </Box>
  );
}