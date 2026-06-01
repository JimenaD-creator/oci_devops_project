import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  MenuItem,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AddBoxIcon from '@mui/icons-material/AddBox';
import SearchIcon from '@mui/icons-material/Search';
import { TEAM_MEMBER_TYPE_SUGGESTIONS } from '../../utils/userRoleUtils';
import { getApiBase } from '../../utils/apiBase';
import { apiFetch } from '../../utils/auth';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : getApiBase() || '';

// Colapsa el array de userDetails (que tiene una fila por user+proyecto)
// en una sola fila por usuario, juntando los proyectos en un array
const deduplicateUsers = (users) => {
  const map = {};
  users.forEach((u) => {
    if (!map[u.id]) {
      map[u.id] = { ...u, projects: u.projectName ? [u.projectName] : [] };
    } else {
      if (u.projectName && !map[u.id].projects.includes(u.projectName)) {
        map[u.id].projects.push(u.projectName);
      }
    }
  });
  return Object.values(map);
};

// ─── Helper: campo de búsqueda reutilizable ───────────────────────────────────
const SearchField = ({ value, onChange, placeholder, sx = {}, inputSx = {} }) => (
  <TextField
    fullWidth
    size="small"
    variant="outlined"
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon fontSize="small" />
        </InputAdornment>
      ),
    }}
    sx={sx}
    inputProps={{ style: inputSx }}
  />
);

