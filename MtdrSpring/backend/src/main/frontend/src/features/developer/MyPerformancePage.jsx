import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Alert,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { useProjectData } from '../../contexts/ProjectDataContext';
import DeveloperMetricCards from './DeveloperMetricCards';
import DeveloperTable from '../kpis/DeveloperTable';
import DeveloperRadarCards from '../ai/DeveloperRadarCards';
import DeveloperPerformanceNarrative from './DeveloperPerformanceNarrative';
import {
  aggregateDeveloperPerformance,
  buildCompletedTasksBySprintChart,
  buildHoursWorkedTrendChart,
} from './developerPerformanceData';
import {
  CompletedTasksBySprintChart,
  HoursWorkedTrendChart,
} from './DeveloperPerformanceCharts';
import { pageEase } from '../tasks/constants/taskConstants';
import { pageFormFieldOutline } from '../tasks/utils/taskUtils';
import {
  pickDefaultSelectedSprint,
  buildSprintNumberMap,
  formatSprintLabel,
  resolveActiveProjectIdNum,
  sortSprintsForDisplay,
} from '../sprints/utils/sprintUtils';
import { fetchSprintsProjectDevelopers } from '../sprints/sprintsPageApi';

const ORACLE_RED = '#C74634';

export default function MyPerformancePage({ projectId, currentUser }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { sprints: sharedSprints, loading: sharedLoading, error: sharedError } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [projectDevelopers, setProjectDevelopers] = useState([]);

  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);
  const userId = currentUser?.id;
  const userName = currentUser?.name;

  useEffect(() => {
    setLoading(sharedLoading);
    if (sharedError) {
      setSprints([]);
      setError('Could not load performance data.');
    } else {
      setError('');
      setSprints(Array.isArray(sharedSprints) ? sharedSprints : []);
    }
    if (!sharedLoading) setLoading(false);
  }, [projectId, sharedSprints, sharedLoading, sharedError]);

  useEffect(() => {
    let cancelled = false;
    if (effectiveProjectIdNum == null) {
      setProjectDevelopers([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const data = await fetchSprintsProjectDevelopers(effectiveProjectIdNum);
        if (!cancelled) setProjectDevelopers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProjectDevelopers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectIdNum]);

  const sortedSprints = useMemo(() => sortSprintsForDisplay(sprints), [sprints]);
  const sprintNumberMap = useMemo(() => buildSprintNumberMap(sortedSprints), [sortedSprints]);

  useEffect(() => {
    if (selectedSprint != null || !sortedSprints.length) return;
    const picked = pickDefaultSelectedSprint(sortedSprints);
    if (picked) setSelectedSprint(picked);
  }, [sortedSprints, selectedSprint]);

  const metrics = useMemo(
    () => aggregateDeveloperPerformance(sprints, userId, userName),
    [sprints, userId, userName],
  );

  const completedChartData = useMemo(
    () => buildCompletedTasksBySprintChart(sprints, userId, userName),
    [sprints, userId, userName],
  );

  const hoursChartData = useMemo(
    () => buildHoursWorkedTrendChart(sprints, userId, userName),
    [sprints, userId, userName],
  );

  const performanceCards = useMemo(() => {
    const hoursRatio =
      metrics.estimated > 0 ? Math.round((metrics.hours / metrics.estimated) * 100) : 0;
    const hoursBarTone =
      metrics.estimated > 0
        ? hoursRatio > 110
          ? 'negative'
          : hoursRatio <= 90
            ? 'positive'
            : 'neutral'
        : 'neutral';
    const onTimeBarTone =
      metrics.onTime == null
        ? 'neutral'
        : metrics.onTime >= 80
          ? 'positive'
          : metrics.onTime < 60
            ? 'negative'
            : 'neutral';
    const productivityProgress = Math.min(100, Math.round((metrics.tasksPerHour / 1.5) * 100));

    return [
      {
        label: 'Completion rate',
        value: `${metrics.completionRate}%`,
        subtitle: `${metrics.completed} of ${metrics.assigned} tasks completed`,
        progress: metrics.completionRate,
        accent: '#1565C0',
      },
      {
        label: 'On-time delivery',
        value: metrics.onTime != null ? `${metrics.onTime}%` : '—',
        subtitle: 'Share of completed tasks finished by due date',
        progress: metrics.onTime ?? 0,
        barTone: onTimeBarTone,
        accent: '#8E24AA',
      },
      {
        label: 'Hours vs estimate',
        value:
          metrics.estimated > 0
            ? `${metrics.hours.toFixed(1)}h / ${metrics.estimated.toFixed(1)}h`
            : metrics.hours > 0
              ? `${metrics.hours.toFixed(1)}h / —`
              : '0h / 0h',
        subtitle: 'Worked hours / estimated hours',
        progress: metrics.estimated > 0 ? Math.min(100, hoursRatio) : 0,
        barTone: hoursBarTone,
        accent: '#FB8C00',
      },
      {
        label: 'Productivity',
        value: `${metrics.tasksPerHour}`,
        subtitle: 'Completed tasks per hour worked',
        progress: productivityProgress,
        accent: '#3949AB',
      },
    ];
  }, [metrics]);

  const borderColor = isDark ? '#2A2C32' : '#ECECEC';
  const cardBg = theme.palette.background.paper;
  const sprintTableSelection = selectedSprint ? [selectedSprint] : [];

  if (loading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: 'text.primary' }}
            >
              My Performance
            </Typography>
            <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
              Your delivery metrics and sprint trends across the project.
            </Typography>
          </Box>
          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 220 }, ...pageFormFieldOutline() }}
          >
            <InputLabel id="my-performance-sprint-label">Sprint</InputLabel>
            <Select
              labelId="my-performance-sprint-label"
              value={selectedSprint?.id != null ? String(selectedSprint.id) : ''}
              label="Sprint"
              onChange={(e) => {
                const id = Number(e.target.value);
                const sp = sortedSprints.find((s) => Number(s.id) === id);
                setSelectedSprint(sp || null);
              }}
              disabled={!sortedSprints.length}
            >
              {sortedSprints.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {formatSprintLabel(sprintNumberMap, s.id)}
                  {s.startDate && s.endDate
                    ? ` · ${new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <DeveloperMetricCards metrics={performanceCards} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <CompletedTasksBySprintChart data={completedChartData} />
        </Grid>
        <Grid item xs={12} md={6}>
          <HoursWorkedTrendChart data={hoursChartData} />
        </Grid>
      </Grid>

      {selectedSprint == null ? (
        <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
          Select a sprint to view your productivity breakdown and radar.
        </Typography>
      ) : (
        <>
          <Box sx={{ mb: 3 }}>
            <DeveloperTable
              selectedSprints={sprintTableSelection}
              compareMode={false}
              projectDevelopers={projectDevelopers}
              highlightDeveloperName={userName}
            />
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              border: `1px solid ${borderColor}`,
              bgcolor: cardBg,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary', mb: 2 }}>
              Sprint snapshot
            </Typography>
            <Grid container spacing={{ xs: 4, md: 6 }} alignItems="stretch">
              <Grid
                item
                xs={12}
                md={5}
                lg={4}
                sx={{
                  pr: { md: 4, lg: 5 },
                  pb: { xs: 2, md: 0 },
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                  }}
                >
                  <Typography
                    sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600, mb: 1, width: '100%' }}
                  >
                    Radar (vs team)
                  </Typography>
                  <DeveloperRadarCards
                    sprintId={selectedSprint.id}
                    layout="single"
                    developerName={userName}
                    developerUserId={userId}
                  />
                </Box>
              </Grid>
              <Grid
                item
                xs={12}
                md={7}
                lg={8}
                sx={{
                  pl: { md: 4, lg: 5 },
                  pt: { xs: 3, md: 0 },
                }}
              >
                <DeveloperPerformanceNarrative
                  sprintId={selectedSprint.id}
                  userId={userId}
                  userName={userName}
                />
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </Box>
  );
}
