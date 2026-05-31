import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Target } from 'lucide-react';
import KpiDonutChart from './KpiDonutChart';
import DeveloperWorkloadCharts from './DeveloperWorkloadCharts';
import { useProjectData } from '../../contexts/ProjectDataContext';
import {
  computeProductivityScore,
  productivityScoreFromSprintKpis,
} from './productivityScoreUtils';
import KpiManagerGuidePanel from './KpiManagerGuidePanel';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import {
  filterTasksForKpiSprints,
  pickProjectSprintsForKpi,
  resolveKpiProjectId,
} from './kpiAnalyticsProjectData';
import { fetchSprintInsights } from '../ai/insightsApi';
import {
  SECTION_BRAND_DARK,
  SECTION_ACCENT,
  sectionRgba,
} from '../dashboard/constants/dashboardConstants';
import { pageFormFieldOutline } from '../tasks/utils/taskUtils';
import { ORACLE_RED_ACTION } from '../sprints/constants/sprintConstants';
import { KPI_TOOLTIPS, KpiInfoCornerButton } from './KpiTooltipParts';

const pageEase = [0.22, 1, 0.36, 1];

const KPI_ANALYTICS_CARD_LABEL_TO_TOOLTIP_KEY = {
  'Completion Rate': 'completionRate',
  'On-Time Delivery': 'onTimeDelivery',
  'Team Participation': 'teamParticipation',
  'Workload Balance': 'workloadBalance',
};

function normalizeTaskStatus(rawStatus) {
  const s = String(rawStatus || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (s === 'DONE' || s === 'COMPLETED' || s === 'COMPLETE') return 'DONE';
  if (s === 'IN_REVIEW' || s === 'REVIEW') return 'IN_REVIEW';
  if (s === 'IN_PROGRESS' || s === 'IN_PROCESS') return 'IN_PROGRESS';
  return 'TODO';
}

function taskSprintId(task) {
  const raw =
    task?.assignedSprint?.id ??
    task?.sprint?.id ??
    task?.sprintId ??
    task?.sprint_id ??
    task?.id?.sprintId ??
    task?.id?.sprint_id;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function ProductivityScoreCard({
  completionRate,
  onTimeDelivery,
  teamParticipation,
  workloadBalance,
  fillColumnHeight = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const score = computeProductivityScore({
    completionRate,
    onTimeDelivery,
    teamParticipation,
    workloadBalance,
  });

  const components = [
    { label: 'Completion rate', value: completionRate, weight: 'x0.4', color: '#1565C0' },
    { label: 'On-time delivery', value: onTimeDelivery, weight: 'x0.3', color: '#1D9E75' },
    { label: 'Team participation', value: teamParticipation, weight: 'x0.2', color: '#8E24AA' },
    { label: 'Workload balance', value: workloadBalance, weight: 'x0.1', color: '#FB8C00' },
  ];

  return (
    <Paper
      component="div"
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: `1px solid ${sectionRgba(0.22)}`,
        borderLeft: '4px solid #2E7D32',
        boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
        bgcolor: 'background.paper',
        mb: fillColumnHeight ? 0 : 4,
        width: fillColumnHeight ? '100%' : undefined,
        flex: fillColumnHeight ? 1 : undefined,
        minHeight: fillColumnHeight ? 0 : undefined,
        boxSizing: 'border-box',
        display: fillColumnHeight ? 'flex' : undefined,
        flexDirection: fillColumnHeight ? 'column' : undefined,
      }}
    >
      <Box
        sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}
      >
        <Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              mb: 0.25,
            }}
          >
            <Typography
              component="span"
              variant="caption"
              sx={{ color: isDark ? '#9A9A9A' : '#455A64', fontWeight: 700, lineHeight: 1.3 }}
            >
              Productivity Score
            </Typography>
            <KpiInfoCornerButton
              id="kpi-info-productivity-summary"
              bodyProps={KPI_TOOLTIPS.productivityScore}
              ariaLabel="Productivity score: how it is calculated"
              placement="inline"
            />
          </Box>
          <Typography
            sx={{ fontSize: '2.2rem', fontWeight: 800, color: 'text.primary', lineHeight: 1.1 }}
          >
            {score}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: '#607D8B' }}>%</span>
          </Typography>
        </Box>
        <KpiDonutChart
          pct={score}
          displayValue={`${score}%`}
          displaySuffix=""
          arcColor="#2E7D32"
          height={90}
          innerRadius={28}
          outerRadius={40}
          width={90}
          maxWidth={90}
          valueFontSize="0.85rem"
        />
      </Box>

      <Box
        sx={{
          height: 8,
          bgcolor: isDark ? '#2A2C32' : '#F0F0F0',
          borderRadius: 99,
          mb: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${score}%`,
            bgcolor: '#2E7D32',
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </Box>

      <Grid
        container
        spacing={1.5}
        sx={fillColumnHeight ? { flex: 1, alignContent: 'flex-start' } : undefined}
      >
        {components.map(({ label, value, weight, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ bgcolor: isDark ? '#16181C' : '#F8F9FA', borderRadius: 1.5, p: 1.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: isDark ? '#9A9A9A' : '#607D8B',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#90A4AE' }}>{weight}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    flex: 1,
                    height: 5,
                    bgcolor: isDark ? '#2A2C32' : '#E0E0E0',
                    borderRadius: 99,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${Math.min(100, value)}%`,
                      bgcolor: color,
                      borderRadius: 99,
                    }}
                  />
                </Box>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'text.primary',
                    minWidth: 30,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(value)}%
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

