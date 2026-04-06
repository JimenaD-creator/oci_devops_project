import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import API_LIST from '../services/API';
import SprintsPage from '../pages/SprintsPage';
import DashboardPage from '../components/dashboard/DashboardPage';
import Analytics from '../pages/KPIAnalytics';

import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  Typography, Chip, Avatar, IconButton, Menu, MenuItem
} from '@mui/material';

import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import GroupsIcon from '@mui/icons-material/Groups';
import SettingsIcon from '@mui/icons-material/Settings';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AnalyticsIcon from '@mui/icons-material/Analytics';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { text: 'Dashboard',     icon: <DashboardIcon />,   id: 'dashboard' },
  { text: 'Sprints',       icon: <AssignmentIcon />,  id: 'sprints' },
  { text: 'Tasks',        icon: <TaskAltIcon />,     id: 'tasks' },
  { text: 'Team',        icon: <GroupsIcon />,      id: 'team' },
  { text: 'KPI Analytics',     icon: <AnalyticsIcon />,   id: 'analytics' },
  { text: 'AI Insights',   icon: <AutoAwesomeIcon />, id: 'ai'},
  { text: 'Configuration', icon: <SettingsIcon />,    id: 'config' },
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

function App() {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoading, setLoading] = useState(false);
  const [isInserting, setInserting] = useState(false);
  const [items, setItems] = useState([]);

  const [user, setUser] = useState({
    name: "Jimena Diaz",
    role: "Project Manager"
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

  const handleLogout = () => {
    logout();
    setMenuAnchor(null);
    navigate('/login', { replace: true });
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
            <IconButton
              size="small"
              sx={{ color: '#666' }}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Menú de cuenta"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
            </Menu>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: `${DRAWER_WIDTH}px`,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          p: 4,
          boxSizing: 'border-box',
          backgroundColor: '#F7F8FA',
        }}
      >
        {activePage === 'dashboard' && (
          <DashboardPage items={items} isLoading={isLoading} isInserting={isInserting}
            toggleDone={toggleDone} deleteItem={deleteItem} addItem={addItem} />
        )}
        {activePage === 'sprints' && <SprintsPage />}
        {activePage === 'analytics' && <Analytics />}
        {!['dashboard', 'sprints', 'analytics'].includes(activePage) && (
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