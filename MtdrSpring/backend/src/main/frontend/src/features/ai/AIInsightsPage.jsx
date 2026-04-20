import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Sparkles } from 'lucide-react';
import { fetchDashboardSprints } from '../dashboard/dashboardSprintData';
import { pageEase } from './aiInsightsConstants';
import InsightCard from './InsightCard';

export default function AIInsightsPage({ projectId }) {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  useEffect(() => {
    const pid =
      projectId != null && String(projectId).trim() !== ''
        ? String(projectId).trim()
        : typeof localStorage !== 'undefined'
          ? String(localStorage.getItem('currentProjectId') || '').trim()
          : '';
    if (!pid) {
      setLoading(false);
      return;
    }
    fetchDashboardSprints(pid)
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter((s) => String(s.assignedProject?.id) === String(pid))
          : [];
        setSprints(filtered);
        if (filtered.length > 0) {
          const active = filtered.find((s) => {
            const now = new Date();
            return now >= new Date(s.startDate) && now <= new Date(s.dueDate);
          });
          setSelectedSprintId(active?.id ?? filtered[filtered.length - 1]?.id ?? null);
        }
      })
      .catch(() => setSprints([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  if (loading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#673AB7' }} />
      </Box>
    );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: pageEase }}
      sx={{ maxWidth: 900, width: '100%' }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Sparkles size={22} color="#673AB7" />
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.5px' }}
            >
              AI Insights
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ color: '#607D8B', fontWeight: 600 }}>
            Gemini-powered sprint analysis — alerts, workload recommendations, and productivity
            forecasts
          </Typography>
        </Box>
        {sprints.length > 0 && (
          <FormControl
            size="small"
            sx={{
              minWidth: 200,
              '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
            }}
          >
            <InputLabel>Sprint</InputLabel>
            <Select
              value={selectedSprintId || ''}
              label="Sprint"
              onChange={(e) => setSelectedSprintId(Number(e.target.value))}
            >
              {sprints.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  Sprint {s.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
      {sprints.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
          <Typography color="textSecondary">No sprints found for this project.</Typography>
        </Paper>
      )}
      {selectedSprint && (
        <InsightCard
          key={selectedSprint.id}
          sprintId={selectedSprint.id}
          sprintLabel={`Sprint ${selectedSprint.id}`}
        />
      )}
    </Box>
  );
}
