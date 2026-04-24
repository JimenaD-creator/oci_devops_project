import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import { taskAPI } from '../services/API';
import { API_BASE } from '../features/sprints/constants/sprintConstants';

import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Collapse,
} from '@mui/material';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentIcon from '@mui/icons-material/Assignment';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

// Lazy load pages
const SprintsPage = lazy(() => import('../features/sprints/SprintsPage'));
const TasksPage = lazy(() => import('../features/tasks/TasksPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const KPIAnalytics = lazy(() => import('../features/kpis/KPIAnalytics'));
const ProjectSelector = lazy(() => import('../features/project/ProjectSelector'));
const AIInsightsPage = lazy(() => import('../features/ai/AIInsightsPage'));

const DRAWER_WIDTH = 240;

// Componente de loading
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress sx={{ color: '#E53935' }} />
  </Box>
);

const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
};

function App() {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [sprintsNavOpen, setSprintsNavOpen] = useState(true);
  const [isLoading, setLoading] = useState(false);
  const [isInserting, setInserting] = useState(false);
  const [items, setItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    localStorage.getItem('currentProjectId'),
  );
  const [selectedProjectName, setSelectedProjectName] = useState(
    localStorage.getItem('currentProjectName'),
  );

  const [user] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        role: (parsed.role || parsed.type || 'DEVELOPER').toUpperCase(),
      };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user?.role === 'MANAGER' && !selectedProjectId) {
      fetch(`${API_BASE}/api/projects/manager/${user.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((project) => {
          if (project) {
            localStorage.setItem('currentProjectId', project.id);
            localStorage.setItem('currentProjectName', project.name);
            setSelectedProjectId(String(project.id));
            setSelectedProjectName(project.name);
          }
        })
        .catch(() => {});
    }
  }, [user]);

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
      taskAPI
        .getAll()
        .then((data) => setItems(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (activePage === 'tasks' || activePage === 'sprints') {
      setSprintsNavOpen(true);
    }
  }, [activePage]);

  const handleSelectProject = (project) => {
    localStorage.setItem('currentProjectId', project.id);
    localStorage.setItem('currentProjectName', project.name);
    setSelectedProjectId(project.id);
    setSelectedProjectName(project.name);
  };

  const handleChangeProject = () => {
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectName');
    setSelectedProjectId(null);
    setSelectedProjectName(null);
  };

  if (!user || user.role === 'DEVELOPER') return null;

  const NAV_ITEMS = [
    { text: 'Dashboard', icon: <DashboardIcon />, id: 'dashboard', roles: ['ADMIN', 'MANAGER'] },
    {
      text: 'AI Insights',
      icon: <AutoAwesomeIcon />,
      id: 'ai-insights',
      roles: ['ADMIN', 'MANAGER'],
    },
    {
      text: 'KPI Analytics',
      icon: <AnalyticsIcon />,
      id: 'analytics',
      roles: ['ADMIN', 'MANAGER'],
    },
    { text: 'Change project', icon: <SwapHorizIcon />, id: 'selector', roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(user.role));
  const topNavItems = NAV_ITEMS.filter((item) => item.id === 'dashboard' || item.id === 'ai-insights');
  const secondaryNavItems = NAV_ITEMS.filter(
    (item) => item.id !== 'dashboard' && item.id !== 'ai-insights',
  );

  const SPRINTS_SUBITEMS = [
    { text: 'Tasks', id: 'sprints', icon: <ViewModuleIcon fontSize="small" /> },
    { text: 'Kanban board', id: 'tasks', icon: <ViewKanbanIcon fontSize="small" /> },
  ];

  const sprintsSectionActive = activePage === 'tasks' || activePage === 'sprints';

  const handleLogout = () => {
    logout();
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectName');
    setMenuAnchor(null);
    navigate('/login', { replace: true });
  };

  const addItem = (taskData) => {
    setInserting(true);
    taskAPI
      .create(taskData)
      .then((created) => setItems((prev) => [created, ...prev]))
      .catch(() => {})
      .finally(() => setInserting(false));
  };

  const toggleDone = (e, id) => {
    if (e?.preventDefault) e.preventDefault();
    const item = items.find((i) => String(i.id) === String(id));
    if (!item) return;
    const updated = { ...item, status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' };
    taskAPI
      .update(id, updated)
      .then((res) => setItems((prev) => prev.map((i) => (String(i.id) === String(id) ? res : i))))
      .catch(() => {});
  };

  const deleteItem = (id) => {
    taskAPI
      .delete(id)
      .then(() => setItems((prev) => prev.filter((i) => String(i.id) !== String(id))))
      .catch(() => {});
  };

  if (user.role === 'ADMIN' && !selectedProjectId) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProjectSelector onSelect={handleSelectProject} />
      </Suspense>
    );
  }

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', backgroundColor: '#F7F8FA' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: '#1A1A1A',
            color: '#FFF',
            borderRight: 'none',
            position: 'fixed',
            height: '100vh',
          },
        }}
      >
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid #2A2A2A',
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
              {selectedProjectName || 'Software Manager Tool'}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#888' }}>{user.role}</Typography>
          </Box>
        </Box>

        <List sx={{ px: 1.5, mt: 1.5, flexGrow: 1 }} component="nav">
          {topNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => {
                if (item.id === 'selector') {
                  handleChangeProject();
                } else {
                  setActivePage(item.id);
                }
              }}
              sx={{
                borderRadius: '8px',
                mb: 0.5,
                py: 1.1,
                backgroundColor: activePage === item.id ? '#E53935' : 'transparent',
                '&:hover': { backgroundColor: activePage === item.id ? '#C62828' : '#2A2A2A' },
                transition: 'background-color 0.15s ease',
              }}
            >
              <ListItemIcon sx={{ color: activePage === item.id ? 'white' : '#777', minWidth: 38 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: activePage === item.id ? 600 : 400,
                }}
              />
            </ListItemButton>
          ))}

          <ListItemButton
            onClick={() => setSprintsNavOpen((o) => !o)}
            sx={{
              borderRadius: '8px',
              mb: 0.5,
              py: 1.1,
              backgroundColor: sprintsSectionActive ? '#E53935' : 'transparent',
              '&:hover': { backgroundColor: sprintsSectionActive ? '#C62828' : '#2A2A2A' },
              transition: 'background-color 0.15s ease',
            }}
          >
            <ListItemIcon sx={{ color: sprintsSectionActive ? 'white' : '#777', minWidth: 38 }}>
              <AssignmentIcon />
            </ListItemIcon>
            <ListItemText
              primary="Sprints"
              primaryTypographyProps={{
                fontSize: '0.875rem',
                fontWeight: sprintsSectionActive ? 600 : 400,
              }}
            />
            {sprintsNavOpen ? (
              <ExpandLess sx={{ color: sprintsSectionActive ? '#fff' : '#777', ml: 0.5 }} />
            ) : (
              <ExpandMore sx={{ color: sprintsSectionActive ? '#fff' : '#777', ml: 0.5 }} />
            )}
          </ListItemButton>
          <Collapse in={sprintsNavOpen} timeout="auto" unmountOnExit>
            <List component="div" disablePadding>
              {SPRINTS_SUBITEMS.map((sub) => {
                const subActive = activePage === sub.id;
                return (
                  <ListItemButton
                    key={sub.id}
                    onClick={() => setActivePage(sub.id)}
                    sx={{
                      pl: 3,
                      py: 1,
                      borderRadius: '8px',
                      mb: 0.25,
                      backgroundColor: subActive ? 'rgba(229, 57, 53, 0.35)' : 'transparent',
                      '&:hover': {
                        backgroundColor: subActive ? 'rgba(229, 57, 53, 0.45)' : '#2A2A2A',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: subActive ? '#fff' : '#999', minWidth: 36 }}>
                      {sub.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={sub.text}
                      primaryTypographyProps={{
                        fontSize: '0.8125rem',
                        fontWeight: subActive ? 600 : 400,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>
          {secondaryNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => {
                if (item.id === 'selector') {
                  handleChangeProject();
                } else {
                  setActivePage(item.id);
                }
              }}
              sx={{
                borderRadius: '8px',
                mb: 0.5,
                py: 1.1,
                backgroundColor: activePage === item.id ? '#E53935' : 'transparent',
                '&:hover': { backgroundColor: activePage === item.id ? '#C62828' : '#2A2A2A' },
                transition: 'background-color 0.15s ease',
              }}
            >
              <ListItemIcon sx={{ color: activePage === item.id ? 'white' : '#777', minWidth: 38 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: activePage === item.id ? 600 : 400,
                }}
              />
            </ListItemButton>
          ))}
        </List>

        <Box sx={{ p: 2, borderTop: '1px solid #2A2A2A' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: '#E53935',
                width: 34,
                height: 34,
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {getInitials(user.name)}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', noWrap: true }}>
                {user.name}
              </Typography>
              <Typography sx={{ color: '#888', fontSize: '0.7rem' }}>{user.role}</Typography>
            </Box>
            <IconButton
              size="small"
              sx={{ color: '#666' }}
              onClick={(e) => setMenuAnchor(e.currentTarget)}
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
              <MenuItem onClick={handleLogout}>Sign out</MenuItem>
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
          pt: 2,
          px: 4,
          pb: 4,
          boxSizing: 'border-box',
          backgroundColor: '#F7F8FA',
        }}
      >
        <Suspense fallback={<PageLoader />}>
          {activePage === 'dashboard' && (
            <DashboardPage
              items={items}
              isLoading={isLoading}
              toggleDone={toggleDone}
              deleteItem={deleteItem}
              onNavigateToTasks={() => setActivePage('tasks')}
              projectId={selectedProjectId}
            />
          )}
          {activePage === 'tasks' && (
            <TasksPage
              items={items}
              isLoading={isLoading}
              isInserting={isInserting}
              toggleDone={toggleDone}
              deleteItem={deleteItem}
              addItem={addItem}
              projectId={selectedProjectId}
            />
          )}
          {activePage === 'sprints' && (
            <SprintsPage
              projectId={selectedProjectId}
              onNavigateToTasks={() => setActivePage('tasks')}
            />
          )}
          {activePage === 'analytics' && (
            <KPIAnalytics
              projectId={selectedProjectId}
              onOpenAiInsights={() => setActivePage('ai-insights')}
            />
          )}
          {activePage === 'ai-insights' && <AIInsightsPage projectId={selectedProjectId} />}
        </Suspense>

        {!['dashboard', 'sprints', 'analytics', 'tasks', 'ai-insights'].includes(activePage) && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}
          >
            <Typography variant="h6" color="textSecondary">
              Section under development
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default App;
