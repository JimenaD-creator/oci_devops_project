import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Container, Typography, Grid, Card, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resProj, resUsers] = await Promise.all([
        fetch(`${API_BASE}/api/projects/all`),
        fetch(`${API_BASE}/users/details`)
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
        `${API_BASE}/api/projects/manager/${encodeURIComponent(managerId)}/list`
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

  /** If the manager has exactly one assigned project, enter the app without an extra click (previous behavior). */
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
    if (openModal === 'team')    endpoint = '/api/admin/teams';
    if (openModal === 'member')  endpoint = '/api/admin/teams/members';
    if (openModal === 'user')    endpoint = '/users/create';

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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
      alert('ERROR DE CONEXIÓN');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#FFFFFF', py: 6 }}>
      <Container maxWidth="lg">

        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '2.5rem', fontWeight: 900, letterSpacing: 4, color: '#000' }}>
            ORACLE
          </Typography>
          <div style={{ margin: '0 auto', width: '60px', height: '4px', backgroundColor: '#E53935', marginBottom: '20px' }} />
          <Typography variant="h5">
            {mode === 'manager' ? 'Selecciona tu proyecto' : 'System Administration'}
          </Typography>
        </Box>

        {mode === 'admin' && (
        <Grid container spacing={2} sx={{ mb: 6, justifyContent: 'center' }}>
          <Grid item>
            <Button variant="contained" startIcon={<AddBoxIcon />} onClick={() => openAndClear('project')} sx={{ bgcolor: '#000' }}>
              Nuevo Proyecto
            </Button>
          </Grid>
          <Grid item>
            <Button variant="outlined" startIcon={<GroupAddIcon />} onClick={() => openAndClear('team')} sx={{ color: '#000', borderColor: '#000' }}>
              Nuevo Equipo
            </Button>
          </Grid>
          <Grid item>
            <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => openAndClear('member')} sx={{ color: '#000', borderColor: '#000' }}>
              Asignar Miembro
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => openAndClear('user')} sx={{ bgcolor: '#E53935' }}>
              Registrar Usuario
            </Button>
          </Grid>
        </Grid>
        )}

        <Divider sx={{ mb: 4 }}>PROYECTOS ACTIVOS</Divider>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <CircularProgress />
          </Box>
        ) : projects.length === 0 && mode === 'manager' ? (
          <Typography sx={{ textAlign: 'center', color: '#666', mb: 6 }}>
            No hay proyectos registrados. Si acabas de iniciar sesión, recarga la página; si el problema continúa, contacta a un administrador.
          </Typography>
        ) : (
          <Grid container spacing={3} sx={{ mb: 8 }}>
            {projects.map((proj) => (
              <Grid item xs={12} sm={4} key={proj.id}>
                <Card
                  onClick={() => onSelect && onSelect(proj)}
                  sx={{
                    p: 3, cursor: 'pointer',
                    border: '1px solid #E0E0E0',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    '&:hover': { borderColor: '#000', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
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
        <Divider sx={{ mb: 4 }}>DETALLES DE USUARIOS</Divider>
        <TableContainer component={Paper} sx={{ border: '1px solid #EEE', boxShadow: 'none', mb: 4 }}>
          <Table>
            <TableHead sx={{ bgcolor: '#F5F5F5' }}>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>USUARIO</TableCell>
                <TableCell>ROL</TableCell>
                <TableCell>ID EQUIPO</TableCell>
                <TableCell>EQUIPO</TableCell>
                <TableCell>PROYECTO</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {userDetails.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{user.name?.toUpperCase()}</TableCell>
                  <TableCell>{user.role ? user.role.toUpperCase() : 'SIN ROL'}</TableCell>
                  <TableCell>{user.teamId || '---'}</TableCell>
                  <TableCell>{(user.teamName || user.managedTeamName || '---').toUpperCase()}</TableCell>
                  <TableCell>{user.projectName || '---'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        </>
        )}

        <Dialog open={openModal === 'project'} onClose={() => setOpenModal(null)}>
          <DialogTitle>NUEVO PROYECTO</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="NOMBRE" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth label="ID EQUIPO" type="number" margin="dense"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setFormData({ ...formData, assignedTeam: { id: v } });
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCELAR</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>CREAR</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'team'} onClose={() => setOpenModal(null)}>
          <DialogTitle>NUEVO EQUIPO</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="NOMBRE" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth label="ID MANAGER" type="number" margin="dense"
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setFormData({ ...formData, manager: { id: v } }); }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCELAR</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>CREAR</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'member'} onClose={() => setOpenModal(null)}>
          <DialogTitle>ASIGNAR MIEMBRO</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="ID USUARIO" type="number" margin="dense"
              onChange={(e) => setFormData({ ...formData, user: { id: parseInt(e.target.value, 10) } })}
            />
            <TextField
              fullWidth label="ID EQUIPO" type="number" margin="dense"
              onChange={(e) => setFormData({ ...formData, team: { id: parseInt(e.target.value, 10) } })}
            />
            <TextField
              fullWidth select label="ROL" margin="dense"
              value={formData.role || ''}
              onChange={(e) => setFormData({ ...formData, role: e.target.value.toUpperCase() })}
            >
              <MenuItem value="MANAGER">MANAGER</MenuItem>
              <MenuItem value="DEVELOPER">DEVELOPER</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCELAR</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#000' }}>ASIGNAR</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openModal === 'user'} onClose={() => setOpenModal(null)}>
          <DialogTitle>REGISTRAR USUARIO</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth label="NOMBRE" margin="dense"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextField
              fullWidth label="EMAIL" margin="dense"
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              fullWidth label="PASSWORD" type="password" margin="dense"
              onChange={(e) => setFormData({ ...formData, userPassword: e.target.value })}
            />
            <TextField
              fullWidth select label="TIPO" margin="dense"
              value={formData.type || ''}
              onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
            >
              <MenuItem value="MANAGER">MANAGER</MenuItem>
              <MenuItem value="DEVELOPER">DEVELOPER</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(null)}>CANCELAR</Button>
            <Button onClick={handleAction} variant="contained" sx={{ bgcolor: '#E53935' }}>REGISTRAR</Button>
          </DialogActions>
        </Dialog>

      </Container>
    </Box>
  );
};

export default ProjectSelector;