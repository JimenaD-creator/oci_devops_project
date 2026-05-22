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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AddBoxIcon from '@mui/icons-material/AddBox';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const ProjectSelector = ({ onSelect, mode = 'admin' }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [projects, setProjects] = useState([]);
  const [userDetails, setUserDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const managerAutoSelectedRef = useRef(false);
  const [openModal, setOpenModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let usersResponse = await fetch(`${API_BASE}/users/details`);
      
      if (!usersResponse.ok) {
        console.log('Trying /users endpoint instead...');
        usersResponse = await fetch(`${API_BASE}/users`);
      }
      
      const projectsResponse = await fetch(`${API_BASE}/api/projects/all`);
      
      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        setProjects(projectsData);
        console.log('Projects loaded:', projectsData.length);
      } else {
        console.error('Failed to load projects:', projectsResponse.status);
      }
      
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUserDetails(usersData);
        console.log('Users loaded:', usersData.length);
      } else {
        console.error('Failed to load users:', usersResponse.status);
        setError(`Error loading users: ${usersResponse.status}`);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Cannot connect to server. Make sure the backend is running on port 8080.');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      let managerId = null;
      try {
        const raw = localStorage.getItem('currentUser');
        if (raw) {
          const u = JSON.parse(raw);
          const id = u?.id ?? u?.ID;
          if (id != null && String(id).trim() !== '') managerId = String(id).trim();
        }
      } catch {
        managerId = null;
      }
      if (!managerId) {
        setProjects([]);
        setError('No manager ID found. Please log in again.');
        return;
      }
      const resProj = await fetch(
        `${API_BASE}/api/projects/manager/${encodeURIComponent(managerId)}/list`,
      );
      if (resProj.ok) {
        const data = await resProj.json();
        setProjects(Array.isArray(data) ? data : []);
      } else {
        setProjects([]);
        setError(`Error loading projects: ${resProj.status}`);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setProjects([]);
      setError('Cannot connect to server. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'manager') {
      fetchManagerProjects();
    } else {
      fetchData();
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'manager' || loading) return;
    if (projects.length !== 1 || !onSelect || managerAutoSelectedRef.current) return;
    managerAutoSelectedRef.current = true;
    onSelect(projects[0]);
  }, [mode, loading, projects, onSelect]);

  const openAndClear = (modalName) => {
    setFormData({});
    setOpenModal(modalName);
  };

  const handleAction = async () => {
    let endpoint = '';
    if (openModal === 'project') endpoint = '/api/admin/projects';
    if (openModal === 'team') endpoint = '/api/admin/teams';
    if (openModal === 'member') endpoint = '/api/admin/teams/members';
    if (openModal === 'user') endpoint = '/users/create';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
      phonenumber: user.phonenumber || '' 
    });
    setOpenModal('editUser');
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const res = await fetch(`${API_BASE}/users/${userId}`, { method: 'DELETE' });
      if (res.ok) fetchData();
      else alert('ERROR deleting user');
    } catch {
      alert('CONNECTION ERROR');
    }
  };

  const handleEditAction = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setOpenModal(null);
        setFormData({});
        setSelectedUser(null);
        fetchData();
      } else {
        alert('ERROR: ' + (await res.text()));
      }
    } catch {
      alert('CONNECTION ERROR');
    }
  };

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
      '&:hover': { bgcolor: isDark ? '#4A4C52' : '#333' } 
    },
    save: {
      bgcolor: isDark ? '#3A3C42' : '#000',
      color: '#fff',
      '&:hover': { bgcolor: isDark ? '#4A4C52' : '#333' }
    },
    register: {
      bgcolor: '#E53935',
      color: '#fff',
      '&:hover': { bgcolor: '#C62828' }
    }
  };

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
            {mode === 'manager' ? 'Select your project' : 'System Administration'}
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
                  '&:hover': { bgcolor: isDark ? '#3A3C42' : '#333' } 
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
        ) : projects.length === 0 && mode === 'manager' ? (
          <Typography sx={{ textAlign: 'center', color: textSecondary, mb: 6 }}>
            No registered projects found. If you just logged in, please refresh the page; if the 
            issue persists, contact an administrator.
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
                    '&:hover': { borderColor: '#E53935', boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)' },
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
            <Divider sx={{ mb: 4, borderColor: dividerColor }}>
              <Typography sx={{ color: textSecondary }}>USER DETAILS</Typography>
            </Divider>
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
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>TEAM ID</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>TEAM</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>PROJECT</TableCell>
                    <TableCell sx={{ color: textColor, fontWeight: 700 }}>ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userDetails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ textAlign: 'center', color: textSecondary }}>
                        No users found. Make sure the backend is running and users exist.
                      </TableCell>
                    </TableRow>
                  ) : (
                    userDetails.map((user) => (
                      <TableRow key={user.id} sx={{ borderBottom: `1px solid ${tableBorder}` }}>
                        <TableCell sx={{ color: textSecondary }}>{user.id}</TableCell>
                        <TableCell sx={{ fontWeight: 600, color: textColor }}>{user.name?.toUpperCase()}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.email || '---'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.phonenumber || '---'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.role ? user.role.toUpperCase() : 'NO ROLE'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.teamId || '---'}</TableCell>
                        <TableCell sx={{ color: textSecondary }}>
                          {(user.teamName || user.managedTeamName || '---').toUpperCase()}
                        </TableCell>
                        <TableCell sx={{ color: textSecondary }}>{user.projectName || '---'}</TableCell>
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
          PaperProps={{
            sx: {
              bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              border: `1px solid ${borderColor}`,
            }
          }}
        >
          <DialogTitle sx={{ color: textColor }}>NEW PROJECT</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="TEAM ID"
              type="number"
              margin="dense"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setFormData({ ...formData, assignedTeam: { id: v } });
              }}
              sx={inputSx}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>
              CREATE
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal NEW TEAM */}
        <Dialog 
          open={openModal === 'team'} 
          onClose={() => setOpenModal(null)}
          PaperProps={{
            sx: {
              bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              border: `1px solid ${borderColor}`,
            }
          }}
        >
          <DialogTitle sx={{ color: textColor }}>NEW TEAM</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="MANAGER ID"
              type="number"
              margin="dense"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setFormData({ ...formData, manager: { id: v } });
              }}
              sx={inputSx}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>
              CREATE
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal ASSIGN MEMBER */}
        <Dialog 
          open={openModal === 'member'} 
          onClose={() => setOpenModal(null)}
          PaperProps={{
            sx: {
              bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              border: `1px solid ${borderColor}`,
            }
          }}
        >
          <DialogTitle sx={{ color: textColor }}>ASSIGN MEMBER</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="USER ID"
              type="number"
              margin="dense"
              onChange={(e) =>
                setFormData({ ...formData, user: { id: parseInt(e.target.value, 10) } })
              }
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="TEAM ID"
              type="number"
              margin="dense"
              onChange={(e) =>
                setFormData({ ...formData, team: { id: parseInt(e.target.value, 10) } })
              }
              sx={inputSx}
            />
            <TextField
              fullWidth
              select
              label="ROLE"
              margin="dense"
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
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.create}>
              ASSIGN
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal REGISTER USER - CON CAMPO PHONE NUMBER */}
        <Dialog 
          open={openModal === 'user'} 
          onClose={() => setOpenModal(null)}
          PaperProps={{
            sx: {
              bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              border: `1px solid ${borderColor}`,
            }
          }}
        >
          <DialogTitle sx={{ color: textColor }}>REGISTER USER</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="EMAIL"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="PHONE NUMBER"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, phonenumber: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="PASSWORD"
              type="password"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              select
              label="TYPE"
              margin="dense"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
              sx={inputSx}
            >
              <MenuItem value="MANAGER" sx={{ color: textColor }}>MANAGER</MenuItem>
              <MenuItem value="DEVELOPER" sx={{ color: textColor }}>DEVELOPER</MenuItem>
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: textSecondary, mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ width: '100%', color: textColor }}
              />
              {formData.profilePicture && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <img
                    src={formData.profilePicture}
                    alt="preview"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #E53935',
                    }}
                  />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={dialogButtonSx.register}>
              REGISTER
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal EDIT USER - CON CAMPO PHONE NUMBER */}
        <Dialog 
          open={openModal === 'editUser'} 
          onClose={() => setOpenModal(null)}
          PaperProps={{
            sx: {
              bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              border: `1px solid ${borderColor}`,
            }
          }}
        >
          <DialogTitle sx={{ color: textColor }}>EDIT USER — {selectedUser?.name?.toUpperCase()}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="EMAIL"
              margin="dense"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="PHONE NUMBER"
              margin="dense"
              value={formData.phonenumber || ''}
              onChange={(e) => setFormData({ ...formData, phonenumber: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              label="PASSWORD (leave blank to keep current)"
              type="password"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
              sx={inputSx}
            />
            <TextField
              fullWidth
              select
              label="TYPE"
              margin="dense"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
              sx={inputSx}
            >
              <MenuItem value="MANAGER" sx={{ color: textColor }}>MANAGER</MenuItem>
              <MenuItem value="DEVELOPER" sx={{ color: textColor }}>DEVELOPER</MenuItem>
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: textSecondary, mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ width: '100%', color: textColor }}
              />
              {formData.profilePicture && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <img
                    src={formData.profilePicture}
                    alt="preview"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #E53935',
                    }}
                  />
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)} sx={dialogButtonSx.cancel}>CANCEL</Button>
            <Button onClick={handleEditAction} variant="contained" sx={dialogButtonSx.save}>
              SAVE
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default ProjectSelector;