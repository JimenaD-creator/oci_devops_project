import React from 'react';
import {
  Box, Grid, Card, CardContent, Chip, Typography,
  LinearProgress, Table, TableBody, TableCell, TableContainer, TableRow,
  Paper, CircularProgress, IconButton, Button, Badge,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import RefreshIcon from '@mui/icons-material/Refresh';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import NewItem from '../NewItem';
import SummaryCards from './SummaryCards';
import KPICards from './KPICards';

export default function DashboardPage({ items, isLoading, isInserting, toggleDone, deleteItem, addItem }) {
  const total = items.length;
  const doneCount = items.filter(i => i.done).length;
  const pendingCount = items.filter(i => !i.done).length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 78;

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}>
            Dashboard — Mobile App Development
          </Typography>
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
            Sprint 12 · Abril 8–22, 2024
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small"
            sx={{ borderColor: '#DDD', color: '#555', textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
            Refresh
          </Button>
          <IconButton sx={{ bgcolor: 'white', border: '1px solid #EEE', borderRadius: 2 }}>
            <Badge badgeContent={3} color="error">
              <NotificationsIcon sx={{ fontSize: 20 }} />
            </Badge>
          </IconButton>
        </Box>
      </Box>

      <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Mobile App Development</Typography>
              <Chip label="Activo" size="small"
                sx={{ bgcolor: '#E8F5E9', color: '#2E7D32', fontWeight: 700, fontSize: '0.72rem' }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GroupIcon sx={{ fontSize: 16, color: '#999' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#999', display: 'block', lineHeight: 1 }}>Equipo</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>5 devs</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AssignmentIcon sx={{ fontSize: 16, color: '#999' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#999', display: 'block', lineHeight: 1 }}>Sprint</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>#12</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: '#888', mb: 2 }}>
            Enterprise mobile application for client management
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#555' }}>Progreso del proyecto</Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#E53935' }}>{progress}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress}
            sx={{ height: 10, borderRadius: 5, bgcolor: '#F0F0F0',
              '& .MuiLinearProgress-bar': { bgcolor: '#E53935', borderRadius: 5 } }} />
        </CardContent>
      </Card>
      <SummaryCards completedTasksCount={doneCount} />
      <KPICards />

      <Paper sx={{ p: 3, borderRadius: 3, mb: 3, border: '1px solid #EFEFEF', boxShadow: 'none' }}>
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>Agregar Nueva Tarea</Typography>
        <NewItem addItem={addItem} isInserting={isInserting} />
      </Paper>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress color="error" /></Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Box sx={{ width: 8, height: 8, bgcolor: '#E53935', borderRadius: '50%' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Active Backlog</Typography>
              <Chip label={pendingCount} size="small"
                sx={{ ml: 'auto', bgcolor: '#F5F5F5', fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none' }}>
              <Table>
                <TableBody>
                  {items.filter(i => !i.done).map((item) => (
                    <TableRow key={item.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ py: 2, fontWeight: 500, fontSize: '0.9rem' }}>{item.description}</TableCell>
                      <TableCell align="right">
                        <Button variant="text" size="small"
                          sx={{ color: '#E53935', fontWeight: 700, textTransform: 'none' }}
                          onClick={(e) => toggleDone(e, item.id, item.description, true)}>
                          Completar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.filter(i => !i.done).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} sx={{ textAlign: 'center', py: 4, color: '#BBB' }}>
                        No hay tareas pendientes
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
              <Box sx={{ width: 8, height: 8, bgcolor: '#4CAF50', borderRadius: '50%' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Completadas</Typography>
              <Chip label={doneCount} size="small"
                sx={{ ml: 'auto', bgcolor: '#F0FFF4', color: '#2E7D32', fontWeight: 700, height: 20, fontSize: '0.7rem' }} />
            </Box>
            <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: 'none', bgcolor: '#FAFAFA' }}>
              <Table>
                <TableBody>
                  {items.filter(i => i.done).map((item) => (
                    <TableRow key={item.id} sx={{ '&:last-child td': { border: 0 } }}>
                      <TableCell sx={{ color: '#AAA', textDecoration: 'line-through', fontSize: '0.9rem' }}>
                        {item.description}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <IconButton size="small" onClick={(e) => toggleDone(e, item.id, item.description, false)} color="primary">
                          <UndoIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => deleteItem(item.id)} sx={{ color: '#FF5252' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.filter(i => i.done).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} sx={{ textAlign: 'center', py: 4, color: '#BBB' }}>
                        Aún no hay tareas completadas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
