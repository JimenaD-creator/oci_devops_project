import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  apiFetch,
  isAuthenticated,
  loadStoredUser,
  logout,
  persistCurrentUser,
  resolveProfilePicture,
  SESSION_EXPIRED_EVENT,
} from '../utils/auth';
import {
  buildUserSessionFromAuth,
  isAdminRole,
  getProfileRoleLabel,
  getSidebarRoleLabel,
  isDeveloperRole,
  isManagerRole,
  normalizeUserRole,
} from '../utils/userRoleUtils';
import { getApiBase } from '../utils/apiBase';
import { useThemeMode } from '../ThemeContext';
import { ProjectDataProvider } from '../contexts/ProjectDataContext';
import PageLoadingSpinner from '../components/common/PageLoadingSpinner';

import {
  Box,
  Button,
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
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// Lazy load pages
const SprintsPage = lazy(() => import('../features/sprints/SprintsPage'));
const TasksPage = lazy(() => import('../features/tasks/TasksPage'));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'));
const KPIAnalytics = lazy(() => import('../features/kpis/KPIAnalytics'));
const ProjectSelector = lazy(() => import('../features/project/ProjectSelector'));
const AIInsightsPage = lazy(() => import('../features/ai/AIInsightsPage'));
const ManagerChatbot = lazy(() => import('../features/ai/ManagerChatbot'));
const MyPerformancePage = lazy(() => import('../features/developer/MyPerformancePage'));
const MyTasksPage = lazy(() => import('../features/developer/MyTasksPage'));
const MyBlockersPage = lazy(() => import('../features/developer/MyBlockersPage'));

const DRAWER_WIDTH = 240;

const PageLoader = () => <PageLoadingSpinner color="#E53935" />;

const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
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
        canvas.width = Math.round(img.width * scale);
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

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [activePage, setActivePage] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return 'dashboard';
      const parsed = JSON.parse(stored);
      const role = buildUserSessionFromAuth(parsed).role;
      return isDeveloperRole(role) ? 'my-tasks' : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [sprintsNavOpen, setSprintsNavOpen] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(
    localStorage.getItem('currentProjectId'),
  );
  const [selectedProjectName, setSelectedProjectName] = useState(
    localStorage.getItem('currentProjectName'),
  );
  /** Manager opened "Change project" — do not auto-pick the first project again. */
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  /** null = loading; array = projects for this manager's team */
  const [managerProjects, setManagerProjects] = useState(null);
  /** null = loading; array = projects for teams this developer belongs to */
  const [developerProjects, setDeveloperProjects] = useState(null);
  /** loading | ready | missing — avoids infinite spinner when prod DB has no team/project for user */
  const [devProjectStatus, setDevProjectStatus] = useState(() =>
    localStorage.getItem('currentProjectId') ? 'ready' : 'loading',
  );
  /** Pages already opened stay mounted (hidden) to avoid refetch on every sidebar click. */
  const [visitedPages, setVisitedPages] = useState(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) return new Set(['dashboard']);
      const parsed = JSON.parse(stored);
      const role = buildUserSessionFromAuth(parsed).role;
      return new Set([isDeveloperRole(role) ? 'my-tasks' : 'dashboard']);
    } catch {
      return new Set(['dashboard']);
    }
  });

  // ── Foto de perfil ───────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  // ────────────────────────────────────────────────────────────────────────────

  const handleNavigateToProjectTasks = useCallback(() => {
    setSprintsNavOpen(true);
    setActivePage('sprints');
  }, []);

  const [user, setUser] = useState(() => loadStoredUser());

  // profilePicture como estado independiente para refrescar el Avatar sin recargar todo
  const [profilePicture, setProfilePicture] = useState(() => {
    const u = loadStoredUser();
    return resolveProfilePicture(u?.id, u?.profilePicture);
  });

  useEffect(() => {
    if (!user?.id || profilePicture) return;
    let cancelled = false;
    fetch(`${getApiBase()}/users/${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((dbUser) => {
        if (cancelled || !dbUser?.profilePicture) return;
        const updated = { ...user, profilePicture: dbUser.profilePicture };
        persistCurrentUser(updated);
        setUser(updated);
        setProfilePicture(resolveProfilePicture(updated.id, updated.profilePicture));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, profilePicture]);

  useEffect(() => {
    if (!isManagerRole(user?.role) || !user?.id) {
      setManagerProjects(null);
      return;
    }
    let cancelled = false;
    apiFetch(`${getApiBase()}/api/projects/manager/${user.id}/list`)
      .then((r) => (r.ok ? r.json() : []))
      .then((projects) => {
        if (cancelled) return;
        const list = Array.isArray(projects) ? projects : [];
        setManagerProjects(list);
        if (selectedProjectId || showProjectPicker) return;
        if (list.length === 1 && list[0]?.id != null) {
          const only = list[0];
          localStorage.setItem('currentProjectId', String(only.id));
          localStorage.setItem('currentProjectName', only.name || '');
          setSelectedProjectId(String(only.id));
          setSelectedProjectName(only.name || '');
        } else if (list.length > 1) {
          setShowProjectPicker(true);
        }
      })
      .catch(() => {
        if (!cancelled) setManagerProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, selectedProjectId, showProjectPicker]);

  useEffect(() => {
    if (!isDeveloperRole(user?.role) || !user?.id) {
      setDeveloperProjects(null);
      return;
    }
    let cancelled = false;
    apiFetch(`${getApiBase()}/api/projects/developer/${user.id}/list`)
      .then((r) => (r.ok ? r.json() : []))
      .then((projects) => {
        if (cancelled) return;
        const list = Array.isArray(projects) ? projects : [];
        setDeveloperProjects(list);
        if (selectedProjectId || showProjectPicker) {
          setDevProjectStatus(list.length > 0 ? 'ready' : 'missing');
          return;
        }
        if (list.length === 0) {
          setDevProjectStatus('missing');
          return;
        }
        if (list.length === 1 && list[0]?.id != null) {
          const only = list[0];
          localStorage.setItem('currentProjectId', String(only.id));
          localStorage.setItem('currentProjectName', only.name || '');
          setSelectedProjectId(String(only.id));
          setSelectedProjectName(only.name || '');
          setDevProjectStatus('ready');
        } else if (list.length > 1) {
          setDevProjectStatus('ready');
          setShowProjectPicker(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeveloperProjects([]);
          setDevProjectStatus('missing');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, selectedProjectId, showProjectPicker]);

  useEffect(() => {
    if (activePage === 'tasks' || activePage === 'sprints') setSprintsNavOpen(true);
  }, [activePage]);

  useEffect(() => {
    setVisitedPages((prev) => {
      if (prev.has(activePage)) return prev;
      const next = new Set(prev);
      next.add(activePage);
      return next;
    });
  }, [activePage]);

  const pageVisibilitySx = (pageId) => ({
    display: activePage === pageId ? 'block' : 'none',
  });

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
      const res = await fetch(`${getApiBase()}/api/users/${user.id}/profile-picture`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      const updated = { ...user, profilePicture: null };
      persistCurrentUser(updated);
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

      const res = await fetch(`${getApiBase()}/api/users/${user.id}/profile-picture`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profilePicture: base64 }),
      });
      if (!res.ok) throw new Error();

      const updated = { ...user, profilePicture: base64 };
      persistCurrentUser(updated);
      setUser(updated);
      setProfilePicture(resolveProfilePicture(updated.id, base64));
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
    setSelectedProjectId(String(project.id));
    setSelectedProjectName(project.name || '');
    setShowProjectPicker(false);
    setDevProjectStatus('ready');
    setActivePage(isDeveloperRole(user?.role) ? 'my-tasks' : 'dashboard');
  };

  const handleChangeProject = () => {
    if (isManagerRole(user?.role) && managerProjects && managerProjects.length <= 1) {
      const name = managerProjects[0]?.name || selectedProjectName || 'your project';
      setSnack({
        open: true,
        msg: `You only have one assigned project (${name}).`,
        severity: 'info',
      });
      return;
    }
    if (isDeveloperRole(user?.role) && developerProjects && developerProjects.length <= 1) {
      const name = developerProjects[0]?.name || selectedProjectName || 'your project';
      setSnack({
        open: true,
        msg: `You only have one assigned project (${name}).`,
        severity: 'info',
      });
      return;
    }
    localStorage.removeItem('currentProjectId');
    localStorage.removeItem('currentProjectName');
    setSelectedProjectId(null);
    setSelectedProjectName(null);
    setShowProjectPicker(true);
  };

  useEffect(() => {
    const onSessionExpired = () => {
      setUser(null);
      setProfilePicture(null);
      navigate('/login', { replace: true });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [navigate]);

  useEffect(() => {
    if (user) return;
    if (!isAuthenticated()) return;
    try {
      const stored = localStorage.getItem('currentUser');
      if (!stored) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      const parsed = JSON.parse(stored);
      if (parsed?.id == null) {
        logout();
        navigate('/login', { replace: true });
        return;
      }
      const loaded = loadStoredUser();
      if (loaded) {
        setUser(loaded);
        setProfilePicture(resolveProfilePicture(loaded.id, loaded.profilePicture));
      }
    } catch {
      logout();
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return <PageLoader />;
  }

  const isDeveloper = isDeveloperRole(user.role);

  const DEVELOPER_NAV_ITEMS = [
    { text: 'My Tasks', id: 'my-tasks', icon: <AssignmentIcon /> },
    { text: 'Kanban Board', id: 'my-kanban', icon: <ViewKanbanIcon /> },
    { text: 'My Blockers', id: 'my-blockers', icon: <ReportProblemIcon /> },
    { text: 'My Performance', id: 'my-performance', icon: <AnalyticsIcon /> },
  ];

  const developerSecondaryNavItems =
    developerProjects != null && developerProjects.length > 1
      ? [{ text: 'Change project', id: 'selector', icon: <SwapHorizIcon /> }]
      : [];

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
    {
      text: 'Change project',
      icon: <SwapHorizIcon />,
      id: 'selector',
      roles: ['ADMIN', 'MANAGER'],
    },
  ].filter((item) => {
    if (item.id === 'selector' && isManagerRole(user.role)) {
      if (managerProjects == null) return false;
      if (managerProjects.length <= 1) return false;
    }
    return item.roles.some((r) => {
      if (r === 'ADMIN') return isAdminRole(user.role);
      if (r === 'MANAGER') return isManagerRole(user.role);
      return normalizeUserRole(user.role).toUpperCase() === r;
    });
  });

  const topNavItems = isDeveloper
    ? DEVELOPER_NAV_ITEMS
    : NAV_ITEMS.filter((item) => ['dashboard', 'ai-insights', 'analytics'].includes(item.id));
  const secondaryNavItems = isDeveloper
    ? developerSecondaryNavItems
    : NAV_ITEMS.filter((item) => !['dashboard', 'ai-insights', 'analytics'].includes(item.id));

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

  if (
    (isAdminRole(user.role) || isManagerRole(user.role)) &&
    (!selectedProjectId || showProjectPicker)
  ) {
    return (
      <Suspense fallback={<PageLoader />}>
        <ProjectSelector
          onSelect={handleSelectProject}
          mode={isManagerRole(user.role) ? 'manager' : 'admin'}
          skipAutoSelect={showProjectPicker}
        />
      </Suspense>
    );
  }

  if (isDeveloper && (!selectedProjectId || showProjectPicker)) {
    if (developerProjects == null && !showProjectPicker) {
      return <PageLoader />;
    }
    if (showProjectPicker || (developerProjects && developerProjects.length > 1)) {
      return (
        <Suspense fallback={<PageLoader />}>
          <ProjectSelector
            onSelect={handleSelectProject}
            mode="developer"
            skipAutoSelect={showProjectPicker}
          />
        </Suspense>
      );
    }
    if (devProjectStatus === 'missing' || (developerProjects && developerProjects.length === 0)) {
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Box sx={{ textAlign: 'center', maxWidth: 480 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Signed in — no project assigned
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 2.5, fontSize: '0.9rem' }}>
              Login worked, but user ID {user.id} is not linked to a project team (TEAM_MEMBER). Ask
              your manager to add you to a project in the web app.
            </Typography>
            <Button
              variant="contained"
              sx={{ bgcolor: '#E53935', '&:hover': { bgcolor: '#C62828' } }}
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </Box>
        </Box>
      );
    }
    return <PageLoader />;
  }

  const drawerBg = '#1A1A1A';
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
        <Box
          sx={{
            p: 2.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${drawerBorder}`,
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>
              {selectedProjectName || 'Software Manager Tool'}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: '#888' }}>
              {getSidebarRoleLabel(user.role)}
            </Typography>
          </Box>
        </Box>

        {/* Nav items */}
        <List sx={{ px: 1.5, mt: 1.5, flexGrow: 1 }} component="nav">
          {topNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() =>
                item.id === 'selector' ? handleChangeProject() : setActivePage(item.id)
              }
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

          {!isDeveloper ? (
            <>
              {/* Sprints colapsable */}
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
                          backgroundColor: subActive ? 'rgba(229,57,53,0.35)' : 'transparent',
                          '&:hover': {
                            backgroundColor: subActive ? 'rgba(229,57,53,0.45)' : '#2A2A2A',
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
            </>
          ) : null}

          {secondaryNavItems.map((item) => (
            <ListItemButton
              key={item.id}
              onClick={() =>
                item.id === 'selector' ? handleChangeProject() : setActivePage(item.id)
              }
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

        {/* ─── Footer del drawer ─── */}
        <Box sx={{ borderTop: `1px solid ${drawerBorder}` }}>
          {/* Botón dark mode */}
          <Box
            sx={{
              px: 2,
              pt: 1.5,
              pb: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
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
                {darkMode ? (
                  <Brightness7Icon fontSize="small" />
                ) : (
                  <Brightness4Icon fontSize="small" />
                )}
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
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CircularProgress size={20} sx={{ color: '#E53935' }} />
                  </Box>
                ) : (
                  <>
                    <Avatar
                      src={profilePicture || undefined}
                      sx={{
                        bgcolor: '#E53935',
                        width: 34,
                        height: 34,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
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
              <Typography sx={{ color: '#888', fontSize: '0.7rem' }}>
                {getProfileRoleLabel(user.role, user.jobTitle)}
              </Typography>
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
          bgcolor: 'background.default',
        }}
      >
        <ProjectDataProvider projectId={selectedProjectId} preload={Boolean(selectedProjectId)}>
          <Suspense fallback={<PageLoader />}>
            {visitedPages.has('dashboard') && (
              <Box sx={pageVisibilitySx('dashboard')}>
                <DashboardPage
                  onNavigateToTasks={handleNavigateToProjectTasks}
                  onNavigateToAnalytics={() => setActivePage('analytics')}
                  projectId={selectedProjectId}
                  isPageActive={activePage === 'dashboard'}
                />
              </Box>
            )}
            {visitedPages.has('tasks') && (
              <Box sx={pageVisibilitySx('tasks')}>
                <TasksPage projectId={selectedProjectId} />
              </Box>
            )}
            {visitedPages.has('sprints') && (
              <Box sx={pageVisibilitySx('sprints')}>
                <SprintsPage
                  projectId={selectedProjectId}
                  onNavigateToTasks={() => setActivePage('tasks')}
                />
              </Box>
            )}
            {visitedPages.has('analytics') && (
              <Box sx={pageVisibilitySx('analytics')}>
                <KPIAnalytics
                  projectId={selectedProjectId}
                  onOpenAiInsights={() => setActivePage('ai-insights')}
                  onNavigateToTasks={handleNavigateToProjectTasks}
                />
              </Box>
            )}
            {visitedPages.has('ai-insights') && (
              <Box sx={pageVisibilitySx('ai-insights')}>
                <AIInsightsPage
                  projectId={selectedProjectId}
                  isPageActive={activePage === 'ai-insights'}
                />
              </Box>
            )}
            {visitedPages.has('my-tasks') && (
              <Box sx={pageVisibilitySx('my-tasks')}>
                <MyTasksPage projectId={selectedProjectId} currentUser={user} />
              </Box>
            )}
            {visitedPages.has('my-kanban') && (
              <Box sx={pageVisibilitySx('my-kanban')}>
                <TasksPage projectId={selectedProjectId} developerMode currentUser={user} />
              </Box>
            )}
            {visitedPages.has('my-performance') && (
              <Box sx={pageVisibilitySx('my-performance')}>
                <MyPerformancePage projectId={selectedProjectId} currentUser={user} />
              </Box>
            )}
            {visitedPages.has('my-blockers') && (
              <Box sx={pageVisibilitySx('my-blockers')}>
                <MyBlockersPage projectId={selectedProjectId} currentUser={user} />
              </Box>
            )}
          </Suspense>
        </ProjectDataProvider>
        {![
          'dashboard',
          'sprints',
          'analytics',
          'tasks',
          'ai-insights',
          'my-tasks',
          'my-kanban',
          'my-blockers',
          'my-performance',
        ].includes(activePage) && (
          <Box
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}
          >
            <Typography variant="h6" color="textSecondary">
              Section under development
            </Typography>
          </Box>
        )}
      </Box>

      {!isDeveloper ? (
        <Suspense fallback={null}>
          <ManagerChatbot projectId={selectedProjectId} />
        </Suspense>
      ) : null}

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
