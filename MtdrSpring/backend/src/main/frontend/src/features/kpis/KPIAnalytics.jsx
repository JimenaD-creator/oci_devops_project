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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Target } from 'lucide-react';
import KpiDonutChart from './KpiDonutChart';
import DeveloperWorkloadCharts from './DeveloperWorkloadCharts';
import { resolveOnTimeDeliveryPercent } from './kpiAnalyticsProjectData';
import { useProjectData } from '../../contexts/ProjectDataContext';
import KpiManagerGuidePanel from './KpiManagerGuidePanel';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { fetchSprintInsights } from '../ai/insightsApi';
import { getErrorMessage } from '../ai/aiInsightsConstants';
import {
  SECTION_BRAND_DARK,
  SECTION_ACCENT,
  sectionRgba,
} from '../dashboard/constants/dashboardConstants';
import { pageFormFieldOutline } from '../tasks/utils/taskUtils';
import { KPI_TOOLTIPS, KpiInfoCornerButton } from './KpiTooltipParts';
import {
  normalizeEfficiencyPercent,
  productivityScoreFromSprintKpis,
} from './productivityScoreUtils';

const pageEase = [0.22, 1, 0.36, 1];

const KPI_ANALYTICS_CARD_LABEL_TO_TOOLTIP_KEY = {
  'Completion Rate': 'completionRate',
  'On-Time Delivery': 'onTimeDelivery',
  'Efficiency Score': 'efficiencyScore',
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
  productivityScore,
  completionRate,
  onTimeDelivery,
  efficiencyScore,
  workloadBalance,
  fillColumnHeight = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        Number.isFinite(Number(productivityScore))
          ? Number(productivityScore)
          : completionRate * 0.4 +
              onTimeDelivery * 0.3 +
              efficiencyScore * 0.2 +
              workloadBalance * 0.1,
      ),
    ),
  );

  const components = [
    { label: 'Completion rate', value: completionRate, weight: 'x0.4', color: '#1565C0' },
    { label: 'On-time delivery', value: onTimeDelivery, weight: 'x0.3', color: '#1D9E75' },
    { label: 'Efficiency score', value: efficiencyScore, weight: 'x0.2', color: '#8E24AA' },
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
          key={`productivity-summary-${score}`}
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

      <Box sx={{ height: 8, bgcolor: isDark ? '#2A2C32' : '#F0F0F0', borderRadius: 99, mb: 2, overflow: 'hidden' }}>
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
                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#9A9A9A' : '#607D8B', fontWeight: 600 }}>
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

// Función auxiliar para resolver el ID del proyecto
function resolveKpiProjectId(projectId) {
  const pid = projectId != null && String(projectId).trim() !== ''
    ? String(projectId).trim()
    : typeof localStorage !== 'undefined'
      ? String(localStorage.getItem('currentProjectId') || '').trim()
      : '';
  return pid || null;
}

// Función para filtrar sprints por proyecto
function pickProjectSprintsForKpi(enrichedSprints, contextSprints, pid) {
  let sprintsData = Array.isArray(enrichedSprints) ? enrichedSprints : [];
  if (pid) {
    sprintsData = sprintsData.filter((s) => String(s.assignedProject?.id) === String(pid));
  }
  return sprintsData;
}

// Función para filtrar tareas por sprints
function filterTasksForKpiSprints(tasks, sprintsData) {
  const sprintIds = new Set(sprintsData.map((s) => Number(s.id)).filter(Number.isFinite));
  return tasks.filter((t) => {
    const sid = taskSprintId(t);
    return sid != null && sprintIds.has(sid);
  });
}

function sprintKpiPercent(sprint, key) {
  const v = Number(sprint?.kpis?.[key]);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export default function KPIAnalytics({ projectId, onOpenAiInsights }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isDesktopLayout = useMediaQuery(theme.breakpoints.up('lg'));
  const {
    sprints: contextSprints,
    loading: contextLoading,
    dataUpdatedAt,
    ensureLoaded,
    getRawBundle,
  } = useProjectData();
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [managerGuide, setManagerGuide] = useState(null);
  const [managerGuideLoading, setManagerGuideLoading] = useState(true);
  const [managerGuideFetchFailed, setManagerGuideFetchFailed] = useState(false);
  const [managerGuideInsightError, setManagerGuideInsightError] = useState(null);
  const [kpiDataReady, setKpiDataReady] = useState(false);

  const managerGuideBySprintRef = useRef(new Map());

  const projectKey = resolveKpiProjectId(projectId);
  const sprints = useMemo(
    () => pickProjectSprintsForKpi(contextSprints, [], projectKey),
    [contextSprints, projectKey, dataUpdatedAt],
  );

  // Crear mapa de números de sprint secuenciales
  const getSprintNumber = useCallback((sprintId) => {
    const sortedSprints = [...sprints].sort((a, b) => a.id - b.id);
    const index = sortedSprints.findIndex(s => s.id === sprintId);
    return index >= 0 ? index + 1 : sprintId; // +1 para que Sprint 0 sea Sprint 1
  }, [sprints]);

  // Una sola definición de getSprintLabel
  const getSprintLabel = useCallback((sprintId) => {
    if (sprintId == null) return '';
    const sprint = sprints.find((s) => Number(s.id) === Number(sprintId));
    if (sprint?.shortLabel) return sprint.shortLabel;
    if (typeof sprint?.name === 'string' && sprint.name.trim()) return sprint.name.trim();
    const sprintNum = getSprintNumber(sprintId);
    return `Sprint ${sprintNum}`;
  }, [sprints, getSprintNumber]);

  // Efecto para cargar manager guide
  useEffect(() => {
    if (!kpiDataReady || loading || selectedSprintId == null) return undefined;

    const sprintKey = String(selectedSprintId);
    const cachedGuide = managerGuideBySprintRef.current.get(sprintKey);
    if (cachedGuide !== undefined) {
      setManagerGuide(cachedGuide);
      setManagerGuideFetchFailed(false);
      setManagerGuideLoading(false);
      return undefined;
    }

    setManagerGuide(null);
    setManagerGuideLoading(true);
    setManagerGuideFetchFailed(false);

    const controller = new AbortController();

    (async () => {
      try {
        const { notFound, data } = await fetchSprintInsights(selectedSprintId, {
          signal: controller.signal,
          retries: 1,
        });
        if (controller.signal.aborted) return;

        const nextGuide = notFound || !data ? null : (data.insights?.kpiManagerGuide ?? null);
        managerGuideBySprintRef.current.set(sprintKey, nextGuide);
        setManagerGuide(nextGuide);
        setManagerGuideInsightError(null);
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        setManagerGuideFetchFailed(true);
        setManagerGuideInsightError(getErrorMessage(err));
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

  const loading = contextLoading || tasksLoading;

  useEffect(() => {
    ensureLoaded({ silent: true }).catch(() => {});
  }, [ensureLoaded]);

  useEffect(() => {
    if (sprints.length === 0) {
      setSelectedSprintId(null);
      return;
    }
    setSelectedSprintId((prev) => {
      if (prev != null && sprints.some((s) => s.id === prev)) return prev;
      const defaultSprint = pickDefaultSelectedSprint(sprints);
      return defaultSprint?.id ?? sprints[0]?.id ?? null;
    });
  }, [sprints]);

  useEffect(() => {
    let cancelled = false;
    if (!projectKey) {
      setTasks([]);
      setTasksLoading(false);
      setKpiDataReady(true);
      return undefined;
    }

    setTasksLoading(true);
    setKpiDataReady(false);

    (async () => {
      try {
        const { tasks: rawTasks } = await getRawBundle();
        if (cancelled) return;
        setTasks(filterTasksForKpiSprints(rawTasks ?? [], sprints));
      } catch (error) {
        if (!cancelled) {
          console.error('Error loading KPI task bundle:', error);
          setTasks([]);
        }
      } finally {
        if (!cancelled) {
          setTasksLoading(false);
          setKpiDataReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataUpdatedAt, sprints, projectKey, getRawBundle]);

  const getSelectedSprint = () => sprints.find((s) => s.id === selectedSprintId);

  const getSprintTasks = () => {
    const sprint = getSelectedSprint();
    if (!sprint) return [];
    return tasks.filter((t) => Number(taskSprintId(t)) === Number(sprint.id));
  };

  const calculateKPIs = () => {
    const sprint = getSelectedSprint();
    const sprintTasks = getSprintTasks();
    const sk = sprint?.kpis ?? {};
    const completionRate = sprintKpiPercent(sprint, 'completionRate');
    const onTimeDelivery = resolveOnTimeDeliveryPercent(sprint);
    const rawWb = Number(sk.workloadBalance);
    const workloadBalancePct = Number.isFinite(rawWb)
      ? Math.round(rawWb <= 1 ? rawWb * 100 : rawWb)
      : 0;
    const efficiencyScorePct = normalizeEfficiencyPercent(sk.efficiencyScore ?? 0);
    const clampedWorkloadBalance = Math.min(100, Math.max(0, workloadBalancePct));
    const storedProductivity = Number(sk.productivityScore);
    const productivityScore = Number.isFinite(storedProductivity)
      ? Math.min(100, Math.max(0, Math.round(storedProductivity)))
      : productivityScoreFromSprintKpis({
          completionRate,
          onTimeDelivery,
          efficiencyScore: efficiencyScorePct,
          workloadBalance: clampedWorkloadBalance,
        });

    const totalTasks =
      Number.isFinite(Number(sprint?.totalTasks)) && sprint.totalTasks >= 0
        ? sprint.totalTasks
        : sprintTasks.length;
    const completedTasks =
      Number.isFinite(Number(sprint?.totalCompleted)) && sprint.totalCompleted >= 0
        ? sprint.totalCompleted
        : sprintTasks.filter((t) => normalizeTaskStatus(t.status) === 'DONE').length;

    return {
      completionRate,
      onTimeDelivery,
      efficiencyScore: efficiencyScorePct,
      workloadBalance: clampedWorkloadBalance,
      productivityScore,
      totalTasks,
      completedTasks,
    };
  };

  const kpis = calculateKPIs();
  const currentSprint = getSelectedSprint();
  const shouldShowEmptyKpiView = kpiDataReady && !loading && sprints.length === 0;
  const selectedSprintRows = sprints.filter((s) => s.id === selectedSprintId);

  const teamHoursTotals = useMemo(() => {
    const devs = currentSprint?.developers || [];
    return devs.reduce(
      (acc, d) => ({
        estimated: acc.estimated + (Number(d.assignedHoursEstimate) || 0),
        worked: acc.worked + (Number(d.hours) || 0),
      }),
      { estimated: 0, worked: 0 },
    );
  }, [currentSprint]);

  const developerCountForChartLayout = Array.isArray(currentSprint?.developers)
    ? currentSprint.developers.length
    : 0;
  const chartDataDensity = Math.max(
    teamHoursTotals.worked,
    teamHoursTotals.estimated,
    developerCountForChartLayout,
  );
  const adaptiveAssignedChartHeight = Math.min(
    360,
    Math.max(220, 200 + Math.round(chartDataDensity * 2)),
  );
  const teamHoursChartHeight = isDesktopLayout
    ? Math.min(168, Math.max(140, 124 + selectedSprintRows.length * 20))
    : adaptiveAssignedChartHeight;
  const adaptiveAssignedChartWidth = Math.min(
    640,
    Math.max(430, 430 + Math.round(chartDataDensity * 1.5)),
  );

  const normalizeProductivityValue = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n <= 1 ? Math.round(n * 100) : Math.round(n)));
  };

  const productivityDelta = useMemo(() => {
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
    const currentScore = normalizeProductivityValue(kpis.productivityScore);
    const previousScore = normalizeProductivityValue(previous?.kpis?.productivityScore);
    const delta = currentScore - previousScore;
    
    const previousSprintNum = getSprintNumber(previous.id);
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
  }, [currentSprint, sprints, kpis.productivityScore, getSprintNumber, getSprintLabel]);

  // Mostrar loading state
  if (loading) return <PageLoadingSpinner />;

  // Mostrar empty state si no hay sprints
  if (shouldShowEmptyKpiView) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No sprints found for this project
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Create a sprint to start tracking KPIs
        </Typography>
      </Box>
    );
  }

  // Ordenar sprints para el select
  const sortedSprintsForSelect = [...sprints].sort((a, b) => a.id - b.id);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: pageEase }}
      sx={{ maxWidth: 1200, width: '100%', mx: 'auto', px: 2 }}
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
              letterSpacing: '-0.5px' 
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
                '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#3A3C42' : undefined },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? '#5A5C62' : undefined },
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
            <Typography sx={{ 
              fontWeight: 700, 
              fontSize: '0.875rem', 
              color: isDark ? '#E0E0E0' : SECTION_BRAND_DARK 
            }}>
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
            label: 'Efficiency Score',
            pct: kpis.efficiencyScore,
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
                sx={{ color: isDark ? '#9A9A9A' : '#455A64', fontWeight: 700, display: 'block', mb: 0.5 }}
              >
                {label}
              </Typography>
              <KpiDonutChart
                key={`${label}-${Math.round(Math.min(100, Math.max(0, Number(pct) || 0)))}-${dataUpdatedAt}`}
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
            <Box
              sx={{
                width: '100%',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                flex: isDesktopLayout ? 1 : undefined,
              }}
            >
              <DeveloperWorkloadCharts
                selectedSprints={selectedSprintRows}
                primaryChart="teamHours"
                showHoursChart={false}
                assignedCompletedHeight={teamHoursChartHeight}
                assignedCompletedMaxWidth={
                  isDesktopLayout ? undefined : adaptiveAssignedChartWidth
                }
                suppressOuterMargin={isDesktopLayout}
                fillColumnHeight={isDesktopLayout}
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
              key={`productivity-card-${selectedSprintId}-${kpis.productivityScore}-${dataUpdatedAt}`}
              productivityScore={kpis.productivityScore}
              completionRate={kpis.completionRate}
              onTimeDelivery={kpis.onTimeDelivery}
              efficiencyScore={kpis.efficiencyScore}
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
          insightError={managerGuideInsightError}
          productivityDelta={productivityDelta}
          currentProductivityScore={kpis.productivityScore}
          currentSprintKpis={kpis}
          onOpenAiInsights={onOpenAiInsights}
        />
      </Box>
    </Box>
  );
}