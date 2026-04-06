import React, { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, Avatar, AvatarGroup, IconButton, Divider, Paper
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';

const SPRINTS = [
  {
    id: 12,
    name: 'Sprint 12',
    status: 'active',
    goal: 'Completar módulo de autenticación y dashboard principal',
    startDate: 'Abr 8, 2024',
    endDate: 'Abr 22, 2024',
    progress: 78,
    totalTasks: 24,
    doneTasks: 18,
    inProgressTasks: 4,
    blockedTasks: 2,
    team: ['AL', 'ES', 'JD', 'MR', 'CP'],
    velocity: 42,
    burndown: 'on-track',
  },
  {
    id: 11,
    name: 'Sprint 11',
    status: 'completed',
    goal: 'Integración con API de Oracle Cloud y pruebas de carga',
    startDate: 'Mar 25, 2024',
    endDate: 'Abr 7, 2024',
    progress: 100,
    totalTasks: 20,
    doneTasks: 20,
    inProgressTasks: 0,
    blockedTasks: 0,
    team: ['AL', 'ES', 'JD', 'MR'],
    velocity: 38,
    burndown: 'completed',
  },
  {
    id: 10,
    name: 'Sprint 10',
    status: 'completed',
    goal: 'Diseño e implementación del sistema de notificaciones',
    startDate: 'Mar 11, 2024',
    endDate: 'Mar 24, 2024',
    progress: 100,
    totalTasks: 18,
    doneTasks: 17,
    inProgressTasks: 0,
    blockedTasks: 0,
    team: ['AL', 'ES', 'CP'],
    velocity: 35,
    burndown: 'completed',
  },
  {
    id: 13,
    name: 'Sprint 13',
    status: 'planned',
    goal: 'Módulo de reportes y exportación de datos',
    startDate: 'Abr 23, 2024',
    endDate: 'May 6, 2024',
    progress: 0,
    totalTasks: 22,
    doneTasks: 0,
    inProgressTasks: 0,
    blockedTasks: 0,
    team: ['AL', 'ES', 'JD', 'MR', 'CP'],
    velocity: null,
    burndown: 'pending',
  },
];

const BACKLOG_ITEMS = [
  { id: 1, title: 'Implementar filtros avanzados en la lista de tareas', priority: 'high', points: 5 },
  { id: 2, title: 'Agregar soporte para dark mode', priority: 'medium', points: 3 },
  { id: 3, title: 'Optimizar queries de base de datos Oracle ATP', priority: 'high', points: 8 },
  { id: 4, title: 'Integración con Telegram Bot para notificaciones', priority: 'medium', points: 5 },
  { id: 5, title: 'Panel de administración para gestión de usuarios', priority: 'low', points: 13 },
  { id: 6, title: 'Exportar reportes en formato PDF/Excel', priority: 'medium', points: 5 },
];

const STATUS_CONFIG = {
  active:    { label: 'Activo',     color: '#E8F5E9', textColor: '#2E7D32' },
  completed: { label: 'Completado', color: '#EEF2FF', textColor: '#3730A3' },
  planned:   { label: 'Planeado',   color: '#FFF8E1', textColor: '#F57F17' },
};

const PRIORITY_CONFIG = {
  high:   { label: 'Alta',   color: '#FFF1F0', textColor: '#C62828' },
  medium: { label: 'Media',  color: '#FFF8E1', textColor: '#F57F17' },
  low:    { label: 'Baja',   color: '#F0FFF4', textColor: '#2E7D32' },
};

const AVATAR_COLORS = ['#E53935', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA'];

function SprintCard({ sprint, isSelected, onClick }) {
  const statusCfg = STATUS_CONFIG[sprint.status];
  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 3,
        border: isSelected ? '2px solid #E53935' : '1px solid #EFEFEF',
        boxShadow: isSelected ? '0 4px 16px rgba(229,57,53,0.12)' : '0 2px 8px rgba(0,0,0,0.04)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': { boxShadow: '0 4px 16px rgba(0,0,0,0.08)', transform: 'translateY(-1px)' },
        bgcolor: isSelected ? '#FFFAFA' : 'white',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1rem' }}>{sprint.name}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <CalendarTodayIcon sx={{ fontSize: 12, color: '#AAA' }} />
              <Typography variant="caption" sx={{ color: '#999' }}>
                {sprint.startDate} → {sprint.endDate}
              </Typography>
            </Box>
          </Box>
          <Chip label={statusCfg.label} size="small"
            sx={{ bgcolor: statusCfg.color, color: statusCfg.textColor, fontWeight: 700, fontSize: '0.7rem' }} />
        </Box>

        <Typography variant="body2" sx={{ color: '#666', mb: 2, fontSize: '0.82rem', lineHeight: 1.5 }}>
          {sprint.goal}
        </Typography>

        {sprint.status !== 'planned' && (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>Progreso</Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, color: sprint.progress === 100 ? '#2E7D32' : '#E53935' }}>
                {sprint.progress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={sprint.progress}
              sx={{
                height: 6, borderRadius: 3, bgcolor: '#F0F0F0', mb: 2,
                '& .MuiLinearProgress-bar': {
                  bgcolor: sprint.progress === 100 ? '#4CAF50' : '#E53935', borderRadius: 3
                }
              }} />
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>{sprint.doneTasks}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: '#E53935' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#555' }}>
                {sprint.totalTasks - sprint.doneTasks}
              </Typography>
            </Box>
          </Box>
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.6rem', fontWeight: 700 } }}>
            {sprint.team.map((initials, i) => (
              <Avatar key={i} sx={{ bgcolor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>{initials}</Avatar>
            ))}
          </AvatarGroup>
        </Box>
      </CardContent>
    </Card>
  );
}

function SprintDetail({ sprint }) {
  const tasks = [
    { title: 'Setup autenticación JWT con Spring Security', status: 'done', assignee: 'ES', points: 5 },
    { title: 'Diseño de pantallas en Figma', status: 'done', assignee: 'AL', points: 3 },
    { title: 'Implementar endpoint /api/auth/login', status: 'done', assignee: 'ES', points: 3 },
    { title: 'Conexión con Oracle ATP desde Spring Boot', status: 'done', assignee: 'JD', points: 8 },
    { title: 'Componente Dashboard en React', status: 'in-progress', assignee: 'MR', points: 5 },
    { title: 'Pruebas unitarias del módulo auth', status: 'in-progress', assignee: 'CP', points: 3 },
    { title: 'Configurar Kubernetes en OCI', status: 'blocked', assignee: 'ES', points: 8 },
    { title: 'Integrar Telegram Bot webhook', status: 'todo', assignee: 'JD', points: 5 },
    { title: 'Documentación de API con Swagger', status: 'todo', assignee: 'AL', points: 2 },
  ];

  const statusIcon = {
    'done': <CheckCircleIcon sx={{ fontSize: 16, color: '#4CAF50' }} />,
    'in-progress': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#1E88E5' }} />,
    'blocked': <PauseCircleIcon sx={{ fontSize: 16, color: '#E53935' }} />,
    'todo': <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: '#CCC' }} />,
  };

  const statusLabel = {
    'done': { label: 'Listo', bg: '#F0FFF4', color: '#2E7D32' },
    'in-progress': { label: 'En progreso', bg: '#E3F2FD', color: '#1565C0' },
    'blocked': { label: 'Bloqueado', bg: '#FFF1F0', color: '#C62828' },
    'todo': { label: 'Por hacer', bg: '#F5F5F5', color: '#757575' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{sprint.name} — Detalle</Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>{sprint.startDate} → {sprint.endDate}</Typography>
        </Box>
        {sprint.status === 'active' && (
          <Button variant="contained" size="small" startIcon={<AddIcon />}
            sx={{ bgcolor: '#E53935', textTransform: 'none', fontWeight: 700, borderRadius: 2,
              '&:hover': { bgcolor: '#C62828' } }}>
            Nueva Tarea
          </Button>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total', value: sprint.totalTasks, color: '#555' },
          { label: 'Completadas', value: sprint.doneTasks, color: '#2E7D32' },
          { label: 'En progreso', value: sprint.inProgressTasks, color: '#1565C0' },
          { label: 'Bloqueadas', value: sprint.blockedTasks, color: '#C62828' },
          { label: 'Velocidad', value: sprint.velocity ? `${sprint.velocity} pts` : '—', color: '#555' },
        ].map((s) => (
          <Grid item xs key={s.label}>
            <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid #EFEFEF', boxShadow: 'none', textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#AAA' }}>{s.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none', overflow: 'hidden' }}>
        {tasks.map((task, i) => (
          <Box key={i}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 3, py: 2, gap: 2,
              '&:hover': { bgcolor: '#FAFAFA' }, transition: 'background 0.1s' }}>
              {statusIcon[task.status]}
              <Typography variant="body2" sx={{
                flexGrow: 1, fontWeight: 500,
                color: task.status === 'done' ? '#AAA' : '#1A1A1A',
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
              }}>
                {task.title}
              </Typography>
              <Chip label={statusLabel[task.status].label} size="small" sx={{
                bgcolor: statusLabel[task.status].bg,
                color: statusLabel[task.status].color,
                fontWeight: 600, fontSize: '0.68rem', height: 20,
              }} />
              <Avatar sx={{ width: 24, height: 24, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: AVATAR_COLORS[['ES','AL','JD','MR','CP'].indexOf(task.assignee) % AVATAR_COLORS.length] }}>
                {task.assignee}
              </Avatar>
              <Chip label={`${task.points} pts`} size="small"
                sx={{ bgcolor: '#F5F5F5', color: '#888', fontWeight: 600, fontSize: '0.68rem', height: 20 }} />
            </Box>
            {i < tasks.length - 1 && <Divider />}
          </Box>
        ))}
      </Paper>
    </Box>
  );
}

export default function SprintsPage() {
  const [selectedSprint, setSelectedSprint] = useState(SPRINTS[0]);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>
            Sprints
          </Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
            Mobile App Development · 4 sprints en total
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          sx={{ bgcolor: '#E53935', textTransform: 'none', fontWeight: 700, borderRadius: 2,
            '&:hover': { bgcolor: '#C62828' } }}>
          Nuevo Sprint
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SPRINTS.map((sprint) => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                isSelected={selectedSprint?.id === sprint.id}
                onClick={() => setSelectedSprint(sprint)}
              />
            ))}
          </Box>

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: '#555' }}>
              Product Backlog
            </Typography>
            <Paper sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none', overflow: 'hidden' }}>
              {BACKLOG_ITEMS.map((item, i) => (
                <Box key={item.id}>
                  <Box sx={{ px: 2.5, py: 1.5, '&:hover': { bgcolor: '#FAFAFA' } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem', fontWeight: 500, flexGrow: 1 }}>
                        {item.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                        <Chip label={PRIORITY_CONFIG[item.priority].label} size="small" sx={{
                          bgcolor: PRIORITY_CONFIG[item.priority].color,
                          color: PRIORITY_CONFIG[item.priority].textColor,
                          fontWeight: 700, fontSize: '0.6rem', height: 18,
                        }} />
                        <Chip label={`${item.points}p`} size="small"
                          sx={{ bgcolor: '#F5F5F5', color: '#888', fontSize: '0.6rem', height: 18 }} />
                      </Box>
                    </Box>
                  </Box>
                  {i < BACKLOG_ITEMS.length - 1 && <Divider />}
                </Box>
              ))}
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={8}>
          {selectedSprint
            ? <SprintDetail sprint={selectedSprint} />
            : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <Typography variant="body1" sx={{ color: '#CCC' }}>Selecciona un sprint para ver el detalle</Typography>
              </Box>
            )
          }
        </Grid>
      </Grid>
    </Box>
  );
}