const ProjectSelector = ({ onSelect, mode = 'admin', skipAutoSelect = false }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [projects, setProjects] = useState([]);
  const [userDetails, setUserDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pickerAutoSelectedRef = useRef(false);
  const [openModal, setOpenModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  // ── Filtros ─────────────────────────────────────────────────────────────────
  // Tabla de usuarios
  const [userSearch, setUserSearch] = useState('');

  // Modals: búsqueda inline para elegir equipos, usuarios y proyectos
  const [teamSearch, setTeamSearch]       = useState('');   // modal New Project → filtrar equipos
  const [managerSearch, setManagerSearch] = useState('');   // modal New Team    → filtrar managers
  const [memberSearch, setMemberSearch]   = useState('');   // modal Assign      → filtrar usuarios
  const [assignTeamSearch, setAssignTeamSearch] = useState(''); // modal Assign  → filtrar equipos

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let usersResponse = await fetch(`${API_BASE}/users/details`);
      if (!usersResponse.ok) {
        usersResponse = await fetch(`${API_BASE}/users`);
      }

      const projectsResponse = await fetch(`${API_BASE}/api/projects/all`);
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData);
      } else {
        console.error('Failed to load projects:', projectsResponse.status);
      }

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUserDetails(deduplicateUsers(usersData));
      } else {
        setError(`Error loading users: ${usersResponse.status}`);
      }
    } catch (err) {
      setError('Cannot connect to server. Make sure the backend is running on port 8080.');
    } finally {
      setLoading(false);
    }
  };

  const readCurrentUserId = () => {
    try {
      const raw = localStorage.getItem('currentUser');
      if (!raw) return null;
      const u = JSON.parse(raw);
      const id = u?.id ?? u?.ID;
      if (id == null || String(id).trim() === '') return null;
      return String(id).trim();
    } catch {
      return null;
    }
  };

  const fetchRoleProjectsList = async (listPathSegment) => {
    setLoading(true);
    setError(null);
    try {
      const userId = readCurrentUserId();
      if (!userId) {
        setProjects([]);
        setError('No user ID found. Please log in again.');
        return;
      }
      const resProj = await apiFetch(
        `${API_BASE}/api/projects/${listPathSegment}/${encodeURIComponent(userId)}/list`,
      );
      if (resProj.ok) {
        const data = await resProj.json();
        setProjects(Array.isArray(data) ? data : []);
      } else {
        setProjects([]);
        setError(`Error loading projects: ${resProj.status}`);
      }
    } catch (err) {
      setProjects([]);
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerProjects = () => fetchRoleProjectsList('manager');
  const fetchDeveloperProjects = () => fetchRoleProjectsList('developer');

  useEffect(() => {
    pickerAutoSelectedRef.current = false;
    if (mode === 'manager') {
      fetchManagerProjects();
    } else if (mode === 'developer') {
      fetchDeveloperProjects();
    } else {
      fetchData();
    }
  }, [mode]);

  useEffect(() => {
    if (skipAutoSelect || loading) return;
    if (mode !== 'manager' && mode !== 'developer') return;
    if (projects.length !== 1 || !onSelect || pickerAutoSelectedRef.current) return;
    pickerAutoSelectedRef.current = true;
    onSelect(projects[0]);
  }, [mode, loading, projects, onSelect, skipAutoSelect]);

  const openAndClear = (modalName) => {
    setFormData({});
    setTeamSearch('');
    setManagerSearch('');
    setMemberSearch('');
    setAssignTeamSearch('');
    setOpenModal(modalName);
  };

  const handleAction = async () => {
    let endpoint = '';
    if (openModal === 'project') endpoint = '/api/admin/projects';
    if (openModal === 'team')    endpoint = '/api/admin/teams';
    if (openModal === 'member')  endpoint = '/api/admin/teams/members';
    if (openModal === 'user')    endpoint = '/users/create';

    try {
      // Sin hash aquí — el backend (UserService.saveUser) ya hashea con BCrypt
      const payload = { ...formData };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setOpenModal(null);
        setFormData({});
        fetchData();
      } else {
        const msg = await res.text();
        alert('ERROR: ' + msg);
      }
    } catch (err) {
      alert('CONNECTION ERROR');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, profilePicture: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      type: user.role,
      email: user.email,
      phoneNumber: user.phoneNumber || '',
    });
    setOpenModal('editUser');
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        // Actualizar estado local inmediatamente sin refetch
        setUserDetails((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert('ERROR deleting user');
      }
    } catch {
      alert('CONNECTION ERROR');
    }
  };

  const handleEditAction = async () => {
    try {
      const payload = { ...formData };
      // Si no ingresó password nuevo, no mandarlo (el backend lo preserva)
      if (!payload.userPassword || payload.userPassword.trim() === '') {
        delete payload.userPassword;
      }
      // Sin hash aquí — el backend (UserService.updateUser) ya hashea con BCrypt

      const res = await fetch(`${API_BASE}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Actualizar estado local inmediatamente sin esperar refetch
        setUserDetails((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  name: payload.name ?? u.name,
                  email: payload.email ?? u.email,
                  phoneNumber: payload.phoneNumber ?? u.phoneNumber,
                  role: payload.type ?? u.role,
                  profilePicture: payload.profilePicture ?? u.profilePicture,
                }
              : u,
          ),
        );
        setOpenModal(null);
        setFormData({});
        setSelectedUser(null);
      } else {
        alert('ERROR: ' + (await res.text()));
      }
    } catch {
      alert('CONNECTION ERROR');
    }
  };

  // ── Datos filtrados ──────────────────────────────────────────────────────────

  // Tabla de usuarios
  const filteredUsers = userDetails.filter((u) => {
    const q = userSearch.toLowerCase();
    if (!q) return true;
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.teamName || u.managedTeamName || '').toLowerCase().includes(q) ||
      String(u.id).includes(q)
    );
  });

  // Modal New Project → lista de equipos para elegir
  const teamsForProject = userDetails
    .filter((u) => u.teamName || u.managedTeamName)
    .reduce((acc, u) => {
      const name = u.teamName || u.managedTeamName;
      const teamId = u.teamId;
      if (teamId && !acc.find((t) => t.id === teamId)) acc.push({ id: teamId, name });
      return acc;
    }, [])
    .filter((t) => t.name?.toLowerCase().includes(teamSearch.toLowerCase()));

  // Modal New Team → lista de posibles managers
  const managersForTeam = userDetails
    .filter((u) => {
      const role = (u.role || '').toUpperCase();
      return role === 'MANAGER' || role.includes('MANAGER');
    })
    .filter((u) =>
      (u.name || '').toLowerCase().includes(managerSearch.toLowerCase()) ||
      String(u.id).includes(managerSearch),
    );

  // Modal Assign Member → lista de usuarios
  const usersForMember = userDetails.filter((u) =>
    (u.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    String(u.id).includes(memberSearch),
  );

  // Modal Assign Member → lista de equipos
  const teamsForAssign = userDetails
    .reduce((acc, u) => {
      const name = u.teamName || u.managedTeamName;
      const teamId = u.teamId;
      if (teamId && !acc.find((t) => t.id === teamId)) acc.push({ id: teamId, name });
      return acc;
    }, [])
    .filter((t) => (t.name || '').toLowerCase().includes(assignTeamSearch.toLowerCase()));

  // ── Estilos (sin cambios) ────────────────────────────────────────────────────
  const bgColor = isDark ? '#1C1E22' : '#FFFFFF';
  const textColor = isDark ? '#F0F0F0' : '#000000';
  const textSecondary = isDark ? '#9A9A9A' : '#666666';
  const borderColor = isDark ? '#2A2C32' : '#E0E0E0';
  const cardBorder = isDark ? '#2A2C32' : '#E0E0E0';
  const tableHeaderBg = isDark ? '#111214' : '#F5F5F5';
  const tableBorder = isDark ? '#2A2C32' : '#EEE';
  const dividerColor = isDark ? '#2A2C32' : '#E0E0E0';

  const inputSx = {
    '& .MuiInputLabel-root': { color: textSecondary },
    '& .MuiOutlinedInput-root': { color: textColor },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: borderColor },
    '& .MuiSelect-icon': { color: textSecondary },
    '& .MuiSvgIcon-root': { color: textSecondary },
  };

  const dialogButtonSx = {
    cancel: { color: textSecondary },
    create: {
      bgcolor: isDark ? '#3A3C42' : '#000',
      color: '#fff',
      '&:hover': { bgcolor: isDark ? '#4A4C52' : '#333' },
    },
    save: {
      bgcolor: isDark ? '#3A3C42' : '#000',
      color: '#fff',
      '&:hover': { bgcolor: isDark ? '#4A4C52' : '#333' },
    },
    register: {
      bgcolor: '#E53935',
      color: '#fff',
      '&:hover': { bgcolor: '#C62828' },
    },
  };

  // ── Subcomponente: lista seleccionable dentro de modals ──────────────────────
  const SelectableList = ({ items, selectedId, onSelect: onSelectItem, labelKey = 'name', emptyText = 'No results' }) => (
    <Box
      sx={{
        maxHeight: 140,
        overflowY: 'auto',
        border: `1px solid ${borderColor}`,
        borderRadius: 1,
        mt: 0.5,
        mb: 1,
      }}
    >
      {items.length === 0 ? (
        <Typography sx={{ p: 1.5, color: textSecondary, fontSize: '0.8rem' }}>{emptyText}</Typography>
      ) : (
        items.map((item) => (
          <Box
            key={item.id}
            onClick={() => onSelectItem(item)}
            sx={{
              px: 2,
              py: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: selectedId === item.id ? (isDark ? '#2A2C32' : '#F5F5F5') : 'transparent',
              borderLeft: selectedId === item.id ? '3px solid #E53935' : '3px solid transparent',
              '&:hover': { bgcolor: isDark ? '#22242A' : '#FAFAFA' },
            }}
          >
            <Typography sx={{ fontSize: '0.85rem', color: textColor, fontWeight: selectedId === item.id ? 700 : 400 }}>
              {item[labelKey]}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: textSecondary }}>ID: {item.id}</Typography>
          </Box>
        ))
      )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: bgColor, py: 6 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, color: textColor }}>
            ORACLE
          </Typography>
          <div
            style={{
              margin: '0 auto',
              width: '60px',
              height: '4px',
              backgroundColor: '#E53935',
              marginBottom: '20px',
            }}
          />
          <Typography variant="h5" sx={{ color: textSecondary }}>
            {mode === 'manager' || mode === 'developer'
              ? 'Select your project'
              : 'System Administration'}
          </Typography>
        </Box>

        {mode === 'admin' && (
          <Grid container spacing={2} sx={{ mb: 6, justifyContent: 'center' }}>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<AddBoxIcon />}
                onClick={() => openAndClear('project')}
                sx={{
                  bgcolor: isDark ? '#2A2C32' : '#000',
                  color: '#fff',
                  border: isDark ? '1px solid #444' : 'none',
                  '&:hover': { bgcolor: isDark ? '#3A3C42' : '#333' },
                }}
              >
                New Project
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<GroupAddIcon />}
                onClick={() => openAndClear('team')}
                sx={{ color: textColor, borderColor: borderColor, '&:hover': { borderColor: '#E53935', color: '#E53935' } }}
              >
                New Team
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => openAndClear('member')}
                sx={{ color: textColor, borderColor: borderColor, '&:hover': { borderColor: '#E53935', color: '#E53935' } }}
              >
                Assign Member
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => openAndClear('user')}
                sx={{ bgcolor: '#E53935', color: '#fff', '&:hover': { bgcolor: '#C62828' } }}
              >
                Register User
              </Button>
            </Grid>
          </Grid>
        )}

        <Divider sx={{ mb: 4, borderColor: dividerColor }}>
          <Typography sx={{ color: textSecondary }}>ACTIVE PROJECTS</Typography>
        </Divider>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <CircularProgress sx={{ color: '#E53935' }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 6 }}>
            {error}
          </Alert>
        ) : projects.length === 0 && (mode === 'manager' || mode === 'developer') ? (
          <Typography sx={{ textAlign: 'center', color: textSecondary, mb: 6 }}>
            {mode === 'developer'
              ? 'No projects found for your account. Ask your manager to add you to a project team.'
              : 'No registered projects found. If you just logged in, please refresh the page; if the issue persists, contact an administrator.'}
          </Typography>
        ) : (
          <Grid container spacing={3} sx={{ mb: 8 }}>
            {projects.map((proj) => (
              <Grid item xs={12} sm={4} key={proj.id}>
                <Card
                  onClick={() => onSelect && onSelect(proj)}
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    border: `1px solid ${cardBorder}`,
                    bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': {
                      borderColor: '#E53935',
                      boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: textColor }}>{proj.name}</Typography>
                  <ArrowForwardIosIcon sx={{ fontSize: 12, color: isDark ? '#5A5A5A' : '#CCC' }} />
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {mode === 'admin' && (
          <>
            <Divider sx={{ mb: 3, borderColor: dividerColor }}>
              <Typography sx={{ color: textSecondary }}>USER DETAILS</Typography>
            </Divider>

            {/* ── Filtro tabla de usuarios ── */}
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                placeholder="Search by name, email, role, team or ID…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: textSecondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  ...inputSx,
                  '& .MuiOutlinedInput-root': {
                    color: textColor,
                    '& fieldset': { borderColor: borderColor },
                    '&:hover fieldset': { borderColor: '#E53935' },
                    '&.Mui-focused fieldset': { borderColor: '#E53935' },
                  },
                }}
              />
              {userSearch && (
                <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: textSecondary }}>
                  {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} of {userDetails.length}
                </Typography>
              )}
            </Box>

            <TableContainer
              component={Paper}
              sx={{ border: `1px solid ${tableBorder}`, boxShadow: 'none', mb: 4, bgcolor: bgColor }}
            >
              <Table>
                <TableHead sx={{ bgcolor: tableHeaderBg }}>
                  <TableRow>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>ID</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>USER</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>EMAIL</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>PHONE</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>ROLE</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>TEAM</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>PROJECTS</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ textAlign: 'center', color: textSecondary }}>
                        {userSearch
                          ? `No users match "${userSearch}".`
                          : 'No users found. Make sure the backend is running and users exist.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} sx={{ borderBottom: `1px solid ${tableBorder}` }}>
                        <TableCell sx={{ color: textSecondary }}>{user.id}</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: textColor }}>{user.name?.toUpperCase()}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.email || '---'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.phoneNumber || '---'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.role || 'NO ROLE'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>
                          {(user.teamName || user.managedTeamName || '---').toUpperCase()}
                        </TableCell>
                        {/* Una celda con todos los proyectos del usuario separados por coma */}
                        <TableCell sx={{ color: textSecondary }}>
                          {user.projects && user.projects.length > 0
                            ? user.projects.join(', ')
                            : '---'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => handleEditUser(user)}
                            sx={{ mr: 1, color: '#E53935' }}
                          >
                            EDIT
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleDeleteUser(user.id)}
                            sx={{ color: '#C62828' }}
                          >
                            DELETE
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* Modal NEW PROJECT */}
        <Dialog
          open={openModal === 'project'}
          onClose={() => setOpenModal(null)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: isDark ? '#1C1E22' : '#FFFFFF', border: `1px solid ${borderColor}` } }}
        >
          <DialogTitle sx={{ color: textColor }}>NEW PROJECT</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="NAME" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />

            {/* ── Búsqueda de equipo ── */}
            <Typography variant="caption" sx={{ color: textSecondary, mt: 1.5, display: 'block' }}>
              ASSIGN TEAM
            </Typography>
            <TextField
              fullWidth size="small" margin="dense"
              placeholder="Search team by name…"
              value={teamSearch}
              onChange={(e) => setTeamSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: textSecondary }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <SelectableList
              items={teamsForProject}
              selectedId={formData.assignedTeam?.id}
              onSelect={(t) => setFormData({ ...formData, assignedTeam: { id: t.id } })}
              emptyText="No teams found — you can also type a Team ID below"
            />
            <TextField
              fullWidth label="TEAM ID (manual)" type="number" margin="dense"
              value={formData.assignedTeam?.id || ''}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setFormData({ ...formData, assignedTeam: { id: v } });
              }}
              sx={inputSx}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>CREATE</Button>
          </DialogActions>
        </Dialog>

        {/* Modal NEW TEAM */}
        <Dialog
          open={openModal === 'team'}
          onClose={() => setOpenModal(null)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: isDark ? '#1C1E22' : '#FFFFFF', border: `1px solid ${borderColor}` } }}
        >
          <DialogTitle sx={{ color: textColor }}>NEW TEAM</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="NAME" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />

            {/* ── Búsqueda de manager ── */}
            <Typography variant="caption" sx={{ color: textSecondary, mt: 1.5, display: 'block' }}>
              ASSIGN MANAGER
            </Typography>
            <TextField
              fullWidth size="small" margin="dense"
              placeholder="Search manager by name or ID…"
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: textSecondary }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <SelectableList
              items={managersForTeam}
              selectedId={formData.manager?.id}
              onSelect={(u) => setFormData({ ...formData, manager: { id: u.id } })}
              emptyText="No managers found — you can also type a Manager ID below"
            />
            <TextField
              fullWidth label="MANAGER ID (manual)" type="number" margin="dense"
              value={formData.manager?.id || ''}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setFormData({ ...formData, manager: { id: v } });
              }}
              sx={inputSx}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>CREATE</Button>
          </DialogActions>
        </Dialog>

        {/* Modal ASSIGN MEMBER */}
        <Dialog
          open={openModal === 'member'}
          onClose={() => setOpenModal(null)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: isDark ? '#1C1E22' : '#FFFFFF', border: `1px solid ${borderColor}` } }}
        >
          <DialogTitle sx={{ color: textColor }}>ASSIGN MEMBER</DialogTitle>
          <DialogContent>

            {/* ── Búsqueda de usuario ── */}
            <Typography variant="caption" sx={{ color: textSecondary, mt: 0.5, display: 'block' }}>
              SELECT USER
            </Typography>
            <TextField
              fullWidth size="small" margin="dense"
              placeholder="Search user by name or ID…"
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: textSecondary }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <SelectableList
              items={usersForMember}
              selectedId={formData.user?.id}
              onSelect={(u) => setFormData({ ...formData, user: { id: u.id } })}
              emptyText="No users found"
            />
            <TextField
              fullWidth label="USER ID (manual)" type="number" margin="dense"
              value={formData.user?.id || ''}
              onChange={(e) => setFormData({ ...formData, user: { id: parseInt(e.target.value, 10) } })}
              sx={inputSx}
            />

            {/* ── Búsqueda de equipo ── */}
            <Typography variant="caption" sx={{ color: textSecondary, mt: 1, display: 'block' }}>
              SELECT TEAM
            </Typography>
            <TextField
              fullWidth size="small" margin="dense"
              placeholder="Search team by name…"
              value={assignTeamSearch}
              onChange={(e) => setAssignTeamSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: textSecondary }} />
                  </InputAdornment>
                ),
              }}
              sx={inputSx}
            />
            <SelectableList
              items={teamsForAssign}
              selectedId={formData.team?.id}
              onSelect={(t) => setFormData({ ...formData, team: { id: t.id } })}
              emptyText="No teams found"
            />
            <TextField
              fullWidth label="TEAM ID (manual)" type="number" margin="dense"
              value={formData.team?.id || ''}
              onChange={(e) => setFormData({ ...formData, team: { id: parseInt(e.target.value, 10) } })}
              sx={inputSx}
            />

            <TextField
              fullWidth select label="ROLE" margin="dense"
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value.toUpperCase() })}
              sx={inputSx}
            >
              <MenuItem value="MANAGER" sx={{ color: textColor }}>MANAGER</MenuItem>
              <MenuItem value="DEVELOPER" sx={{ color: textColor }}>DEVELOPER</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>ASSIGN</Button>
          </DialogActions>
        </Dialog>

        {/* Modal REGISTER USER */}
        <Dialog
          open={openModal === 'user'}
          onClose={() => setOpenModal(null)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: isDark ? '#1C1E22' : '#FFFFFF', border: `1px solid ${borderColor}` } }}
        >
          <DialogTitle sx={{ color: textColor }}>REGISTER USER</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="NAME" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="EMAIL" margin="dense"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="PHONE NUMBER" margin="dense"
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="PASSWORD" type="password" margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })} sx={inputSx} />
            <Autocomplete
              freeSolo
              options={TEAM_MEMBER_TYPE_SUGGESTIONS}
              value={formData.type || ''}
              onChange={(_, value) => setFormData({ ...formData, type: value || '' })}
              onInputChange={(_, value) => setFormData({ ...formData, type: value || '' })}
              renderInput={(params) => (
                <TextField {...params} fullWidth label="TYPE / ROLE" margin="dense"
                  placeholder="e.g. Frontend Developer"
                  helperText="Team role (e.g. DevOps Engineer) or MANAGER. ADMIN is not allowed here."
                  sx={inputSx} />
              )}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: textSecondary, mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ width: '100%', color: textColor }} />
              {formData.profilePicture && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <img src={formData.profilePicture} alt="preview"
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E53935' }} />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.register}>REGISTER</Button>
          </DialogActions>
        </Dialog>

        {/* Modal EDIT USER */}
        <Dialog
          open={openModal === 'editUser'}
          onClose={() => setOpenModal(null)}
          maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: isDark ? '#1C1E22' : '#FFFFFF', border: `1px solid ${borderColor}` } }}
        >
          <DialogTitle sx={{ color: textColor }}>EDIT USER — {selectedUser?.name?.toUpperCase()}</DialogTitle>
          <DialogContent>
            <TextField fullWidth label="NAME" margin="dense"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="EMAIL" margin="dense"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="PHONE NUMBER" margin="dense"
              value={formData.phoneNumber || ''}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} sx={inputSx} />
            <TextField fullWidth label="PASSWORD (leave blank to keep current)" type="password" margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })} sx={inputSx} />
            <Autocomplete
              freeSolo
              options={TEAM_MEMBER_TYPE_SUGGESTIONS}
              value={formData.type || ''}
              onChange={(_, value) => setFormData({ ...formData, type: value || '' })}
              onInputChange={(_, value) => setFormData({ ...formData, type: value || '' })}
              renderInput={(params) => (
                <TextField {...params} fullWidth label="TYPE / ROLE" margin="dense"
                  placeholder="e.g. Backend Developer"
                  helperText="Team role (e.g. DevOps Engineer) or MANAGER. ADMIN is not allowed here."
                  sx={inputSx} />
              )}
            />
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: textSecondary, mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input type="file" accept="image/*" onChange={handleImageUpload}
                style={{ width: '100%', color: textColor }} />
              {formData.profilePicture && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <img src={formData.profilePicture} alt="preview"
                    style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #E53935' }} />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleEditAction} variant="contained" sx={dialogButtonSx.save}>SAVE</Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default ProjectSelector;