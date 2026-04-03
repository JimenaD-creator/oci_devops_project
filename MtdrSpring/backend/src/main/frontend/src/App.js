import React, { useState, useEffect } from 'react';
import NewItem from './NewItem';
import API_LIST from './API';
import SprintsPage from './SprintsPage';

import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  Typography, Grid, Card, CardContent, Chip,
  LinearProgress, Avatar, Table, TableBody, TableCell,
  TableContainer, TableRow, Paper, CircularProgress, IconButton, Button,
  Badge
} from '@mui/material';

import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import DeleteIcon from '@mui/icons-material/Delete';
import UndoIcon from '@mui/icons-material/Undo';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupIcon from '@mui/icons-material/Group';
import BalanceIcon from '@mui/icons-material/Balance';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AnalyticsIcon from '@mui/icons-material/Analytics';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { text: 'Dashboard',     icon: <DashboardIcon />,   id: 'dashboard' },
  { text: 'Sprints',       icon: <AssignmentIcon />,  id: 'sprints' },
  { text: 'Tareas',        icon: <TaskAltIcon />,     id: 'tareas' },
  { text: 'Equipo',        icon: <GroupsIcon />,      id: 'equipo' },
  { text: 'Analytics',     icon: <AnalyticsIcon />,   id: 'analytics' },
  { text: 'AI Insights',   icon: <AutoAwesomeIcon />, id: 'ai', badge: 'NEW' },
  { text: 'Configuración', icon: <SettingsIcon />,    id: 'config' },
];

const getInitials = (name) => {
  if (!name) return "";
  const parts = name.split(" ");
  let initials = "";
  for (let i = 0; i < Math.min(parts.length, 2); i++) {
    if (parts[i].length > 0) {
      initials += parts[i][0].toUpperCase();
    }
  }
  return initials;
};

function StatCard({ icon, value, label, trend, trendLabel }) {
  const isPositive = trend >= 0;
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            bgcolor: '#FFF1F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E53935'
          }}>
            {icon}
          </Box>
          <Chip
            size="small"
            icon={isPositive ? <TrendingUpIcon style={{ fontSize: 12 }} /> : <TrendingDownIcon style={{ fontSize: 12 }} />}
            label={`${isPositive ? '+' : ''}${trend}%`}
            sx={{
              fontSize: '0.7rem', fontWeight: 700, height: 22,
              bgcolor: isPositive ? '#F0FFF4' : '#FFF5F5',
              color: isPositive ? '#2E7D32' : '#C62828',
              '& .MuiChip-icon': { color: 'inherit' }
            }}
          />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1A1A1A', mb: 0.5 }}>{value}</Typography>
        <Typography variant="body2" sx={{ color: '#555', fontWeight: 500 }}>{label}</Typography>
        <Typography variant="caption" sx={{ color: '#BBB' }}>{trendLabel}</Typography>
      </CardContent>
    </Card>
  );
}

