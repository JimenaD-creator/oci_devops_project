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
import { useTheme } from '@mui/material/styles';
import { Users, UserCircle } from 'lucide-react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { pageEase, AI_INSIGHTS_EMPTY, getErrorMessage } from '../ai/aiInsightsConstants';
import { fetchSprintInsights } from '../ai/insightsApi';
import { ORACLE_RED } from '../tasks/constants/taskConstants';
import { pageFormFieldOutline } from '../tasks/utils/taskUtils';
import { DeveloperInsightsTable } from '../ai/InsightCardParts';
import DeveloperRadarCards from '../ai/DeveloperRadarCards';
import DashboardBlockedTasksPanel from '../dashboard/DashboardBlockedTasksPanel';
import TeamWorkloadBreakdown from './TeamWorkloadBreakdown';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { fetchProjectDevelopers } from '../dashboard/projectApi';
import { mergeDeveloperInsightRows } from '../../utils/teamRosterUtils';

export default function TeamPage({
  projectId,
  landingSprintId = null,
  onLandingConsumed,
  onOpenAiInsights,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { sprints: sharedSprints, loading: sharedLoading } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [rawDeveloperInsightRows, setRawDeveloperInsightRows] = useState(null);
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState(null);
  const [insightsError, setInsightsError] = useState(null);
  const [sprintsReady, setSprintsReady] = useState(false);
  const [projectDevelopers, setProjectDevelopers] = useState([]);

  useEffect(() => {
    const pid =
      projectId != null && String(projectId).trim() !== ''
        ? String(projectId).trim()
        : typeof localStorage !== 'undefined'
          ? String(localStorage.getItem('currentProjectId') || '').trim()
          : '';
    if (!pid) {
      setSprints([]);
      setSelectedSprintId(null);
      setProjectDevelopers([]);
      setLoading(false);
      setSprintsReady(false);
      return;
    }
    let cancelled = false;
    fetchProjectDevelopers(pid)
      .then((list) => {
        if (!cancelled) setProjectDevelopers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setProjectDevelopers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Crear mapa de números de sprint secuenciales por proyecto
  const sprintNumberMap = useMemo(() => {
    const map = new Map();
    // Ordenar sprints por ID para mantener consistencia
    [...sprints]
      .sort((a, b) => a.id - b.id)
      .forEach((sprint, index) => {
        map.set(sprint.id, index);
      });
    return map;
  }, [sprints]);

  useEffect(() => {
    const pid =
      projectId != null && String(projectId).trim() !== ''
        ? String(projectId).trim()
        : typeof localStorage !== 'undefined'
          ? String(localStorage.getItem('currentProjectId') || '').trim()
          : '';
    if (!pid) {
      setSprints([]);
      setSelectedSprintId(null);
      setLoading(false);
      setSprintsReady(false);
      return;
    }
    const filtered = Array.isArray(sharedSprints)
      ? sharedSprints.filter((s) => String(s.assignedProject?.id) === String(pid))
      : [];
    setSprints(filtered);
    setSelectedSprintId((prev) => {
      if (filtered.length === 0) return null;
      if (prev != null && filtered.some((s) => Number(s.id) === Number(prev))) return prev;
      const defaultSprint = pickDefaultSelectedSprint(filtered);
      return defaultSprint?.id ?? filtered[filtered.length - 1]?.id ?? null;
    });
    setLoading(sharedLoading);
    setSprintsReady(!sharedLoading);
  }, [projectId, sharedSprints, sharedLoading]);

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

  const selectedSprint = sprints.find((s) => Number(s.id) === Number(selectedSprintId));

  const rosterForInsights = useMemo(() => {
    if (projectDevelopers.length > 0) return projectDevelopers;
    const sprintDevs = selectedSprint?.developers;
    return Array.isArray(sprintDevs) ? sprintDevs : [];
  }, [projectDevelopers, selectedSprint]);

  const developerInsightRows = useMemo(() => {
    if (rawDeveloperInsightRows === null) return [];
    return mergeDeveloperInsightRows(rosterForInsights, rawDeveloperInsightRows);
  }, [rosterForInsights, rawDeveloperInsightRows]);

  /** Refetch AI rows when sprint KPIs / developer stats change (e.g. after task edits). */
  const sprintInsightsRefreshKey = selectedSprint
    ? JSON.stringify({
        id: selectedSprint.id,
        devs: (selectedSprint.developers || []).map((d) => [
          d.name,
          d.assigned,
          d.completed,
          d.onTime,
          d.hours,
        ]),
      })
    : '';

  useEffect(() => {
    if (!sprintsReady || selectedSprintId == null) {
      setRawDeveloperInsightRows(null);
      return undefined;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setRawDeveloperInsightRows(null);
    setInsightsError(null);
    fetchSprintInsights(selectedSprintId)
      .then(({ notFound, data }) => {
        if (cancelled) return;
        if (notFound || !data) {
          setRawDeveloperInsightRows([]);
          setInsightsGeneratedAt(null);
          setInsightsError(null);
          return;
        }
        const rows = data.insights?.developerInsights;
        const aiRows = Array.isArray(rows) ? rows : [];
        if (data.error && aiRows.length === 0) {
          setInsightsError(getErrorMessage(data.error));
          setRawDeveloperInsightRows([]);
          setInsightsGeneratedAt(null);
          return;
        }
        setInsightsError(null);
        setRawDeveloperInsightRows(aiRows);
        setInsightsGeneratedAt(data.generatedAt ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setRawDeveloperInsightRows([]);
          setInsightsError(null);
        }
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSprintId, sprintsReady, sprintInsightsRefreshKey]);

  if (loading) return <PageLoadingSpinner />;

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
                ...pageFormFieldOutline(isDark),
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
                  const sprintNum = sprintNumberMap.get(value);
                  return sprintNum ? `Sprint ${sprintNum}` : `Sprint ${value}`;
                }}
              >
                {sprints.map((s) => {
                  const sprintNum = sprintNumberMap.get(s.id);
                  return (
                    <MenuItem key={s.id} value={s.id}>
                      {sprintNum ? `Sprint ${sprintNum}` : `Sprint ${s.id}`}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>

      {sprints.length === 0 && (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography color="textSecondary">No sprints found for this project.</Typography>
        </Paper>
      )}

      {selectedSprintId != null && !selectedSprint && sprints.length > 0 && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography color="text.secondary">
            Sprint data is still syncing. Pick another sprint in the dropdown or refresh the page.
          </Typography>
        </Paper>
      )}

      {selectedSprint && (
        <>
          <TeamWorkloadBreakdown
            sprint={selectedSprint}
            aiDeveloperInsights={developerInsightRows}
            projectDevelopers={rosterForInsights}
          />

          <DashboardBlockedTasksPanel selectedSprints={[selectedSprint]} sprintNumberMap={sprintNumberMap} />

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
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1.25, lineHeight: 1.5 }}
              >
                Completion counts and on-time/late text are rebuilt from current assignments each
                time this section loads.{' '}
                {insightsGeneratedAt
                  ? `AI narrative last generated: ${new Date(insightsGeneratedAt).toLocaleString()}.`
                  : 'Run Generate in AI Insights to store a full sprint narrative.'}
              </Typography>
              {insightsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                  <CircularProgress size={28} sx={{ color: '#673AB7' }} />
                </Box>
              ) : developerInsightRows.length > 0 ? (
                <DeveloperInsightsTable rows={developerInsightRows} />
              ) : (
                <Typography
                  sx={{
                    fontSize: { xs: '0.95rem', md: '1rem' },
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  }}
                >
                  {insightsError ||
                    'No AI narrative for this sprint yet. Generate insights in AI Insights, then return here.'}
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
            <DeveloperRadarCards sprintId={selectedSprint.id} sprintNumberMap={sprintNumberMap} />
          </Paper>
        </>
      )}
    </Box>
  );
}
