import React, { useState, useEffect, useMemo } from 'react';
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
import { fetchDashboardSprints, invalidateDashboardCache } from '../dashboard/dashboardSprintData';
import { SECTION_ACCENT, sectionRgba } from '../dashboard/constants/dashboardConstants';
import { pageEase } from './aiInsightsConstants';
import InsightCard from './InsightCard';

export default function AIInsightsPage({ projectId }) {
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const onFocus = () => setRefreshToken((v) => v + 1);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') setRefreshToken((v) => v + 1);
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRefreshToken((v) => v + 1), 15000);
    return () => clearInterval(id);
  }, []);

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
    invalidateDashboardCache();
    fetchDashboardSprints(pid, { forceFresh: true })
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter((s) => String(s.assignedProject?.id) === String(pid))
          : [];
        setSprints(filtered);
        setSelectedSprintId((prev) => {
          if (filtered.length === 0) return null;
          if (prev != null && filtered.some((s) => Number(s.id) === Number(prev))) return prev;
          const active = filtered.find((s) => {
            const now = new Date();
            return now >= new Date(s.startDate) && now <= new Date(s.dueDate);
          });
          return active?.id ?? filtered[filtered.length - 1]?.id ?? null;
        });
      })
      .catch(() => setSprints([]))
      .finally(() => setLoading(false));
  }, [projectId, refreshToken]);

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  /** Latest sprint in the project by due date (then start date, then id). */
  const mostRecentSprintId = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return null;
    const sorted = [...sprints].sort((a, b) => {
      const endA = new Date(a.dueDate ?? 0).getTime();
      const endB = new Date(b.dueDate ?? 0).getTime();
      if (endB !== endA) return endB - endA;
      const startA = new Date(a.startDate ?? 0).getTime();
      const startB = new Date(b.startDate ?? 0).getTime();
      if (startB !== startA) return startB - startA;
      return Number(b.id) - Number(a.id);
    });
    return sorted[0]?.id ?? null;
  }, [sprints]);

  /** Sprint that contains "today" (same rule as default selection). */
  const activeSprintId = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return null;
    const now = new Date();
    const active = sprints.find((s) => now >= new Date(s.startDate) && now <= new Date(s.dueDate));
    return active?.id ?? null;
  }, [sprints]);

  /**
   * Predictions (outlook + next-sprint card) only for the active sprint, or — if none —
   * the chronologically latest sprint by end date (not older closed sprints).
   */
  const showPredictionsSection = useMemo(() => {
    if (selectedSprintId == null) return false;
    if (activeSprintId != null) {
      return Number(selectedSprintId) === Number(activeSprintId);
    }
    return mostRecentSprintId != null && Number(selectedSprintId) === Number(mostRecentSprintId);
  }, [selectedSprintId, activeSprintId, mostRecentSprintId]);

  const showNextSprintForecast =
    mostRecentSprintId != null &&
    selectedSprintId != null &&
    Number(selectedSprintId) === Number(mostRecentSprintId);

  if (loading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#C74634' }} />
      </Box>
    );

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: pageEase }}
      sx={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        px: { xs: 1, sm: 2, md: 3 },
        py: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          mb: 2.5,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, minWidth: 0 }}>
            <Sparkles size={28} color="#673AB7" />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#1A1A1A',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.65rem', md: '2rem' },
              }}
            >
              AI Insights
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: '#607D8B', fontWeight: 600, maxWidth: '56rem' }}>
            Gemini-powered sprint analysis: automatic alerts, actionable recommendations, summary,
            per-developer insights, and predictions
          </Typography>
        </Box>
        {sprints.length > 0 && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', minWidth: { xs: '100%', sm: 220 } }}>
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
                '& .MuiSelect-select': {
                  color: '#1A1A1A',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pr: 4,
                },
                '& .MuiSelect-icon': { color: '#546E7A' },
                '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
                  borderColor: sectionRgba(0.32),
                },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: sectionRgba(0.48),
                },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderWidth: 2,
                  borderColor: SECTION_ACCENT,
                },
                '& .MuiInputLabel-root': { color: '#607D8B' },
                '& .MuiInputLabel-root.Mui-focused': { color: SECTION_ACCENT },
              }}
            >
              <InputLabel id="ai-insights-sprint-filter" shrink>
                Sprint
              </InputLabel>
              <Select
                labelId="ai-insights-sprint-filter"
                label="Sprint"
                value={selectedSprintId ?? ''}
                onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                displayEmpty
                renderValue={(value) => {
                  if (value === '' || value == null) return 'Select sprint';
                  return `Sprint ${value}`;
                }}
              >
                {sprints.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    Sprint {s.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
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
          showPredictionsSection={showPredictionsSection}
          showNextSprintForecast={showNextSprintForecast}
          refreshToken={refreshToken}
        />
      )}
    </Box>
  );
}
