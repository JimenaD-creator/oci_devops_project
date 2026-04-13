import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import API_LIST, { taskAPI } from '../services/API';
import SprintsPage from '../pages/SprintsPage';
import TasksPage from '../pages/TasksPage';
import DashboardPage from '../components/dashboard/DashboardPage';
import Analytics from '../pages/KPIAnalytics';
import ProjectSelector from '../pages/ProjectSelector';

import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  Typography, Avatar, IconButton, Menu, MenuItem
} from '@mui/material';

import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

const DRAWER_WIDTH = 240;

const getInitials = (name) => {
  if (!name) return '';
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
};

function App() {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoading, setLoading] = useState(false);
  const [isInserting, setInserting] = useState(false);
  const [items, setItems] = useState([]);
  const [projectSelected, setProjectSelected] = useState(!!localStorage.getItem('selectedProjectId'));

  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return { 
        ...parsed, 
        role: (parsed.role || parsed.type || 'DEVELOPER').toUpperCase() 
      };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user && user.role === 'DEVELOPER') {
      logout();
      localStorage.clear();
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user && user.role !== 'DEVELOPER') {
      setLoading(true);
      taskAPI.getAll()
        .then(data => setItems(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!user || user.role === 'DEVELOPER') return null;

  const NAV_ITEMS = [
    { text: 'Dashboard', icon: <DashboardIcon />, id: 'dashboard', roles: ['ADMIN', 'MANAGER'] },
    { text: 'Sprints', icon: <AssignmentIcon />, id: 'sprints', roles: ['ADMIN', 'MANAGER'] },
    { text: 'Tasks', icon: <TaskAltIcon />, id: 'tasks', roles: ['ADMIN', 'MANAGER'] },
    { text: 'KPI Analytics', icon: <AnalyticsIcon />, id: 'analytics', roles: ['ADMIN', 'MANAGER'] },
    { text: 'AI Insights', icon: <AutoAwesomeIcon />, id: 'ai', roles: ['ADMIN', 'MANAGER'] },
    { text: 'Cambiar Proyecto', icon: <SwapHorizIcon />, id: 'selector', roles: ['ADMIN'] },
  ].filter(item => item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    localStorage.removeItem('selectedProjectId');
    localStorage.removeItem('selectedProjectName');
    setMenuAnchor(null);
    navigate('/login', { replace: true });
  };

  const addItem = (taskData) => {
    setInserting(true);
    taskAPI.create(taskData)
      .then(created => setItems(prev => [created, ...prev]))
      .catch(() => {})
      .finally(() => setInserting(false));
  };

  const toggleDone = (e, id) => {
    if (e?.preventDefault) e.preventDefault();
    const item = items.find(i => String(i.id) === String(id));
    if (!item) return;
    const updated = { ...item, status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' };
    taskAPI.update(id, updated)
      .then(res => setItems(prev => prev.map(i => String(i.id) === String(id) ? res : i)))
      .catch(() => {});
  };

  const deleteItem = (id) => {
    taskAPI.delete(id)
      .then(() => setItems(prev => prev.filter(i => String(i.id) !== String(id))))
      .catch(() => {});
  };

  if (user.role === 'ADMIN' && !projectSelected) {
    return <ProjectSelector onSelect={() => setProjectSelected(true)} />;
  }

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#F7F8FA' }}>
      <Drawer variant="permanent" sx={{
        width: DRAWER_WIDTH, flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH, boxSizing: 'border-box',
          backgroundColor: '#1A1A1A', color: '#FFF',
          borderRight: 'none', position: 'fixed', height: '100vh',
        },
      }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid #2A2A2A' }}>
          <Box sx={{ width: 36, height: 36, bgcolor: '#E53935', borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.65rem', letterSpacing: 1 }}>ORA</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Oracle Software</Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#888' }}>{user.role} Panel</Typography>
          </Box>
        </Box>

        <List sx={{ px: 1.5, mt: 1.5, flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => (
            <ListItem button key={item.id} 
              onClick={() => {
                if (item.id === 'selector') {
                  localStorage.removeItem('selectedProjectId');
                  setProjectSelected(false);
                } else {
                  setActivePage(item.id);
                }
              }} 
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
            </ListItem>
          ))}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid #2A2A2A' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ bgcolor: '#E53935', width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700 }}>
              {getInitials(user.name)}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', noWrap: true }}>{user.name}</Typography>
              <Typography sx={{ color: '#888', fontSize: '0.7rem' }}>{user.role}</Typography>
            </Box>
            <IconButton size="small" sx={{ color: '#666' }} onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
              <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
            </Menu>
          </Box>
        </Box>
      </Drawer>

      <Box component="main" sx={{
        position: 'fixed', top: 0, right: 0, bottom: 0, left: `${DRAWER_WIDTH}px`,
        overflowY: 'auto', p: 4, boxSizing: 'border-box', backgroundColor: '#F7F8FA',
      }}>
        {activePage === 'dashboard' && (
          <DashboardPage items={items} isLoading={isLoading} toggleDone={toggleDone} deleteItem={deleteItem} onNavigateToTasks={() => setActivePage('tasks')} />
        )}
        {activePage === 'tasks' && (
          <TasksPage items={items} isLoading={isLoading} isInserting={isInserting} toggleDone={toggleDone} deleteItem={deleteItem} addItem={addItem} />
        )}
        {activePage === 'sprints' && <SprintsPage />}
        {activePage === 'analytics' && <Analytics />}
        
        {!['dashboard', 'sprints', 'analytics', 'tasks'].includes(activePage) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <Typography variant="h6" color="textSecondary">Sección en desarrollo</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;