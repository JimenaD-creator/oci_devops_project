import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Sparkles, UserCircle } from 'lucide-react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import {
  pickDefaultSelectedSprint,
  buildSprintNumberMap,
  formatSprintLabel,
} from '../sprints/utils/sprintUtils';
import { SECTION_ACCENT, sectionRgba } from '../dashboard/constants/dashboardConstants';
import { pageEase, getErrorMessage, isProcessingInsight } from './aiInsightsConstants';
import {
  productivityScoreFromSprintKpis,
  normalizeWorkloadBalancePercent,
} from '../kpis/productivityScoreUtils';
import InsightCard from './InsightCard';
import { DeveloperInsightsTable } from './InsightCardParts';
import DeveloperRadarCards from './DeveloperRadarCards';
import { fetchProjectDevelopers } from '../dashboard/projectApi';
import { fetchSprintInsights } from './insightsApi';
import { mergeDeveloperInsightRows } from '../../utils/teamRosterUtils';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';

export default function AIInsightsPage({ projectId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { sprints: sharedSprints, loading: sharedLoading } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [rawDeveloperInsightRows, setRawDeveloperInsightRows] = useState(null);
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState(null);
  const [insightsError, setInsightsError] = useState(null);

  const sprintNumberMap = useMemo(() => buildSprintNumberMap(sprints), [sprints]);

  useEffect(() => {
    const pid =
      projectId != null && String(projectId).trim() !== ''
        ? String(projectId).trim()
        : typeof localStorage !== 'undefined'
          ? String(localStorage.getItem('currentProjectId') || '').trim()
          : '';
    if (!pid) {
      setProjectDevelopers([]);
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

  useEffect(() => {
    const pid =
      projectId != null && String(projectId).trim() !== ''
        ? String(projectId).trim()
        : typeof localStorage !== 'undefined'
          ? String(localStorage.getItem('currentProjectId') || '').trim()
          : '';
    if (!pid) {
      setSprints([]);
      setLoading(false);
      return;
    }
    setLoading(sharedLoading);
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
    if (!sharedLoading) setLoading(false);
  }, [projectId, sharedSprints, sharedLoading]);

  useEffect(() => {
    if (sprints.length === 0) return;
    try {
      const raw = sessionStorage.getItem('aiInsightsLandingSprintId');
      if (raw == null || String(raw).trim() === '') return;
      const id = Number(raw);
      if (!Number.isFinite(id)) {
        sessionStorage.removeItem('aiInsightsLandingSprintId');
        return;
      }
      if (!sprints.some((s) => Number(s.id) === id)) {
        sessionStorage.removeItem('aiInsightsLandingSprintId');
        return;
      }
      sessionStorage.removeItem('aiInsightsLandingSprintId');
      setSelectedSprintId(id);
    } catch {
      sessionStorage.removeItem('aiInsightsLandingSprintId');
    }
  }, [sprints]);

  useEffect(() => {
    if (selectedSprintId == null) return;
    fetchSprintInsights(selectedSprintId).catch(() => {});
  }, [selectedSprintId]);

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

  const handleInsightsFetchResult = useCallback(
    ({ sprintId: sid, loading, notFound, data, fetchFailed }) => {
      if (sid == null || Number(sid) !== Number(selectedSprintId)) return;
      setInsightsLoading(Boolean(loading));
      if (loading || isProcessingInsight(data)) {
        setInsightsLoading(true);
        if (isProcessingInsight(data)) {
          setInsightsError(null);
        }
        return;
      }
      if (notFound || !data) {
        setRawDeveloperInsightRows([]);
        setInsightsGeneratedAt(null);
        setInsightsError(fetchFailed ? 'Could not load insights.' : null);
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
    },
    [selectedSprintId],
  );

  const normalizeKpiPercent = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  };

  const currentSprintKpiMetrics = selectedSprint
    ? {
        completionRate: normalizeKpiPercent(selectedSprint.kpis?.completionRate),
        onTimeDelivery: normalizeKpiPercent(selectedSprint.kpis?.onTimeDelivery),
        teamParticipation: normalizeKpiPercent(selectedSprint.kpis?.teamParticipation),
        workloadBalance: normalizeWorkloadBalancePercent(selectedSprint.kpis?.workloadBalance),
        productivityScore: productivityScoreFromSprintKpis(selectedSprint.kpis),
      }
    : null;

  /** Sprints sorted chronologically for "next sprint" comparisons. */
  const sortedSprints = useMemo(() => {
    if (!Array.isArray(sprints) || sprints.length === 0) return [];
    return [...sprints].sort((a, b) => {
      const endA = new Date(a.dueDate ?? 0).getTime();
      const endB = new Date(b.dueDate ?? 0).getTime();
      if (endA !== endB) return endA - endB;
      const startA = new Date(a.startDate ?? 0).getTime();
      const startB = new Date(b.startDate ?? 0).getTime();
      if (startA !== startB) return startA - startB;
      return Number(a.id) - Number(b.id);
    });
  }, [sprints]);

  // Show predictions for any selected sprint, including past sprints.
  const showPredictionsSection = useMemo(() => selectedSprintId != null, [selectedSprintId]);

  const nextSprintForSelected = useMemo(() => {
    if (selectedSprintId == null || sortedSprints.length === 0) return null;
    const idx = sortedSprints.findIndex((s) => Number(s.id) === Number(selectedSprintId));
    if (idx < 0 || idx >= sortedSprints.length - 1) return null;
    return sortedSprints[idx + 1];
  }, [selectedSprintId, sortedSprints]);

  const showNextSprintForecast = selectedSprintId != null;

  const productivityDeltaPoints = useMemo(() => {
    if (selectedSprintId == null || sortedSprints.length < 2) return null;
    const idx = sortedSprints.findIndex((s) => Number(s.id) === Number(selectedSprintId));
    if (idx <= 0) return null;
    const current = productivityScoreFromSprintKpis(sortedSprints[idx]?.kpis);
    const previous = productivityScoreFromSprintKpis(sortedSprints[idx - 1]?.kpis);
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return Math.round(current) - Math.round(previous);
  }, [selectedSprintId, sortedSprints]);

  if (loading && sprints.length === 0) return <PageLoadingSpinner />;

  // Obtener etiquetas de sprint con números secuenciales
  const getSprintLabel = (sprintId) => {
    if (sprintId == null) return null;
    return formatSprintLabel(sprintNumberMap, sprintId);
  };

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
        py: 0.5,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'flex-end' },
          mb: 1.5,
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, minWidth: 0 }}>
            <Sparkles size={24} color="#673AB7" />
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.45rem', md: '1.75rem' },
              }}
            >
              AI Insights
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: isDark ? '#9A9A9A' : '#607D8B',
              fontWeight: 600,
              maxWidth: '56rem',
              fontSize: '0.875rem',
            }}
          >
            Gemini-powered sprint analysis, per-developer AI notes, and skill radar profiles.
          </Typography>
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
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                },
                '& .MuiSelect-select': {
                  color: 'text.primary',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  pr: 4,
                },
                '& .MuiSelect-icon': { color: isDark ? '#9A9A9A' : '#546E7A' },
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
                '& .MuiInputLabel-root': { color: isDark ? '#9A9A9A' : '#607D8B' },
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
                  return formatSprintLabel(sprintNumberMap, value);
                }}
              >
                {sprints.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {formatSprintLabel(sprintNumberMap, s.id)}
                  </MenuItem>
                ))}
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
            border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
          }}
        >
          <Typography color="text.secondary">No sprints found for this project.</Typography>
        </Paper>
      )}
      {selectedSprint && (
        <>
          <InsightCard
            key={selectedSprint.id}
            sprintId={selectedSprint.id}
            sprintLabel={getSprintLabel(selectedSprint.id)}
            showPredictionsSection={showPredictionsSection}
            showNextSprintForecast={showNextSprintForecast}
            nextSprintLabel={nextSprintForSelected ? getSprintLabel(nextSprintForSelected.id) : null}
            nextSprintActualScore={productivityScoreFromSprintKpis(nextSprintForSelected?.kpis)}
            currentSprintActualScore={productivityScoreFromSprintKpis(selectedSprint?.kpis)}
            currentSprintMetrics={currentSprintKpiMetrics}
            productivityDeltaPoints={productivityDeltaPoints}
            refreshToken={0}
            autoGenerateOnMissing={false}
            onInsightsFetchResult={handleInsightsFetchResult}
            sprintDevelopers={
              Array.isArray(selectedSprint.developers) ? selectedSprint.developers : []
            }
          />

          <Paper
            sx={{
              mt: 3,
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
                {insightsGeneratedAt
                  ? `AI narrative last generated: ${new Date(insightsGeneratedAt).toLocaleString()}.`
                  : 'Generate sprint insights above to populate per-developer AI notes.'}
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
                    'No AI narrative for this sprint yet. Use Generate above to run a full sprint analysis.'}
                </Typography>
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
            {insightsLoading || !insightsGeneratedAt ? (
              <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', fontStyle: 'italic' }}>
                {insightsLoading
                  ? 'Radar charts load after sprint insights finish generating.'
                  : 'Generate sprint insights above to load developer radar charts.'}
              </Typography>
            ) : (
              <DeveloperRadarCards sprintId={selectedSprint.id} sprintNumberMap={sprintNumberMap} enabled />
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
