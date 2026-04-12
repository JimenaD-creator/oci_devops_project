import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, Avatar, AvatarGroup, IconButton, Divider, Paper,
  CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Select, FormControl, InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import RefreshIcon from '@mui/icons-material/Refresh';

const ORACLE_RED = '#E53935';
const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const STATUS_CONFIG = {
  active:    { label: 'En Curso',   color: '#E8F5E9', textColor: '#2E7D32' },
  completed: { label: 'Completado', color: '#EEF2FF', textColor: '#3730A3' },
  planned:   { label: 'Planeado',   color: '#FFF8E1', textColor: '#F57F17' },
};

const AVATAR_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

function inferStatus(sprint) {
  const now = new Date();
  const start = new Date(sprint.startDate);
  const due = new Date(sprint.dueDate);
  if (now < start) return 'planned';
  if (now > due) return 'completed';
  return 'active';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function SprintCard({ sprint, tasks, isSelected, onClick }) {
  const status = inferStatus(sprint);
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
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1rem' }}>Sprint {sprint.id}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} />
              <Typography variant="caption" sx={{ color: '#999' }}>
                {formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}
              </Typography>
            </Box>
          </Box>
          <Chip label={statusCfg.label} size="small"
            sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>

        {status !== 'planned' && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progreso</Typography>
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
            {total} tareas · {Math.round((sprint.completionRate ?? 0) * 100)}% KPI
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function SprintDetail({ sprint, tasks, onTaskStatusChange }) {
  const status = inferStatus(sprint);
  const sprintTasks = tasks.filter(t => t.assignedSprint?.id === sprint.id);
  const done = sprintTasks.filter(t => t.status === 'DONE').length;
  const inProgress = sprintTasks.filter(t => t.status === 'IN_PROGRESS').length;
  const pending = sprintTasks.filter(t => t.status === 'PENDING' || t.status === 'TODO').length;
  const total = sprintTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : Math.round((sprint.completionRate ?? 0) * 100);

  const statusIcon = {
    'DONE': <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />,
    'IN_PROGRESS': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#1E88E5' }} />,
    'PENDING': <PauseCircleIcon sx={{ fontSize: 16, color: ORACLE_RED }} />,
    'TODO': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#CCC' }} />,
  };

  const statusLabel = {
    'DONE':        { label: 'Listo',       bg: '#F0FFF4', color: '#2E7D32' },
    'IN_PROGRESS': { label: 'En progreso', bg: '#E3F2FD', color: '#1565C0' },
    'PENDING':     { label: 'Pendiente',   bg: '#FFF1F0', color: '#C62828' },
    'TODO':        { label: 'Por hacer',   bg: '#F5F5F5', color: '#757575' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Sprint {sprint.id} — Detalle</Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
            {formatDate(sprint.startDate)} → {formatDate(sprint.dueDate)}
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total',       value: total,      color: '#555' },
          { label: 'Completadas', value: done,        color: '#2E7D32' },
          { label: 'En progreso', value: inProgress,  color: '#1565C0' },
          { label: 'Pendientes',  value: pending,     color: '#C62828' },
          { label: 'Completado',  value: `${progress}%`, color: ORACLE_RED },
        ].map((s) => (
          <Grid item xs key={s.label}>
            <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #EFEFEF', boxShadow: 'none', textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#AAA' }}>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#555' }}>Progreso del sprint</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800, color: ORACLE_RED }}>{progress}%</Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{
          height: 10, borderRadius: 5, bgcolor: '#F0F0F0',
          '& .MuiLinearProgress-bar': { bgcolor: ORACLE_RED, borderRadius: 5 }
        }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
          <Typography variant="caption" sx={{ color: '#AAA' }}>Inicio: {formatDate(sprint.startDate)}</Typography>
          <Typography variant="caption" sx={{ color: '#AAA' }}>Fin: {formatDate(sprint.dueDate)}</Typography>
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none', overflow: 'hidden' }}>
        {sprintTasks.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#CCC' }}>No hay tareas en este sprint</Typography>
          </Box>
        ) : sprintTasks.map((task, i) => (
          <Box key={task.id}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, gap: 2,
              '&:hover': { bgcolor: '#FAFAFA' }, transition: 'background 0.1s' }}>
              {statusIcon[task.status] ?? statusIcon['TODO']}
              <Typography variant="body2" sx={{
                flexGrow: 1, fontWeight: 500,
                color: task.status === 'DONE' ? '#AAA' : '#1A1A1A',
                textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
              }}>
                {task.classification}
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
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!startDate || !dueDate) return;
    setSaving(true);
    try {
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
        }),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        onClose();
        setStartDate('');
        setDueDate('');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Nuevo Sprint</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        <TextField
          label="Fecha de inicio"
          type="date"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
        <TextField
          label="Fecha de fin"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: '#888', textTransform: 'none' }}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving || !startDate || !dueDate} variant="contained"
          sx={{ bgcolor: ORACLE_RED, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#C62828' } }}>
          {saving ? 'Guardando...' : 'Crear Sprint'}
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
    const sorted = [...sprintsList].sort((a, b) => b.id - a.id);
    setSprints(sorted);
    setTasks(tasksList);
    setSelectedSprint(prev =>
      prev ? sorted.find(s => s.id === prev.id) ?? sorted[0] : sorted.find(s => inferStatus(s) === 'active') ?? sorted[0]
    );
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { loadData(); }, []);

  const handleSprintCreated = (newSprint) => {
    setSprints(prev => [newSprint, ...prev]);
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
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>
            Sprints
          </Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
            {sprints[0]?.assignedProject?.name ?? 'Project'} · {sprints.length} sprints en total
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
            Crear Nuevo Sprint
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={4}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#555', mb: 1.5 }}>
            Historial de Sprints
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
            <SprintDetail sprint={selectedSprint} tasks={tasks} />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
              <Typography variant="body1" sx={{ color: '#CCC' }}>
                Selecciona un sprint para ver el detalle
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
    </Box>
  );
}