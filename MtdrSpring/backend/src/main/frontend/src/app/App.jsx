import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../utils/auth';
import { taskAPI } from '../services/API';
import { API_BASE } from '../features/sprints/constants/sprintConstants';
import ManagerChatbot from '../features/ai/ManagerChatbot';
import { useThemeMode } from '../ThemeContext';
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
  Tooltip,
  Snackbar,
  Alert,
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
import GroupIcon from '@mui/icons-material/Group';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Lazy load pages
const SprintsPage     = lazy(() => import('../features/sprints/SprintsPage'));
const TasksPage       = lazy(() => import('../features/tasks/TasksPage'));
const DashboardPage   = lazy(() => import('../features/dashboard/DashboardPage'));
const KPIAnalytics    = lazy(() => import('../features/kpis/KPIAnalytics'));
const ProjectSelector = lazy(() => import('../features/project/ProjectSelector'));
const AIInsightsPage  = lazy(() => import('../features/ai/AIInsightsPage'));
const TeamPage        = lazy(() => import('../features/team/TeamPage'));

const DRAWER_WIDTH = 240;

const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
    <CircularProgress sx={{ color: '#E53935' }} />
  </Box>
);

const getInitials = (name) => {
  if (!name) return '';
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
};

// Comprime la imagen a base64 con canvas para no reventar el CLOB/localStorage
const compressImage = (file, maxWidth = 256, quality = 0.82) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

