import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingFlatOutlinedIcon from '@mui/icons-material/TrendingFlatOutlined';
import {
  SECTION_TITLE_SX,
  METRIC_LABEL_SX,
  METRIC_VALUE_SX,
  METRIC_HELPER_SX,
} from './dashboardTypography';

function formatAverage(n, devCount) {
  if (!devCount) return '—';
  return Number(n).toFixed(1);
}

/**
 * Scorecards: quick numeric KPIs for the selected sprint(s).
 * @param {{ showSectionHeader?: boolean, multiSprint?: boolean, scorecardsFourColumn?: boolean }} props
 * — When several sprints are selected, `scorecardsFourColumn` shows all four cards in one horizontal row (not 2×2).
 */
export default function DashboardTopMetrics({
  totalTasks = 0,
  totalHours = 0,
  avgTasksPerDev = 0,
  avgHoursPerDev = 0,
  uniqueDevCount = 0,
  showSectionHeader = true,
  multiSprint = false,
  scorecardsFourColumn = false,
}) {
  const help = multiSprint
    ? {
        tasks: 'Sum of tasks across selected sprints',
        hours: 'Combined logged hours in the selection',
        avgTasks: 'Average across unique developers in scope',
        avgHours: 'Average hours per developer in scope',
      }
    : {
        tasks: 'All tasks assigned to this sprint',
        hours: 'Hours logged this sprint',
        avgTasks: 'Per unique developer in this sprint',
        avgHours: 'Per unique developer in this sprint',
      };

  const items = [
    {
      icon: AssignmentOutlinedIcon,
      title: 'Total tasks',
      value: String(totalTasks),
      subtitle: help.tasks,
      accent: '#1565C0',
      tint: 'rgba(21, 101, 192, 0.08)',
      iconBg: 'rgba(21, 101, 192, 0.14)',
    },
    {
      icon: ScheduleOutlinedIcon,
      title: 'Total hours worked',
      value: Number(totalHours).toFixed(1),
      subtitle: help.hours,
      accent: '#F57C00',
      tint: 'rgba(245, 124, 0, 0.08)',
      iconBg: 'rgba(245, 124, 0, 0.14)',
    },
    {
      icon: GroupsOutlinedIcon,
      title: 'Average tasks per developer',
      value: formatAverage(avgTasksPerDev, uniqueDevCount),
      subtitle: help.avgTasks,
      accent: '#5C6BC0',
      tint: 'rgba(92, 107, 192, 0.08)',
      iconBg: 'rgba(92, 107, 192, 0.14)',
    },
    {
      icon: TrendingFlatOutlinedIcon,
      title: 'Average hours per developer',
      value: formatAverage(avgHoursPerDev, uniqueDevCount),
      subtitle: help.avgHours,
      accent: '#00897B',
      tint: 'rgba(0, 137, 123, 0.07)',
      iconBg: 'rgba(0, 137, 123, 0.12)',
    },
  ];

  return (
    <Box sx={{ width: '100%', minWidth: 0, mb: showSectionHeader ? 4 : 0, alignSelf: 'stretch' }}>
      {showSectionHeader ? (
        <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: '#1A1A1A', mb: 1, textAlign: 'left' }}>
          Scorecards
        </Typography>
      ) : null}
      <Box
        sx={{
          display: 'grid',
          ...(scorecardsFourColumn
            ? {
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(4, minmax(0, 1fr))',
                },
              }
            : {
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }),
          gap: { xs: scorecardsFourColumn ? 1.25 : 2.25, sm: 2.25 },
          width: '100%',
          minWidth: 0,
          justifyContent: 'start',
          alignItems: 'stretch',
        }}
      >
        {items.map((item) => (
          <Paper
            key={item.title}
            elevation={0}
            sx={{
              px: { xs: scorecardsFourColumn ? 1.25 : 2, sm: 2 },
              py: { xs: scorecardsFourColumn ? 1.75 : 2.25, sm: 2.25 },
              borderRadius: 3,
              border: '1px solid #E8EAF0',
              borderTop: `4px solid ${item.accent}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              minHeight: { xs: scorecardsFourColumn ? 176 : 168, sm: scorecardsFourColumn ? 184 : 168 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              bgcolor: '#FFFFFF',
              background: `linear-gradient(185deg, ${item.tint} 0%, #FFFFFF 52%)`,
              justifyContent: 'flex-start',
              boxSizing: 'border-box',
            }}
          >
            <Box
              sx={{
                width: { xs: scorecardsFourColumn ? 40 : 48, sm: 48 },
                height: { xs: scorecardsFourColumn ? 40 : 48, sm: 48 },
                borderRadius: 2,
                bgcolor: item.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                mb: { xs: scorecardsFourColumn ? 1 : 1.5, sm: 1.5 },
                border: `1px solid ${item.accent}22`,
              }}
            >
              <item.icon sx={{ fontSize: { xs: scorecardsFourColumn ? 22 : 26, sm: 26 }, color: item.accent }} />
            </Box>
            <Typography
              sx={{
                ...METRIC_LABEL_SX,
                color: item.accent,
                mb: { xs: scorecardsFourColumn ? 0.75 : 1.25, sm: 1.25 },
                px: { xs: scorecardsFourColumn ? 0.25 : 1, sm: 1 },
                ...(scorecardsFourColumn
                  ? { fontSize: { xs: '0.65rem', sm: '0.75rem' }, lineHeight: 1.3 }
                  : {}),
              }}
            >
              {item.title}
            </Typography>
            <Typography
              sx={{
                ...METRIC_VALUE_SX,
                mb: 0.5,
                ...(scorecardsFourColumn
                  ? { fontSize: { xs: '1.35rem', sm: '1.65rem', md: '1.75rem' } }
                  : {}),
              }}
            >
              {item.value}
            </Typography>
            <Typography
              sx={{
                ...METRIC_HELPER_SX,
                textAlign: 'center',
                mt: 'auto',
                pt: 0.5,
                px: { xs: scorecardsFourColumn ? 0.15 : 0.75, sm: 0.75 },
                fontSize: { xs: scorecardsFourColumn ? '0.68rem' : '0.8125rem', sm: '0.8125rem' },
                lineHeight: 1.35,
              }}
            >
              {item.subtitle}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