export default function KPIAnalytics({ projectId, onOpenAiInsights, onNavigateToTasks }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isDesktopLayout = useMediaQuery(theme.breakpoints.up('lg'));
  const {
    sprints: sharedSprints,
    ensureLoaded,
    getRawBundle,
    getCachedSnapshot,
  } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [managerGuide, setManagerGuide] = useState(null);
  const [managerGuideLoading, setManagerGuideLoading] = useState(false);
  const [managerGuideFetchFailed, setManagerGuideFetchFailed] = useState(false);
  const [kpiDataReady, setKpiDataReady] = useState(false);
  const sharedSprintsRef = useRef(sharedSprints);
  sharedSprintsRef.current = sharedSprints;

  /** Sprint 0, 1, 2… (same labels as dashboard). */
  const getSprintLabel = useCallback((sprintId) => {
    if (sprintId == null) return '';
    const sprint = sprints.find((s) => Number(s.id) === Number(sprintId));
    if (sprint?.shortLabel) return sprint.shortLabel;
    if (typeof sprint?.name === 'string' && sprint.name.trim()) return sprint.name.trim();
    const sortedSprints = [...sprints].sort((a, b) => Number(a.id) - Number(b.id));
    const index = sortedSprints.findIndex((s) => Number(s.id) === Number(sprintId));
    return index >= 0 ? `Sprint ${index}` : `Sprint ${sprintId}`;
  }, [sprints]);

  useEffect(() => {
    if (!kpiDataReady || loading || selectedSprintId == null) return undefined;

    const controller = new AbortController();
    setManagerGuideLoading(true);
    setManagerGuideFetchFailed(false);
    setManagerGuide(null);

    (async () => {
      try {
        const { notFound, data } = await fetchSprintInsights(selectedSprintId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        if (notFound || !data) {
          setManagerGuide(null);
          return;
        }

        setManagerGuide(data.insights?.kpiManagerGuide ?? null);
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setManagerGuideFetchFailed(true);
      } finally {
        if (!controller.signal.aborted) {
          setManagerGuideLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [selectedSprintId, loading, kpiDataReady]);

  const applyKpiBundle = useCallback((snap, pid, contextSprints = []) => {
    const sprintsData = pickProjectSprintsForKpi(snap?.enrichedSprints, contextSprints, pid);
    const tasksData = filterTasksForKpiSprints(
      Array.isArray(snap?.tasks) ? snap.tasks : [],
      sprintsData,
    );
    setSprints(sprintsData);
    setTasks(tasksData);
    setSelectedSprintId((prev) => {
      if (sprintsData.length === 0) return null;
      if (prev != null && sprintsData.some((s) => s.id === prev)) return prev;
      const defaultSprint = pickDefaultSelectedSprint(sprintsData);
      return defaultSprint?.id ?? sprintsData[0]?.id ?? null;
    });
    return sprintsData.length > 0;
  }, []);

  const loadKpiData = useCallback(async () => {
    const pid = resolveKpiProjectId(projectId);
    if (!pid) {
      setSprints([]);
      setTasks([]);
      setSelectedSprintId(null);
      setLoading(false);
      setKpiDataReady(true);
      return;
    }

    setLoading(true);
    setKpiDataReady(false);
    try {
      await ensureLoaded({ silent: false });
      await getRawBundle();
      let snap = getCachedSnapshot();
      let hasSprints = applyKpiBundle(snap, pid, sharedSprintsRef.current);

      if (!hasSprints) {
        await getRawBundle({ forceFresh: true });
        snap = getCachedSnapshot();
        applyKpiBundle(snap, pid, sharedSprintsRef.current);
      }
    } catch (error) {
      console.error('Error loading KPI data:', error);
      setSprints([]);
      setTasks([]);
      setSelectedSprintId(null);
    } finally {
      setLoading(false);
      setKpiDataReady(true);
    }
  }, [projectId, ensureLoaded, getRawBundle, getCachedSnapshot, applyKpiBundle]);

  useEffect(() => {
    loadKpiData();
  }, [loadKpiData]);

  /** Context filled after first paint: refill once without forcing another full-page load cycle. */
  useEffect(() => {
    if (!kpiDataReady || loading || sprints.length > 0) return;
    if (!Array.isArray(sharedSprints) || sharedSprints.length === 0) return;
    const pid = resolveKpiProjectId(projectId);
    if (!pid) return;
    const snap = getCachedSnapshot();
    applyKpiBundle(snap, pid, sharedSprints);
  }, [
    kpiDataReady,
    loading,
    sprints.length,
    sharedSprints,
    projectId,
    getCachedSnapshot,
    applyKpiBundle,
  ]);

  const getSelectedSprint = () => sprints.find((s) => s.id === selectedSprintId);

  const getSprintTasks = () => {
    const sprint = getSelectedSprint();
    if (!sprint) return [];
    return tasks.filter((t) => Number(taskSprintId(t)) === Number(sprint.id));
  };

  const calculateKPIs = () => {
    const sprint = getSelectedSprint();
    const sprintTasks = getSprintTasks();
    const totalTasks = sprintTasks.length;
    const completedTasks = sprintTasks.filter(
      (t) => normalizeTaskStatus(t.status) === 'DONE',
    ).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const onTimeDelivery =
      typeof sprint?.kpis?.onTimeDelivery === 'number' ? sprint.kpis.onTimeDelivery : 0;

    const teamParticipation = sprint?.kpis?.teamParticipation ?? 0;
    const rawWb = Number(sprint?.kpis?.workloadBalance);
    const workloadBalancePct = Number.isFinite(rawWb)
      ? Math.round(rawWb <= 1 ? rawWb * 100 : rawWb)
      : 0;
    const teamParticipationPct = Math.min(100, Math.max(0, Number(teamParticipation) || 0));
    const clampedWorkloadBalance = Math.min(100, Math.max(0, workloadBalancePct));
    const productivityScore = computeProductivityScore({
      completionRate,
      onTimeDelivery,
      teamParticipation: teamParticipationPct,
      workloadBalance: clampedWorkloadBalance,
    });

    return {
      completionRate,
      onTimeDelivery,
      teamParticipation: teamParticipationPct,
      workloadBalance: clampedWorkloadBalance,
      productivityScore,
      totalTasks,
      completedTasks,
    };
  };

  const kpis = calculateKPIs();
  const currentSprint = getSelectedSprint();
  /** After a finished load: need at least one sprint and one task in that project. */
  const shouldShowEmptyKpiView =
    kpiDataReady && !loading && (sprints.length === 0 || tasks.length === 0);
  const selectedSprintRows = sprints.filter((s) => s.id === selectedSprintId);
  const assignedTotalInSprint = kpis.totalTasks;
  const completedTotalInSprint = kpis.completedTasks;
  const selectedSprintIdForTotals = currentSprint?.id;
  const uniqueTeamTotalsBySprintId = useMemo(() => {
    if (selectedSprintIdForTotals == null) return undefined;
    return {
      [selectedSprintIdForTotals]: {
        assigned: kpis.totalTasks,
        completed: kpis.completedTasks,
      },
    };
  }, [selectedSprintIdForTotals, kpis.totalTasks, kpis.completedTasks]);
  const developerCountForChartLayout = Array.isArray(currentSprint?.developers)
    ? currentSprint.developers.length
    : 0;
  const chartDataDensity = Math.max(
    assignedTotalInSprint,
    completedTotalInSprint,
    developerCountForChartLayout,
  );
  const adaptiveAssignedChartHeight = Math.min(
    360,
    Math.max(220, 200 + Math.round(chartDataDensity * 2)),
  );
  const adaptiveAssignedChartWidth = Math.min(
    640,
    Math.max(430, 430 + Math.round(chartDataDensity * 1.5)),
  );

  const productivityDelta = React.useMemo(() => {
    if (!currentSprint) return null;
    const sorted = [...sprints].sort((a, b) => {
      const endA = new Date(a.dueDate ?? 0).getTime();
      const endB = new Date(b.dueDate ?? 0).getTime();
      if (endA !== endB) return endA - endB;
      const startA = new Date(a.startDate ?? 0).getTime();
      const startB = new Date(b.startDate ?? 0).getTime();
      if (startA !== startB) return startA - startB;
      return Number(a.id) - Number(b.id);
    });
    const idx = sorted.findIndex((s) => Number(s.id) === Number(currentSprint.id));
    if (idx <= 0) {
      return null;
    }

    const previous = sorted[idx - 1];
    const currentScore = kpis.productivityScore;
    const previousScore = productivityScoreFromSprintKpis(previous?.kpis);
    const delta = currentScore - previousScore;
    
    const previousSprintLabel = getSprintLabel(previous.id);

    if (delta > 0) {
      const relativePct =
        previousScore > 0 ? ((currentScore - previousScore) / previousScore) * 100 : null;
      const isStrongProductivityGain =
        delta >= 20 || (previousScore > 0 && relativePct != null && relativePct >= 20);
      return {
        tone: 'up',
        text: `Productivity increased by ${delta} point${delta === 1 ? '' : 's'} versus ${previousSprintLabel} (${previousScore}% → ${currentScore}%).`,
        previousSprintId: previous.id,
        previousScore,
        currentScore,
        deltaPoints: delta,
        relativePct,
        isStrongProductivityGain,
      };
    }
    if (delta < 0) {
      const abs = Math.abs(delta);
      return {
        tone: 'down',
        text: `Productivity decreased by ${abs} point${abs === 1 ? '' : 's'} versus ${previousSprintLabel} (${previousScore}% → ${currentScore}%).`,
      };
    }
    return {
      tone: 'neutral',
      text: `Productivity is stable versus ${previousSprintLabel} (${currentScore}%).`,
    };
  }, [currentSprint, sprints, kpis.productivityScore, getSprintLabel]);

  if (loading || !kpiDataReady) return <PageLoadingSpinner />;

  if (shouldShowEmptyKpiView) {
    return (
      <Box
        sx={{
          maxWidth: 1200,
          width: '100%',
          minHeight: { xs: 'calc(100vh - 160px)', md: 'calc(100vh - 190px)' },
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: isDark ? '#F0F0F0' : SECTION_BRAND_DARK,
            letterSpacing: '-0.5px',
            mb: 3,
          }}
        >
          KPI Analytics
        </Typography>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            py: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
              textAlign: 'center',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
              KPI data cannot be displayed yet
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto', mb: 3 }}>
              There are no sprints or tasks to visualize in this project. Create a sprint and add
              tasks to see KPI analytics here.
            </Typography>
            {typeof onNavigateToTasks === 'function' ? (
              <Button
                variant="contained"
                size="large"
                onClick={onNavigateToTasks}
                sx={{
                  bgcolor: ORACLE_RED_ACTION,
                  fontWeight: 700,
                  px: 3,
                  '&:hover': { bgcolor: '#A3321F' },
                }}
              >
                Go to Tasks
              </Button>
            ) : null}
          </Paper>
        </Box>
      </Box>
    );
  }

  // Ordenar sprints para el select
  const sortedSprintsForSelect = [...sprints].sort((a, b) => a.id - b.id);

  return (
    <>
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
        sx={{ maxWidth: 1200, width: '100%' }}
      >
        {/* HEADER ACTUALIZADO CON ANIMACIONES Y SOPORTE PARA MODO OSCURO */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.34, ease: pageEase }}
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
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: isDark ? '#F0F0F0' : SECTION_BRAND_DARK,
                letterSpacing: '-0.5px',
              }}
            >
              KPI Analytics
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {sprints.length > 0 && (
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: '100%', sm: 220 },
                  ...pageFormFieldOutline(isDark),
                  '& .MuiInputLabel-root': { color: isDark ? '#9A9A9A' : undefined },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#3A3C42' : undefined,
                  },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: isDark ? '#5A5C62' : undefined,
                  },
                  '& .MuiSelect-select': {
                    color: isDark ? '#F0F0F0' : '#1A1A1A',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    pr: 4,
                  },
                }}
              >
                <InputLabel id="kpi-analytics-sprint-filter" shrink>
                  Sprint
                </InputLabel>
                <Select
                  labelId="kpi-analytics-sprint-filter"
                  value={selectedSprintId ?? ''}
                  label="Sprint"
                  onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                  displayEmpty
                  renderValue={(value) => {
                    if (value === '' || value == null) return 'Select sprint';
                    return getSprintLabel(value);
                  }}
                >
                  {sortedSprintsForSelect.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {getSprintLabel(s.id)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : sectionRgba(0.08),
                border: `1px solid ${isDark ? '#3A3C42' : sectionRgba(0.22)}`,
                borderRadius: 2,
                px: 2,
                py: 1,
              }}
            >
              <Target size={16} color={isDark ? '#64B5F6' : SECTION_ACCENT} aria-hidden />
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: isDark ? '#E0E0E0' : SECTION_BRAND_DARK,
                }}
              >
                Goal: +20% productivity
              </Typography>
            </Box>
          </Box>
        </Box>

        <Grid
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.34, ease: pageEase }}
          container
          spacing={3}
          sx={{ mb: 3 }}
        >
          {[
            {
              label: 'Completion Rate',
              pct: kpis.completionRate,
              arcColor: '#1565C0',
              borderColor: '#5C6BC0',
            },
            {
              label: 'On-Time Delivery',
              pct: kpis.onTimeDelivery,
              arcColor: '#FB8C00',
              borderColor: '#FFB74D',
            },
            {
              label: 'Team Participation',
              pct: kpis.teamParticipation,
              arcColor: '#8E24AA',
              borderColor: '#BA68C8',
            },
            {
              label: 'Workload Balance',
              pct: kpis.workloadBalance,
              arcColor: '#1D9E75',
              borderColor: '#43A047',
            },
          ].map(({ label, pct, arcColor, borderColor }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Paper
                component="div"
                sx={{
                  position: 'relative',
                  p: 2,
                  pt: 2.5,
                  textAlign: 'center',
                  borderRadius: 2,
                  border: `1px solid ${sectionRgba(0.22)}`,
                  borderLeft: `4px solid ${borderColor}`,
                  boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  minHeight: 232,
                  boxSizing: 'border-box',
                }}
              >
                <KpiInfoCornerButton
                  id={`kpi-info-analytics-${String(label).replace(/\s+/g, '-').toLowerCase()}`}
                  bodyProps={KPI_TOOLTIPS[KPI_ANALYTICS_CARD_LABEL_TO_TOOLTIP_KEY[label]]}
                  ariaLabel={`${label}: how it is calculated`}
                />
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#9A9A9A' : '#455A64',
                    fontWeight: 700,
                    display: 'block',
                    mb: 0.5,
                  }}
                >
                  {label}
                </Typography>
                <KpiDonutChart
                  pct={Math.min(100, Math.max(0, Number(pct) || 0))}
                  displayValue={`${Math.round(Math.min(100, Math.max(0, Number(pct) || 0)))}%`}
                  displaySuffix=""
                  arcColor={arcColor}
                  height={{ xs: 150, sm: 160 }}
                  innerRadius={50}
                  outerRadius={68}
                  width={{ xs: '100%', sm: '100%' }}
                  maxWidth={260}
                  valueFontSize={{ xs: '1.5rem', sm: '1.65rem' }}
                />
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.36, ease: pageEase }}
        >
          <Grid container spacing={2} sx={{ alignItems: 'stretch', mb: 2 }}>
            <Grid item xs={12} lg={6} sx={{ display: 'flex', minWidth: 0 }}>
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <DeveloperWorkloadCharts
                  selectedSprints={selectedSprintRows}
                  showHoursChart={false}
                  uniqueTeamTotalsBySprintId={uniqueTeamTotalsBySprintId}
                  assignedCompletedHeight={adaptiveAssignedChartHeight}
                  assignedCompletedMaxWidth={adaptiveAssignedChartWidth}
                  suppressOuterMargin={isDesktopLayout}
                />
              </Box>
            </Grid>
            <Grid
              item
              xs={12}
              lg={6}
              sx={{
                display: isDesktopLayout ? 'flex' : 'block',
                flexDirection: isDesktopLayout ? 'column' : undefined,
                minWidth: 0,
              }}
            >
              <ProductivityScoreCard
                completionRate={kpis.completionRate}
                onTimeDelivery={kpis.onTimeDelivery}
                teamParticipation={kpis.teamParticipation}
                workloadBalance={kpis.workloadBalance}
                fillColumnHeight={isDesktopLayout}
              />
            </Grid>
          </Grid>
          <KpiManagerGuidePanel
            sprintLabel={getSprintLabel(selectedSprintId)}
            guide={managerGuide}
            loading={managerGuideLoading}
            fetchFailed={managerGuideFetchFailed}
            productivityDelta={productivityDelta}
            currentProductivityScore={kpis.productivityScore}
            currentSprintKpis={kpis}
            currentSprint={currentSprint}
            onOpenAiInsights={onOpenAiInsights}
          />
        </Box>
      </Box>
    </>
  );
}
