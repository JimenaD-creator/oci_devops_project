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
import { useTheme } from '@mui/material/styles';
import { Users, UserCircle } from 'lucide-react';
import { fetchDashboardSprints, invalidateDashboardCache } from '../dashboard/dashboardSprintData';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { pageEase, API_BASE, AI_INSIGHTS_EMPTY } from '../ai/aiInsightsConstants';
import { ORACLE_RED } from '../tasks/constants/taskConstants';
import { pageFormFieldOutline } from '../tasks/utils/taskUtils';
import { DeveloperInsightsTable } from '../ai/InsightCardParts';
import DeveloperRadarCards from '../ai/DeveloperRadarCards';
import DashboardBlockedTasksPanel from '../dashboard/DashboardBlockedTasksPanel';
import TeamWorkloadBreakdown from './TeamWorkloadBreakdown';

export default function TeamPage({
  projectId,
  landingSprintId = null,
  onLandingConsumed,
  onOpenAiInsights,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [developerInsightRows, setDeveloperInsightRows] = useState(null);

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
          const defaultSprint = pickDefaultSelectedSprint(filtered);
          return defaultSprint?.id ?? filtered[filtered.length - 1]?.id ?? null;
        });
      })
      .catch(() => setSprints([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (loading || landingSprintId == null) return;
    if (sprints.length === 0) {
      onLandingConsumed?.();
      return;
    }
    const match = sprints.some((s) => Number(s.id) === Number(landingSprintId));
    if (match) setSelectedSprintId(Number(landingSprintId));
    onLandingConsumed?.();
  }, [loading, landingSprintId, sprints, onLandingConsumed]);

  useEffect(() => {
    if (selectedSprintId == null) {
      setDeveloperInsightRows(null);
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setDeveloperInsightRows(null);
    fetch(`${API_BASE}/api/insights/sprint/${selectedSprintId}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('insights fetch failed');
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) {
          if (!cancelled) setDeveloperInsightRows([]);
          return;
        }
        if (data.error) {
          if (!cancelled) setDeveloperInsightRows([]);
          return;
        }
        const rows = data.insights?.developerInsights;
        if (!cancelled) setDeveloperInsightRows(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setDeveloperInsightRows([]);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSprintId]);

  const selectedSprint = sprints.find((s) => Number(s.id) === Number(selectedSprintId));

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#C74634' }} />
      </Box>
    );
  }

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
            <Users size={28} color={ORACLE_RED} aria-hidden />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.65rem', md: '2rem' },
              }}
            >
              Team
            </Typography>
          </Box>
        </Box>
        {sprints.length > 0 && (
          <Box
            sx={{
              ml: 'auto',
              display: 'flex',
              alignItems: 'center',
              minWidth: { xs: '100%', sm: 220 },
            }}
          >
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                ...pageFormFieldOutline(),
                '& .MuiSelect-select': {
                  color: 'text.primary',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pr: 4,
                },
              }}
            >
              <InputLabel id="team-page-sprint-filter" shrink>
                Sprint
              </InputLabel>
              <Select
                labelId="team-page-sprint-filter"
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
        <Paper sx={{ 
          p: 4, 
          textAlign: 'center', 
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}>
          <Typography color="textSecondary">No sprints found for this project.</Typography>
        </Paper>
      )}

      {selectedSprint && (
        <>
          <TeamWorkloadBreakdown
            sprint={selectedSprint}
            aiDeveloperInsights={developerInsightRows}
          />

          <DashboardBlockedTasksPanel selectedSprints={[selectedSprint]} />

          <Paper
            sx={{
              mb: 3,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              bgcolor: 'background.paper',
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.25,
                bgcolor: isDark ? 'rgba(92, 107, 192, 0.15)' : 'rgba(92, 107, 192, 0.1)',
                borderBottom: '1px solid',
                borderBottomColor: isDark ? 'rgba(57, 73, 171, 0.3)' : 'rgba(57, 73, 171, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <UserCircle size={22} color="#3949AB" aria-hidden />
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary' }}>
                AI per-developer analysis
              </Typography>
            </Box>
            <Box sx={{ p: { xs: 1.5, md: 2 } }}>
              {insightsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} sx={{ color: '#673AB7' }} />
                </Box>
              ) : developerInsightRows?.length > 0 ? (
                <DeveloperInsightsTable rows={developerInsightRows} />
              ) : (
                <Typography
                  sx={{
                    fontSize: { xs: '0.95rem', md: '1rem' },
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  }}
                >
                  {AI_INSIGHTS_EMPTY.developers} Use AI Insights for this sprint and run Generate
                  (or Regenerate) to store narrative rows here.
                </Typography>
              )}
              {typeof onOpenAiInsights === 'function' &&
                !insightsLoading &&
                (developerInsightRows?.length ?? 0) === 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      component="button"
                      type="button"
                      onClick={() => {
                        if (selectedSprint?.id != null) {
                          sessionStorage.setItem(
                            'aiInsightsLandingSprintId',
                            String(selectedSprint.id),
                          );
                        }
                        onOpenAiInsights();
                      }}
                      sx={{
                        border: 'none',
                        background: 'none',
                        p: 0,
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#673AB7',
                        textDecoration: 'underline',
                        '&:hover': { color: '#512DA8' },
                      }}
                    >
                      Open AI Insights
                    </Typography>
                  </Box>
                )}
            </Box>
          </Paper>

          <Paper
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary', mb: 2 }}>
              Developer radar
            </Typography>
            <DeveloperRadarCards sprintId={selectedSprint.id} />
          </Paper>
        </>
      )}
    </Box>
  );
}