function App() {
  const navigate = useNavigate();
  const { darkMode, toggleDark } = useThemeMode();

  const [menuAnchor, setMenuAnchor]   = useState(null);
  const [activePage, setActivePage]   = useState('dashboard');
  const [sprintsNavOpen, setSprintsNavOpen] = useState(true);
  const [isLoading, setLoading]       = useState(false);
  const [isInserting, setInserting]   = useState(false);
  const [items, setItems]             = useState([]);
  const [selectedProjectId, setSelectedProjectId]     = useState(localStorage.getItem('currentProjectId'));
  const [selectedProjectName, setSelectedProjectName] = useState(localStorage.getItem('currentProjectName'));
  const [teamLandingSprintId, setTeamLandingSprintId] = useState(null);

  // ── Foto de perfil ───────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  // ────────────────────────────────────────────────────────────────────────────

  const handleTeamLandingConsumed = useCallback(() => { setTeamLandingSprintId(null); }, []);
  const handleOpenTeamFromAi = useCallback((sprintId) => {
    setTeamLandingSprintId(sprintId != null ? Number(sprintId) : null);
    setActivePage('team');
  }, []);
  const handleOpenAiInsightsFromTeam = useCallback(() => { setActivePage('ai-insights'); }, []);

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      return { ...parsed, role: (parsed.role || parsed.type || 'DEVELOPER').toUpperCase() };
    } catch { return null; }
  });

  // profilePicture como estado independiente para refrescar el Avatar sin recargar todo
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || null);

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
  }, [user, selectedProjectId]);

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
      taskAPI.getAll().then((data) => setItems(data)).catch(() => {}).finally(() => setLoading(false));
    }
  }, [user]);

  useEffect(() => {
    if (activePage === 'tasks' || activePage === 'sprints') setSprintsNavOpen(true);
  }, [activePage]);

  // ── Handlers foto de perfil ──────────────────────────────────────────────────
  const handlePhotoClick = () => {
    setMenuAnchor(null);
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = async () => {
    setMenuAnchor(null);
    if (!user?.id) return;
    try {
      setUploadingPhoto(true);
      const res = await fetch(`${API_BASE}/api/users/${user.id}/profile-picture`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      const updated = { ...user, profilePicture: null };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      setUser(updated);
      setProfilePicture(null);
      setSnack({ open: true, msg: 'Profile photo removed', severity: 'info' });
    } catch {
      setSnack({ open: true, msg: 'Error removing photo', severity: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    // Reset input para permitir re-seleccionar el mismo archivo
    e.target.value = '';
    if (!file || !user?.id) return;

    try {
      setUploadingPhoto(true);
      const base64 = await compressImage(file);

      const res = await fetch(`${API_BASE}/api/users/${user.id}/profile-picture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: base64 }),
      });
      if (!res.ok) throw new Error();

      const updated = { ...user, profilePicture: base64 };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      setUser(updated);
      setProfilePicture(base64);
      setSnack({ open: true, msg: 'Profile photo updated!', severity: 'success' });
    } catch {
      setSnack({ open: true, msg: 'Error uploading photo', severity: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

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
    { text: 'Dashboard',      icon: <DashboardIcon />,   id: 'dashboard',   roles: ['ADMIN', 'MANAGER'] },
    { text: 'AI Insights',    icon: <AutoAwesomeIcon />, id: 'ai-insights', roles: ['ADMIN', 'MANAGER'] },
    { text: 'KPI Analytics',  icon: <AnalyticsIcon />,   id: 'analytics',   roles: ['ADMIN', 'MANAGER'] },
    { text: 'Team',           icon: <GroupIcon />,        id: 'team',        roles: ['ADMIN', 'MANAGER'] },
    { text: 'Change project', icon: <SwapHorizIcon />,   id: 'selector',    roles: ['ADMIN'] },
  ].filter((item) => item.roles.includes(user.role));

  const topNavItems = NAV_ITEMS.filter((item) =>
    ['dashboard', 'ai-insights', 'analytics'].includes(item.id)
  );
  const secondaryNavItems = NAV_ITEMS.filter((item) =>
    !['dashboard', 'ai-insights', 'analytics'].includes(item.id)
  );

  const SPRINTS_SUBITEMS = [
    { text: 'Tasks',        id: 'sprints', icon: <ViewModuleIcon fontSize="small" /> },
    { text: 'Kanban board', id: 'tasks',   icon: <ViewKanbanIcon fontSize="small" /> },
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
    taskAPI.create(taskData).then((created) => setItems((prev) => [created, ...prev])).catch(() => {}).finally(() => setInserting(false));
  };

  const toggleDone = (e, id) => {
    if (e?.preventDefault) e.preventDefault();
    const item = items.find((i) => String(i.id) === String(id));
    if (!item) return;
    const updated = { ...item, status: item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' };
    taskAPI.update(id, updated)
      .then((res) => setItems((prev) => prev.map((i) => (String(i.id) === String(id) ? res : i))))
      .catch(() => {});
  };

  const deleteItem = (id) => {
    taskAPI.delete(id)
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

  const drawerBg     = '#1A1A1A';
  const drawerBorder = '#2A2A2A';

  return (
    <Box sx={{ display: 'flex', width: '100%', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* Input file oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ─── Sidebar ─────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            backgroundColor: drawerBg,
            color: '#FFF',
            borderRight: 'none',
            position: 'fixed',
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Header del drawer */}
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: `1px solid ${drawerBorder}` }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
              {selectedProjectName || 'Software Manager Tool'}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#888' }}>{user.role}</Typography>
          </Box>
        </Box>

        {/* Nav items */}
        <List sx={{ px: 1.5, mt: 1.5, flexGrow: 1 }} component="nav">
          {topNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => item.id === 'selector' ? handleChangeProject() : setActivePage(item.id)}
              sx={{
                borderRadius: '8px', mb: 0.5, py: 1.1,
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
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: activePage === item.id ? 600 : 400 }}
              />
            </ListItemButton>
          ))}

          {/* Sprints colapsable */}
          <ListItemButton
            onClick={() => setSprintsNavOpen((o) => !o)}
            sx={{
              borderRadius: '8px', mb: 0.5, py: 1.1,
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
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: sprintsSectionActive ? 600 : 400 }}
            />
            {sprintsNavOpen
              ? <ExpandLess sx={{ color: sprintsSectionActive ? '#fff' : '#777', ml: 0.5 }} />
              : <ExpandMore sx={{ color: sprintsSectionActive ? '#fff' : '#777', ml: 0.5 }} />
            }
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
                      pl: 3, py: 1, borderRadius: '8px', mb: 0.25,
                      backgroundColor: subActive ? 'rgba(229,57,53,0.35)' : 'transparent',
                      '&:hover': { backgroundColor: subActive ? 'rgba(229,57,53,0.45)' : '#2A2A2A' },
                    }}
                  >
                    <ListItemIcon sx={{ color: subActive ? '#fff' : '#999', minWidth: 36 }}>
                      {sub.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={sub.text}
                      primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: subActive ? 600 : 400 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Collapse>

          {secondaryNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() => item.id === 'selector' ? handleChangeProject() : setActivePage(item.id)}
              sx={{
                borderRadius: '8px', mb: 0.5, py: 1.1,
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
                primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: activePage === item.id ? 600 : 400 }}
              />
            </ListItemButton>
          ))}
        </List>

        {/* ─── Footer del drawer ─── */}
        <Box sx={{ borderTop: `1px solid ${drawerBorder}` }}>
          {/* Botón dark mode */}
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#666' }}>
              {darkMode ? 'Dark mode' : 'Light mode'}
            </Typography>
            <Tooltip title={darkMode ? 'Switch to light' : 'Switch to dark'} placement="right">
              <IconButton
                size="small"
                onClick={toggleDark}
                sx={{
                  color: darkMode ? '#FDD835' : '#90A4AE',
                  bgcolor: darkMode ? 'rgba(253,216,53,0.12)' : 'rgba(144,164,174,0.12)',
                  '&:hover': {
                    bgcolor: darkMode ? 'rgba(253,216,53,0.22)' : 'rgba(144,164,174,0.22)',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                {darkMode ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Info usuario */}
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Avatar con overlay de cámara al hover */}
            <Tooltip title="Change profile photo" placement="right">
              <Box
                onClick={handlePhotoClick}
                sx={{
                  position: 'relative',
                  width: 34,
                  height: 34,
                  cursor: 'pointer',
                  flexShrink: 0,
                  '&:hover .cam-overlay': { opacity: 1 },
                }}
              >
                {uploadingPhoto ? (
                  <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={20} sx={{ color: '#E53935' }} />
                  </Box>
                ) : (
                  <>
                    <Avatar
                      src={profilePicture || undefined}
                      sx={{ bgcolor: '#E53935', width: 34, height: 34, fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {!profilePicture && getInitials(user.name)}
                    </Avatar>
                    {/* Overlay oscuro con ícono de cámara */}
                    <Box
                      className="cam-overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '50%',
                        bgcolor: 'rgba(0,0,0,0.55)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.18s ease',
                      }}
                    >
                      <PhotoCameraIcon sx={{ fontSize: 14, color: '#fff' }} />
                    </Box>
                  </>
                )}
              </Box>
            </Tooltip>

            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{user.name}</Typography>
              <Typography sx={{ color: '#888', fontSize: '0.7rem' }}>{user.role}</Typography>
            </Box>

            <IconButton size="small" sx={{ color: '#666' }} onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon fontSize="small" />
            </IconButton>

            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
              <MenuItem onClick={handlePhotoClick} sx={{ gap: 1 }}>
                <PhotoCameraIcon fontSize="small" sx={{ color: '#888' }} />
                Change photo
              </MenuItem>
              {profilePicture && (
                <MenuItem onClick={handleRemovePhoto} sx={{ gap: 1, color: '#E53935' }}>
                  <DeleteOutlineIcon fontSize="small" />
                  Remove photo
                </MenuItem>
              )}
              <MenuItem onClick={handleLogout}>Sign out</MenuItem>
            </Menu>
          </Box>
        </Box>
      </Drawer>

      {/* ─── Contenido principal ─────────────────────────── */}
      <Box
        component="main"
        sx={{
          position: 'fixed',
          top: 0, right: 0, bottom: 0, left: `${DRAWER_WIDTH}px`,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          pt: 2, px: 4, pb: 4,
          boxSizing: 'border-box',
          bgcolor: 'background.default',
        }}
      >
        <Suspense fallback={<PageLoader />}>
          {activePage === 'dashboard' && (
            <DashboardPage
              items={items} isLoading={isLoading}
              toggleDone={toggleDone} deleteItem={deleteItem}
              onNavigateToTasks={() => setActivePage('tasks')}
              projectId={selectedProjectId}
            />
          )}
          {activePage === 'tasks' && (
            <TasksPage
              items={items} isLoading={isLoading} isInserting={isInserting}
              toggleDone={toggleDone} deleteItem={deleteItem} addItem={addItem}
              projectId={selectedProjectId}
            />
          )}
          {activePage === 'sprints' && (
            <SprintsPage projectId={selectedProjectId} onNavigateToTasks={() => setActivePage('tasks')} />
          )}
          {activePage === 'analytics' && (
            <KPIAnalytics projectId={selectedProjectId} onOpenAiInsights={() => setActivePage('ai-insights')} />
          )}
          {activePage === 'ai-insights' && (
            <AIInsightsPage projectId={selectedProjectId} onOpenTeam={handleOpenTeamFromAi} />
          )}
          {activePage === 'team' && (
            <TeamPage
              projectId={selectedProjectId}
              landingSprintId={teamLandingSprintId}
              onLandingConsumed={handleTeamLandingConsumed}
              onOpenAiInsights={handleOpenAiInsightsFromTeam}
            />
          )}
        </Suspense>
        {!['dashboard', 'sprints', 'analytics', 'tasks', 'ai-insights', 'team'].includes(activePage) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <Typography variant="h6" color="textSecondary">Section under development</Typography>
          </Box>
        )}
      </Box>

      <ManagerChatbot projectId={selectedProjectId} />

      {/* Snackbar de feedback */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          severity={snack.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;