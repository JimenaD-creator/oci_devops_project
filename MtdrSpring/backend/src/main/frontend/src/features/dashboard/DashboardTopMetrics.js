import React from 'react';
import { motion } from 'framer-motion';
import { Box, Paper, Typography } from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingFlatOutlinedIcon from '@mui/icons-material/TrendingFlatOutlined';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import {
  SECTION_TITLE_SX,
  METRIC_LABEL_SX,
  METRIC_VALUE_SX,
  METRIC_HELPER_SX,
} from './dashboardTypography';
import { DASHBOARD_SCROLL_VIEWPORT } from './ScrollReveal';

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
  avgTasksTrend = null,
  avgHoursTrend = null,
  avgTrendSeries = [],
}) {
  const trendLabel = (trend, unit = '') => {
    if (!trend || !Number.isFinite(Number(trend.delta))) return '';
    const d = Number(trend.delta);
    if (Math.abs(d) < 0.05) return '↔ stable vs previous sprint';
    const direction = d > 0 ? '↑ increased' : '↓ decreased';
    return `${direction} ${Math.abs(d).toFixed(1)}${unit} vs previous sprint`;
  };

  const help = multiSprint
    ? {
        tasks: 'Sum of tasks across selected sprints',
        hours: 'Combined logged hours in the selection',
        avgTasks: 'Average across unique developers in scope',
        avgHours: 'Mean of each developer’s total worked hours in the selection',
      }
    : {
        tasks: 'All tasks assigned to this sprint',
        hours: 'Hours logged this sprint',
        avgTasks: 'Per unique developer in this sprint',
        avgHours: 'Total worked hours per developer, averaged across developers in this sprint',
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
      subtitle: multiSprint ? (trendLabel(avgTasksTrend) || help.avgTasks) : help.avgTasks,
      accent: '#5C6BC0',
      tint: 'rgba(92, 107, 192, 0.08)',
      iconBg: 'rgba(92, 107, 192, 0.14)',
    },
    {
      icon: TrendingFlatOutlinedIcon,
      title: 'Average hours per developer',
      value: formatAverage(avgHoursPerDev, uniqueDevCount),
      subtitle: multiSprint ? (trendLabel(avgHoursTrend, 'h') || help.avgHours) : help.avgHours,
      accent: '#00897B',
      tint: 'rgba(0, 137, 123, 0.07)',
      iconBg: 'rgba(0, 137, 123, 0.12)',
    },
  ];

  const showTrendCharts = multiSprint && Array.isArray(avgTrendSeries) && avgTrendSeries.length > 1;

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
                  md: showTrendCharts ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
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
        {items.map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={DASHBOARD_SCROLL_VIEWPORT}
            transition={{ duration: 0.42, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            style={{ minWidth: 0 }}
          >
          <Paper
            elevation={0}
            sx={{
              px: { xs: scorecardsFourColumn ? 1.25 : 2, sm: 2 },
              py: showTrendCharts
                ? (
                  item.title === 'Average tasks per developer' || item.title === 'Average hours per developer'
                    ? { xs: 1.75, sm: 2.1 }
                    : { xs: 1.1, sm: 1.3 }
                )
                : { xs: scorecardsFourColumn ? 1.75 : 2.25, sm: 2.25 },
              borderRadius: 3,
              border: '1px solid #E8EAF0',
              borderTop: `4px solid ${item.accent}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              minHeight: showTrendCharts
                ? (
                  item.title === 'Average tasks per developer' || item.title === 'Average hours per developer'
                    ? { xs: 260, sm: 286, md: 304 }
                    : { xs: 142, sm: 154, md: 164 }
                )
                : { xs: scorecardsFourColumn ? 176 : 168, sm: scorecardsFourColumn ? 184 : 168 },
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
            {(() => {
              const isTrendMetric =
                showTrendCharts
                && (item.title === 'Average tasks per developer' || item.title === 'Average hours per developer');
              const reserveTrendSpace = showTrendCharts && !isTrendMetric;
              return (
                <>
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
                mb: showTrendCharts
                  ? (
                    item.title === 'Average tasks per developer' || item.title === 'Average hours per developer'
                      ? { xs: 1, sm: 1.25 }
                      : { xs: 0.6, sm: 0.8 }
                  )
                  : { xs: scorecardsFourColumn ? 1 : 1.5, sm: 1.5 },
                border: `1px solid ${item.accent}22`,
              }}
            >
              <item.icon sx={{ fontSize: { xs: scorecardsFourColumn ? 22 : 26, sm: 26 }, color: item.accent }} />
            </Box>
            <Typography
              sx={{
                ...METRIC_LABEL_SX,
                color: '#000000',
                mb: { xs: isTrendMetric ? 0.6 : (scorecardsFourColumn ? 0.75 : 1.25), sm: isTrendMetric ? 0.75 : 1.25 },
                px: { xs: scorecardsFourColumn ? 0.25 : 1, sm: 1 },
                ...(scorecardsFourColumn
                  ? { fontSize: { xs: '0.65rem', sm: '0.75rem' }, lineHeight: 1.3 }
                  : {}),
              }}
            >
              {item.title}
            </Typography>
            {isTrendMetric ? (
              <Box sx={{ width: '100%', mt: 'auto', pt: 0.15 }}>
                <Box sx={{ width: '100%', height: 186 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={avgTrendSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CFD8DC" vertical={false} />
                      <XAxis
                        dataKey="sprintLabel"
                        tick={{ fontSize: 10, fill: '#000000' }}
                        axisLine={{ stroke: '#000000' }}
                        tickLine={false}
                      />
                      <YAxis
                        width={28}
                        tick={{ fontSize: 10, fill: '#000000' }}
                        axisLine={{ stroke: '#000000' }}
                        tickLine={false}
                        domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value).toFixed(1)}`, item.title.includes('hours') ? 'Avg hours/dev' : 'Avg tasks/dev']}
                        labelFormatter={(label) => `${label}`}
                        contentStyle={{ borderRadius: 8, borderColor: '#E0E0E0' }}
                      />
                      <Line
                        type="monotone"
                        dataKey={item.title.includes('hours') ? 'avgHoursPerDev' : 'avgTasksPerDev'}
                        stroke={item.accent}
                        strokeWidth={2.25}
                        dot={{ r: 3, fill: item.accent }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
                <Typography
                  sx={{
                    ...METRIC_HELPER_SX,
                    textAlign: 'center',
                    pt: 0.35,
                    px: { xs: scorecardsFourColumn ? 0.15 : 0.75, sm: 0.75 },
                    fontSize: { xs: scorecardsFourColumn ? '0.68rem' : '0.8125rem', sm: '0.8125rem' },
                    lineHeight: 1.35,
                    color: '#000000',
                    fontWeight: 700,
                  }}
                >
                  {item.subtitle}
                </Typography>
              </Box>
            ) : (
              <>
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
                {reserveTrendSpace ? <Box sx={{ width: '100%', height: 12 }} /> : null}
                <Typography
                  sx={{
                    ...METRIC_HELPER_SX,
                    textAlign: 'center',
                    mt: 'auto',
                    pt: 0.5,
                    px: { xs: scorecardsFourColumn ? 0.15 : 0.75, sm: 0.75 },
                    fontSize: { xs: scorecardsFourColumn ? '0.68rem' : '0.8125rem', sm: '0.8125rem' },
                    lineHeight: 1.35,
                    color: '#000000',
                    fontWeight: 700,
                  }}
                >
                  {item.subtitle}
                </Typography>
              </>
            )}
                </>
              );
            })()}
          </Paper>
          </motion.div>
        ))}
      </Box>
    </Box>
  );
}
