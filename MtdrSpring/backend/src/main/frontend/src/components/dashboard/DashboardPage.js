import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography,
  LinearProgress, Paper, IconButton, Button, Badge,
  FormGroup, FormControlLabel, Stack, Checkbox, CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import SummaryCards from './SummaryCards';
import SprintComparisonCharts from './SprintComparisonCharts';
import DeveloperWorkloadCharts from '../analytics/DeveloperWorkloadCharts';
import DeveloperTable from '../analytics/DeveloperTable';
import { fetchDashboardSprints } from './dashboardSprintData';

const ORACLE_RED = '#C74634';

export default function DashboardPage() {
  const [allSprints, setAllSprints] = useState([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [selectedSprintIds, setSelectedSprintIds] = useState([]);

  // Carga inicial de datos desde el Backend (vía dashboardSprintData)
  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = () => {
    setSprintsLoading(true);
    fetchDashboardSprints()
      .then((sprints) => {
        setAllSprints(sprints);
        if (sprints.length > 0 && selectedSprintIds.length === 0) {
          // Seleccionar por defecto el último sprint activo
          const active = sprints.find((s) => s.status === 'active') ?? sprints[sprints.length - 1];
          setSelectedSprintIds([active.id]);
        }
      })
      .finally(() => setSprintsLoading(false));
  };

  const selectedSprints = useMemo(
    () => allSprints
      .filter((s) => selectedSprintIds.includes(s.id))
      .sort((a, b) => selectedSprintIds.indexOf(a.id) - selectedSprintIds.indexOf(b.id)),
    [selectedSprintIds, allSprints]
  );

  const compareMode = selectedSprints.length > 1;
  const primarySprint = selectedSprints[0];

  // Conteo de desarrolladores únicos basados en la relación USERS/USER_TASK
  const teamDeveloperCount = useMemo(
    () => new Set(selectedSprints.flatMap((s) => (s.developers || []).map((d) => d.name))).size,
    [selectedSprints]
  );

  const heroProgress = useMemo(() => {
    if (!primarySprint) return 0;
    if (compareMode) {
      const avg = selectedSprints.reduce((a, s) => a + (s.kpis?.completionRate || 0), 0) / selectedSprints.length;
      return Math.round(avg);
    }
    if (!primarySprint.totalTasks) return 0;
    return Math.round((primarySprint.totalCompleted / primarySprint.totalTasks) * 100);
  }, [primarySprint, compareMode, selectedSprints]);

  const toggleSprint = (id, checked) => {
    setSelectedSprintIds((prev) => {
      if (checked) return [...new Set([...prev, id])];
      if (prev.length <= 1) return prev; // Mantener al menos uno seleccionado
      return prev.filter((x) => x !== id);
    });
  };

  if (sprintsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: ORACLE_RED }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%', mx: 'auto', p: 2 }}>
      {/* Header del Dashboard */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, border: '1px solid #ECECEC', bgcolor: '#FFFFFF' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A' }}>
              Productivity Analytics
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', fontWeight: 500 }}>
              {compareMode ? 'Multi-Sprint Comparison' : `${primarySprint?.name} Overview`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={handleRefresh} size="small" sx={{ borderRadius: 2, color: '#555' }}>
              Sync Data
            </Button>
            <IconButton sx={{ bgcolor: '#F5F5F5' }}><Badge badgeContent={1} color="error"><NotificationsIcon /></Badge></IconButton>
          </Stack>
        </Box>
      </Paper>

      {/* Selector de Sprints */}
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Sprints en Base de Datos:</Typography>
        <FormGroup row>
          {allSprints.map((sp) => (
            <FormControlLabel
              key={sp.id}
              control={<Checkbox size="small" checked={selectedSprintIds.includes(sp.id)} onChange={(e) => toggleSprint(sp.id, e.target.checked)} sx={{ '&.Mui-checked': { color: ORACLE_RED } }} />}
              label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{sp.name}</Typography>}
            />
          ))}
        </FormGroup>
      </Paper>

      {/* Tarjetas de Resumen */}
      {!compareMode ? (
        <SummaryCards 
          completedTasksCount={primarySprint?.totalCompleted ?? 0}
          totalHoursDisplay={Number(primarySprint?.totalHours || 0).toFixed(1)}
          pendingTasksCount={Math.max(0, (primarySprint?.totalTasks || 0) - (primarySprint?.totalCompleted || 0))}
        />
      ) : (
        <SprintComparisonCharts selectedSprints={selectedSprints} />
      )}

      {/* Barra de Progreso General */}
      <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{primarySprint?.name || 'Project Progress'}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon sx={{ fontSize: 18, color: '#757575' }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{teamDeveloperCount} devs</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Completion Rate</Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: ORACLE_RED }}>{heroProgress}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={heroProgress} sx={{ height: 10, borderRadius: 5, bgcolor: '#F0F0F0', '& .MuiLinearProgress-bar': { bgcolor: ORACLE_RED } }} />
        </CardContent>
      </Card>

      {/* Gráficas de Carga de Trabajo (Basadas en USERS_TASK) */}
      <DeveloperWorkloadCharts selectedSprints={selectedSprints} />

      {/* Tabla de Productividad (Breakdown) */}
      <Box sx={{ mt: 3 }}>
        <DeveloperTable selectedSprints={selectedSprints} compareMode={compareMode} />
      </Box>
    </Box>
  );
}