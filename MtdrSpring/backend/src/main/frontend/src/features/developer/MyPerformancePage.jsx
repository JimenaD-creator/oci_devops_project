import React, { useEffect, useMemo, useState } from 'react';
import { Box, Grid, Typography, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { useProjectData } from '../../contexts/ProjectDataContext';
import DeveloperMetricCards from './DeveloperMetricCards';
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

const ORACLE_RED = '#C74634';

export default function MyPerformancePage({ projectId, currentUser }) {
  const { sprints: sharedSprints, loading: sharedLoading, error: sharedError } = useProjectData();
  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
        sx={{ mb: 2 }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: 'text.primary' }}>
          My Performance
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Your delivery metrics and sprint trends across the project.
        </Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <DeveloperMetricCards metrics={performanceCards} />

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <CompletedTasksBySprintChart data={completedChartData} />
        </Grid>
        <Grid item xs={12} md={6}>
          <HoursWorkedTrendChart data={hoursChartData} />
        </Grid>
      </Grid>
    </Box>
  );
}