function DashboardPage({ items, isLoading, isInserting, toggleDone, deleteItem, addItem }) {
  const total = items.length;
  const doneCount = items.filter(i => i.done).length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 78;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
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

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <StatCard icon={<TaskAltIcon />}     value="85%" label="Task Completion Rate" trend={5}   trendLabel="vs sprint anterior" />
        </Grid>
        <Grid item xs={3}>
          <StatCard icon={<AccessTimeIcon />} value="72%" label="On-Time Delivery"     trend={-2}  trendLabel="vs sprint anterior" />
        </Grid>
        <Grid item xs={3}>
          <StatCard icon={<GroupIcon />}       value="88%" label="Team Participation"   trend={3}   trendLabel="vs sprint anterior" />
        </Grid>
        <Grid item xs={3}>
          <StatCard icon={<BalanceIcon />}     value="0.92" label="Workload Balance"    trend={0.1} trendLabel="índice de balance" />
        </Grid>
      </Grid>

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
              <Chip label={items.filter(i => !i.done).length} size="small"
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
                        No hay tareas pendientes 🎉
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

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoading, setLoading] = useState(false);
  const [isInserting, setInserting] = useState(false);
  const [items, setItems] = useState([]);

  const [user, setUser] = useState({
    name: "Jimena Diaz",
    role: "Algo que no puedo decir"
  });

  useEffect(() => {
    setLoading(true);
    fetch(API_LIST)
      .then(res => res.ok ? res.json() : Promise.reject('Error'))
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleDone = (e, id, desc, done) => {
    e.preventDefault();
    fetch(`${API_LIST}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, done })
    }).then(() => setItems(items.map(x => x.id === id ? { ...x, done } : x)));
  };

  const deleteItem = (id) => {
    fetch(`${API_LIST}/${id}`, { method: 'DELETE' })
      .then(() => setItems(items.filter(i => i.id !== id)));
  };

  const addItem = (text) => {
    setInserting(true);
    fetch(API_LIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: text }),
    }).then(res => {
      if (res.ok) {
        const id = res.headers.get('location');
        setItems([{ id, description: text, done: false, createdAt: new Date() }, ...items]);
        setInserting(false);
      }
    });
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#F7F8FA', overflowX: 'hidden' }}>
      <Drawer variant="permanent" sx={{
        width: DRAWER_WIDTH, flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH, boxSizing: 'border-box',
          backgroundColor: '#1A1A1A', color: '#FFF',
          borderRight: 'none', position: 'fixed', height: '100vh',
        },
      }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #2A2A2A' }}>
          <Box sx={{
            width: 36, height: 36, bgcolor: '#E53935', borderRadius: 1.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.65rem', letterSpacing: 1 }}>ORA</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Oracle Software</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#888' }}>Manager Tool</Typography>
          </Box>
        </Box>

        <List sx={{ px: 1.5, mt: 1.5, flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItem button key={item.id} onClick={() => setActivePage(item.id)}
              sx={{
                borderRadius: '8px', mb: 0.5, py: 1.1,
                backgroundColor: activePage === item.id ? '#E53935' : 'transparent',
                '&:hover': { backgroundColor: activePage === item.id ? '#C62828' : '#2A2A2A' },
                transition: 'background-color 0.15s ease',
              }}>
              <ListItemIcon sx={{ color: activePage === item.id ? 'white' : '#777', minWidth: 38 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text}
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: activePage === item.id ? 600 : 400 }} />
              {item.badge && (
                <Chip label={item.badge} size="small"
                  sx={{ bgcolor: '#E53935', color: 'white', fontWeight: 700, fontSize: '0.6rem', height: 18 }} />
              )}
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid #2A2A2A' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#E53935', width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700 }}>
              {getInitials(user.name)}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{user.name}</Typography>
              <Typography sx={{ color: '#888', fontSize: '0.7rem' }}>{user.role}</Typography>
            </Box>
            <IconButton size="small" sx={{ color: '#666' }}><MoreVertIcon fontSize="small" /></IconButton>
          </Box>
        </Box>
      </Drawer>

      <Box component="main" sx={{
        marginLeft: `${DRAWER_WIDTH}px`,
        width: `calc(100% - ${DRAWER_WIDTH}px)`,
        minHeight: '100vh',
        p: 4,
        boxSizing: 'border-box',
      }}>
        {activePage === 'dashboard' && (
          <DashboardPage items={items} isLoading={isLoading} isInserting={isInserting}
            toggleDone={toggleDone} deleteItem={deleteItem} addItem={addItem} />
        )}
        {activePage === 'sprints' && <SprintsPage />}
        {!['dashboard', 'sprints'].includes(activePage) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#CCC', mb: 1 }}>
                {NAV_ITEMS.find(n => n.id === activePage)?.text}
              </Typography>
              <Typography variant="body2" sx={{ color: '#BBB' }}>Esta sección está en desarrollo</Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;