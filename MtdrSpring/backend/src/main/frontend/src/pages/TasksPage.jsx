import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Grid, Typography, Paper, Chip, CircularProgress,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Stack, Button, Dialog, DialogTitle, DialogContent,
  DialogActions,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import AddIcon from '@mui/icons-material/Add';
import KanbanBoard from '../components/tasks/KanbanBoard';

const ORACLE_RED = '#C74634';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

function mapTaskToKanban(task) {
  const statusMap = {
    'DONE':        'done',
    'IN_PROGRESS': 'in_progress',
    'IN_REVIEW':   'in_review',
    'PENDING':     'todo',
    'TODO':        'todo',
  };
  return {
    id: task.id,
    description: task.classification || `Task #${task.id}`,
    done: task.status === 'DONE',
    status: statusMap[task.status] ?? 'todo',
    rawStatus: task.status,
    actualHours: task.assignedHours ?? null,
    developer: null,
    dueDate: task.dueDate,
    sprintId: task.assignedSprint?.id ?? null,
    _raw: task,
  };
}

function NewTaskDialog({ open, onClose, onCreated, sprints }) {
  const [classification, setClassification] = useState('');
  const [status, setStatus] = useState('TODO');
  const [assignedHours, setAssignedHours] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!classification || !startDate || !dueDate || !sprintId) {
      setError('Todos los campos son requeridos.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classification,
          status,
          assignedHours: assignedHours ? Number(assignedHours) : null,
          startDate: new Date(startDate).toISOString(),
          dueDate: new Date(dueDate).toISOString(),
          finishDate: new Date(dueDate).toISOString(),
          assignedSprint: { id: Number(sprintId) },
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        onClose();
        setClassification(''); setStatus('TODO'); setAssignedHours('');
        setStartDate(''); setDueDate(''); setSprintId('');
      } else {
        setError('No se pudo crear la tarea. Intenta de nuevo.');
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Nueva Tarea</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Clasificación / Título"
          value={classification}
          onChange={e => setClassification(e.target.value)}
          fullWidth size="small"
        />
        <FormControl size="small" fullWidth>
          <InputLabel>Status</InputLabel>
          <Select value={status} onChange={e => setStatus(e.target.value)} label="Status">
            <MenuItem value="TODO">To Do</MenuItem>
            <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
            <MenuItem value="IN_REVIEW">In Review</MenuItem>
            <MenuItem value="PENDING">Pendiente</MenuItem>
            <MenuItem value="DONE">Done</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel>Sprint</InputLabel>
          <Select value={sprintId} onChange={e => setSprintId(e.target.value)} label="Sprint">
            {sprints.map(s => (
              <MenuItem key={s.id} value={s.id}>Sprint {s.id}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Horas asignadas"
          type="number"
          value={assignedHours}
          onChange={e => setAssignedHours(e.target.value)}
          fullWidth size="small"
        />
        <TextField
          label="Fecha de inicio"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth size="small"
        />
        <TextField
          label="Fecha de vencimiento"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth size="small"
        />
        {error && <Typography variant="caption" sx={{ color: 'red' }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#888', textTransform: 'none' }}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#A83B2D' } }}>
          {saving ? 'Guardando...' : 'Crear Tarea'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TasksPage() {
  const [rawTasks, setRawTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sprintFilter, setSprintFilter] = useState('all');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tasksRes, sprintsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks`),
        fetch(`${API_BASE}/api/sprints`),
      ]);
      setRawTasks(await tasksRes.json());
      setSprints(await sprintsRes.json());
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

  const items = useMemo(() => rawTasks.map(mapTaskToKanban), [rawTasks]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'completed' && item.rawStatus !== 'DONE') return false;
        if (statusFilter === 'pending' && item.rawStatus !== 'PENDING') return false;
        if (statusFilter === 'in_progress' && item.rawStatus !== 'IN_PROGRESS') return false;
        if (statusFilter === 'in_review' && item.rawStatus !== 'IN_REVIEW') return false;
      }
      if (sprintFilter !== 'all' && String(item.sprintId) !== String(sprintFilter)) return false;
      if (dueFrom && item.dueDate && new Date(item.dueDate) < new Date(dueFrom)) return false;
      if (dueTo && item.dueDate && new Date(item.dueDate) > new Date(dueTo)) return false;
      return true;
    });
  }, [items, statusFilter, sprintFilter, dueFrom, dueTo]);

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
            Nueva Tarea
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
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} label="Status">
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="in_review">In Review</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
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
        onCreated={(t) => setRawTasks(prev => [...prev, t])}
        sprints={sprints}
      />
    </Box>
  );
}