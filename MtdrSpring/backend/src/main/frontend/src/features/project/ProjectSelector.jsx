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
} from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import AddBoxIcon from '@mui/icons-material/AddBox';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const ProjectSelector = ({ onSelect, mode = 'admin' }) => {
  const [projects, setProjects] = useState([]);
  const [userDetails, setUserDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const managerAutoSelectedRef = useRef(false);
  const [openModal, setOpenModal] = useState(null);
  const [formData, setFormData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resProj, resUsers] = await Promise.all([
        fetch(`${API_BASE}/api/projects/all`),
        fetch(`${API_BASE}/users/details`),
      ]);
      if (resProj.ok) setProjects(await resProj.json());
      if (resUsers.ok) setUserDetails(await resUsers.json());
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Only projects where this user is the team's manager (same rules as backend listProjectsForManager). */
  const fetchManagerProjects = async () => {
    setLoading(true);
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
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setProjects([]);
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

  /** If the manager has exactly one assigned project, enter the app without an extra click. */
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
    setFormData({ name: user.name, type: user.role, email: user.email });
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

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FFFFFF', py: 6 }}>
      <Container maxWidth="lg">
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, color: '#000' }}>
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
          <Typography variant="h5">
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
                sx={{ bgcolor: '#000' }}
              >
                New Project
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<GroupAddIcon />}
                onClick={() => openAndClear('team')}
                sx={{ color: '#000', borderColor: '#000' }}
              >
                New Team
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={() => openAndClear('member')}
                sx={{ color: '#000', borderColor: '#000' }}
              >
                Assign Member
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                startIcon={<PersonAddIcon />}
                onClick={() => openAndClear('user')}
                sx={{ bgcolor: '#E53935' }}
              >
                Register User
              </Button>
            </Grid>
          </Grid>
        )}

        <Divider sx={{ mb: 4 }}>ACTIVE PROJECTS</Divider>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <CircularProgress />
          </Box>
        ) : projects.length === 0 && mode === 'manager' ? (
          <Typography sx={{ textAlign: 'center', color: '#666', mb: 6 }}>
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
                    border: '1px solid #E0E0E0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': { borderColor: '#000', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
                  }}
                >
                  <Typography sx={{ fontWeight: 700 }}>{proj.name}</Typography>
                  <ArrowForwardIosIcon sx={{ fontSize: 12, color: '#CCC' }} />
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {mode === 'admin' && (
          <>
            <Divider sx={{ mb: 4 }}>USER DETAILS</Divider>
            <TableContainer
              component={Paper}
              sx={{ border: '1px solid #EEE', boxShadow: 'none', mb: 4 }}
            >
              <Table>
                <TableHead sx={{ bgcolor: '#F5F5F5' }}>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>USER</TableCell>
                    <TableCell>ROLE</TableCell>
                    <TableCell>TEAM ID</TableCell>
                    <TableCell>TEAM</TableCell>
                    <TableCell>PROJECT</TableCell>
                    <TableCell>ACTIONS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userDetails.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{user.name?.toUpperCase()}</TableCell>
                      <TableCell>{user.role ? user.role.toUpperCase() : 'NO ROLE'}</TableCell>
                      <TableCell>{user.teamId || '---'}</TableCell>
                      <TableCell>
                        {(user.teamName || user.managedTeamName || '---').toUpperCase()}
                      </TableCell>
                      <TableCell>{user.projectName || '---'}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          onClick={() => handleEditUser(user)}
                          sx={{ mr: 1, color: '#000' }}
                        >
                          EDIT
                        </Button>
                        <Button
                          size="small"
                          onClick={() => handleDeleteUser(user.id)}
                          sx={{ color: '#E53935' }}
                        >
                          DELETE
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* --- MODALS --- */}

        <Dialog open={openModal === 'project'} onClose={() => setOpenModal(null)}>
          <DialogTitle>NEW PROJECT</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>
              CREATE
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'team'} onClose={() => setOpenModal(null)}>
          <DialogTitle>NEW TEAM</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>
              CREATE
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'member'} onClose={() => setOpenModal(null)}>
          <DialogTitle>ASSIGN MEMBER</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="USER ID"
              type="number"
              margin="dense"
              onChange={(e) =>
                setFormData({ ...formData, user: { id: parseInt(e.target.value, 10) } })
              }
            />
            <TextField
              fullWidth
              label="TEAM ID"
              type="number"
              margin="dense"
              onChange={(e) =>
                setFormData({ ...formData, team: { id: parseInt(e.target.value, 10) } })
              }
            />
            <TextField
              fullWidth
              select
              label="ROLE"
              margin="dense"
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value.toUpperCase() })}
            >
              <MenuItem value="MANAGER">MANAGER</MenuItem>
              <MenuItem value="DEVELOPER">DEVELOPER</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>
              ASSIGN
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'user'} onClose={() => setOpenModal(null)}>
          <DialogTitle>REGISTER USER</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="EMAIL"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              fullWidth
              label="PASSWORD"
              type="password"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
            />
            <TextField
              fullWidth
              select
              label="TYPE"
              margin="dense"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
            >
              <MenuItem value="MANAGER">MANAGER</MenuItem>
              <MenuItem value="DEVELOPER">DEVELOPER</MenuItem>
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: '#666', mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ width: '100%' }}
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
            <Button onClick={() => setOpenModal(null)}>CANCEL</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#E53935' }}>
              REGISTER
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'editUser'} onClose={() => setOpenModal(null)}>
          <DialogTitle>EDIT USER — {selectedUser?.name?.toUpperCase()}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="NAME"
              margin="dense"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth
              label="EMAIL"
              margin="dense"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              fullWidth
              label="PASSWORD"
              type="password"
              margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
            />
            <TextField
              fullWidth
              select
              label="TYPE"
              margin="dense"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
            >
              <MenuItem value="MANAGER">MANAGER</MenuItem>
              <MenuItem value="DEVELOPER">DEVELOPER</MenuItem>
            </TextField>

            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: '#666', mb: 1, display: 'block' }}>
                PROFILE PICTURE (optional)
              </Typography>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ width: '100%' }}
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
            <Button onClick={() => setOpenModal(null)}>CANCEL</Button>
            <Button onClick={handleEditAction} variant="contained" sx={{ bgcolor: '#000' }}>
              SAVE
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default ProjectSelector;