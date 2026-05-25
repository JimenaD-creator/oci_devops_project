import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Sparkles } from 'lucide-react';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { SECTION_ACCENT, sectionRgba } from '../dashboard/constants/dashboardConstants';
import { pageEase } from './aiInsightsConstants';
import {
  productivityScoreFromSprintKpis,
  normalizeWorkloadBalancePercent,
} from '../kpis/productivityScoreUtils';
import InsightCard from './InsightCard';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';

export default function AIInsightsPage({
  projectId,
  onOpenTeam = null,
  isPageActive = true,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { sprints: sharedSprints, loading: sharedLoading } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);

  /** DB sprint id → human label "Sprint 0", "Sprint 1", … (order by id within project). */
  const sprintNumberMap = useMemo(() => {
    const map = new Map();
    [...sprints]
      .sort((a, b) => Number(a.id) - Number(b.id))
      .forEach((sprint, index) => {
        map.set(sprint.id, index);
      });
    return map;
  }, [sprints]);

  /** Reload persisted insights when the user opens this page again (no 15s polling). */
  useEffect(() => {
    if (isPageActive) {
      setInsightsRefreshKey((k) => k + 1);
    }
  }, [isPageActive]);

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

  const selectedSprint = sprints.find((s) => Number(s.id) === Number(selectedSprintId));

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

  if (loading) return <PageLoadingSpinner />;

  // Obtener etiquetas de sprint con números secuenciales
  const getSprintLabel = (sprintId) => {
    if (sprintId == null) return null;
    const sprintNum = sprintNumberMap.get(sprintId);
    return sprintNum ? `Sprint ${sprintNum}` : `Sprint ${sprintId}`;
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
                color: 'text.primary',
                letterSpacing: '-0.5px',
                fontSize: { xs: '1.65rem', md: '2rem' },
              }}
            >
              AI Insights
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: isDark ? '#9A9A9A' : '#607D8B', fontWeight: 600, maxWidth: '56rem' }}>
            Gemini-powered sprint analysis: alerts, recommendations, summary, and predictions.
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
                '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isDark ? '#1C1E22' : '#FFFFFF' },
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
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: 'background.paper', border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}` }}>
          <Typography color="text.secondary">No sprints found for this project.</Typography>
        </Paper>
      )}
      {selectedSprint && (
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
          refreshToken={insightsRefreshKey}
          onOpenTeam={onOpenTeam}
        />
      )}
    </Box>
  );
}