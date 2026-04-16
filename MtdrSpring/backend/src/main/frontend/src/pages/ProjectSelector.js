import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, Grid, Card, Button, CircularProgress } from '@mui/material';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

const ProjectSelector = ({ onSelect }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/all`);
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (err) {
        console.error('Error loading projects:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleSelect = (project) => {
    localStorage.setItem('selectedProjectId', project.id);
    localStorage.setItem('selectedProjectName', project.name);
    onSelect();
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#FFFFFF', // <--- Fondo Blanco
      color: '#333' 
    }}>
      <Container maxWidth="md">
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          {/* Logo in black/red for contrast on white */}
          <Typography sx={{ 
            fontSize: '2.5rem', 
            fontWeight: 900, 
            letterSpacing: 4, 
            color: '#000',
            mb: 1 
          }}>
            ORACLE
          </Typography>
          <div style={{ 
            margin: '0 auto', 
            width: '60px', 
            height: '4px', 
            backgroundColor: '#E53935',
            marginBottom: '20px' 
          }} />
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#111', mb: 1 }}>
            Project selection
          </Typography>
          <Typography sx={{ color: '#666' }}>
            Choose an environment to manage your tasks and sprints
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress sx={{ color: '#E53935' }} />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {projects.map((proj) => (
              <Grid item xs={12} sm={6} key={proj.id}>
                <Card 
                  onClick={() => handleSelect(proj)}
                  sx={{ 
                    p: 4, 
                    bgcolor: '#FFF', 
                    color: '#333', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: '1px solid #E0E0E0', // Borde gris claro
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    '&:hover': { 
                      borderColor: '#E53935',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FolderSpecialIcon sx={{ color: '#E53935', fontSize: 32 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#111' }}>
                        {proj.name}
                      </Typography>
                      <Typography sx={{ color: '#999', fontSize: '0.75rem' }}>
                        ID: {proj.id}
                      </Typography>
                    </Box>
                  </Box>
                  <ArrowForwardIosIcon sx={{ fontSize: 14, color: '#CCC' }} />
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <Button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            sx={{ 
              color: '#999', 
              fontSize: '0.8rem', 
              textTransform: 'none',
              '&:hover': { color: '#E53935', bgcolor: 'transparent' } 
            }}
          >
            Sign out and exit
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default ProjectSelector;