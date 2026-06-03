import React from 'react';
import { motion } from 'framer-motion';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import TrendingFlatOutlinedIcon from '@mui/icons-material/TrendingFlatOutlined';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
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

const TREND_SUMMARY_TITLES = new Set(['Tasks Completed', 'Total hours worked']);
const TREND_CHART_TITLES = new Set(['Average tasks per developer', 'Average hours per developer']);

function isTrendSummaryCard(title, showTrendCharts) {
  return showTrendCharts && TREND_SUMMARY_TITLES.has(title);
}

function isTrendChartCard(title, showTrendCharts) {
  return showTrendCharts && TREND_CHART_TITLES.has(title);
}

/** Left stack + two trend columns on md+ (compare mode). */
const COMPARE_TREND_GRID_PLACEMENT = {
  'Tasks Completed': { gridColumn: { md: '1' }, gridRow: { md: '1' } },
  'Total hours worked': { gridColumn: { md: '1' }, gridRow: { md: '2' } },
  'Average tasks per developer': { gridColumn: { md: '2' }, gridRow: { md: '1 / span 2' } },
  'Average hours per developer': { gridColumn: { md: '3' }, gridRow: { md: '1 / span 2' } },
};

/**
 * Scorecards: quick numeric KPIs for the selected sprint(s).
 * @param {{ showSectionHeader?: boolean, multiSprint?: boolean, scorecardsFourColumn?: boolean }} props
 * — When several sprints are selected, `scorecardsFourColumn` uses a 3-column layout on md+:
 *   summary cards stacked on the left, trend charts full-height on the right.
 */
export default function DashboardTopMetrics({
  totalTasks = 0,
  totalCompleted = 0,
  totalAssigned = 0,
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const trendLabel = (trend, unit = '') => {
    if (!trend || !Number.isFinite(Number(trend.delta))) return '';
    const d = Number(trend.delta);
    if (Math.abs(d) < 0.05) return '↔ stable vs previous sprint';
    const direction = d > 0 ? '↑ increased' : '↓ decreased';
    return `${direction} ${Math.abs(d).toFixed(1)}${unit} vs previous sprint`;
  };

  const completed = Math.max(0, Math.round(Number(totalCompleted) || 0));
  const assigned = Math.max(0, Math.round(Number(totalAssigned) || 0));

  const tasksCompletedSubtitle =
    assigned > 0
      ? `${completed} of ${assigned} tasks completed`
      : `${completed} ${completed === 1 ? 'task' : 'tasks'} completed`;

  const help = multiSprint
    ? {
        hours: 'Combined logged hours in the selection',
        avgTasks: 'Total tasks divided by developers on the project team',
        avgHours: 'Total hours divided by developers on the project team',
      }
    : {
        hours: 'Hours logged this sprint',
        avgTasks: 'Tasks',
        avgHours: 'Hours',
      };

  const items = [
    {
      icon: AssignmentOutlinedIcon,
      title: 'Tasks Completed',
      value: String(completed),
      subtitle: tasksCompletedSubtitle,
      accent: '#1565C0',
      tint: isDark ? 'rgba(21, 101, 192, 0.12)' : 'rgba(21, 101, 192, 0.08)',
      iconBg: isDark ? 'rgba(21, 101, 192, 0.2)' : 'rgba(21, 101, 192, 0.14)',
    },
    {
      icon: ScheduleOutlinedIcon,
      title: 'Total hours worked',
      value: Number(totalHours).toFixed(1),
      subtitle: help.hours,
      accent: '#F57C00',
      tint: isDark ? 'rgba(245, 124, 0, 0.12)' : 'rgba(245, 124, 0, 0.08)',
      iconBg: isDark ? 'rgba(245, 124, 0, 0.2)' : 'rgba(245, 124, 0, 0.14)',
    },
    {
      icon: GroupsOutlinedIcon,
      title: 'Average tasks per developer',
      value: formatAverage(avgTasksPerDev, uniqueDevCount),
      subtitle: multiSprint ? trendLabel(avgTasksTrend) || help.avgTasks : help.avgTasks,
      accent: '#5C6BC0',
      tint: isDark ? 'rgba(92, 107, 192, 0.12)' : 'rgba(92, 107, 192, 0.08)',
      iconBg: isDark ? 'rgba(92, 107, 192, 0.2)' : 'rgba(92, 107, 192, 0.14)',
    },
    {
      icon: TrendingFlatOutlinedIcon,
      title: 'Average hours per developer',
      value: formatAverage(avgHoursPerDev, uniqueDevCount),
      subtitle: multiSprint ? trendLabel(avgHoursTrend, 'h') || help.avgHours : help.avgHours,
      accent: '#00897B',
      tint: isDark ? 'rgba(0, 137, 123, 0.11)' : 'rgba(0, 137, 123, 0.07)',
      iconBg: isDark ? 'rgba(0, 137, 123, 0.18)' : 'rgba(0, 137, 123, 0.12)',
    },
  ];

  const showTrendCharts = multiSprint && Array.isArray(avgTrendSeries) && avgTrendSeries.length > 1;
  const compactCompareRow = scorecardsFourColumn && showTrendCharts;

  const trendChartTooltipStyles = {
    contentStyle: {
      borderRadius: 6,
      borderColor: isDark ? '#2A2C32' : '#E0E0E0',
      backgroundColor: isDark ? '#1C1E22' : '#FFFFFF',
      color: isDark ? '#F0F0F0' : '#1A1A1A',
      fontSize: '0.68rem',
      padding: '4px 7px',
      lineHeight: 1.25,
    },
    labelStyle: {
      fontSize: '0.65rem',
      fontWeight: 600,
      marginBottom: 2,
      color: isDark ? '#B0B0B0' : '#555555',
    },
    itemStyle: {
      fontSize: '0.65rem',
      padding: 0,
    },
    wrapperStyle: { outline: 'none', zIndex: 1 },
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, mb: showSectionHeader ? 2 : 0, alignSelf: 'stretch' }}>
      {showSectionHeader ? (
        <Typography
          component="h2"
          sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 1, textAlign: 'left' }}
        >
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
                  md: compactCompareRow
                    ? 'minmax(0, 0.72fr) minmax(0, 1.14fr) minmax(0, 1.14fr)'
                    : 'repeat(4, minmax(0, 1fr))',
                },
                ...(compactCompareRow
                  ? {
                      gridTemplateRows: { xs: 'auto', sm: 'auto', md: '1fr 1fr' },
                      minHeight: { md: 248 },
                    }
                  : {}),
              }
            : {
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              }),
          gap: { xs: scorecardsFourColumn ? 1 : 1.5, sm: 1.5 },
          width: '100%',
          minWidth: 0,
          justifyContent: 'start',
          alignItems: 'stretch',
        }}
      >
        {items.map((item, i) => {
          const isTrendMetric = isTrendChartCard(item.title, showTrendCharts);
          const isSummaryMetric = isTrendSummaryCard(item.title, showTrendCharts);
          const comparePlacement = compactCompareRow
            ? COMPARE_TREND_GRID_PLACEMENT[item.title]
            : null;

          return (
            <Box
              component={motion.div}
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={DASHBOARD_SCROLL_VIEWPORT}
              transition={{ duration: 0.42, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
              sx={{
                minWidth: 0,
                ...(comparePlacement
                  ? {
                      gridColumn: comparePlacement.gridColumn,
                      gridRow: comparePlacement.gridRow,
                      height: { md: '100%' },
                      display: { md: 'flex' },
                      flexDirection: { md: 'column' },
                    }
                  : {}),
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: {
                    xs: scorecardsFourColumn ? (isSummaryMetric ? 0.85 : 1) : 1.5,
                    sm: isSummaryMetric ? 1.1 : 1.5,
                  },
                  py: showTrendCharts
                    ? isTrendMetric
                      ? { xs: 1.2, sm: 1.35 }
                      : { xs: 0.85, sm: 1 }
                    : { xs: scorecardsFourColumn ? 1.35 : 1.5, sm: 1.5 },
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: isDark ? '#2A2C32' : '#E8EAF0',
                  borderTop: `4px solid ${item.accent}`,
                  boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
                  minHeight: showTrendCharts
                    ? isTrendMetric
                      ? { xs: 210, sm: 228, md: compactCompareRow ? '100%' : 240 }
                      : { xs: 118, sm: 128, md: compactCompareRow ? '100%' : 136 }
                    : {
                        xs: scorecardsFourColumn ? 148 : 140,
                        sm: scorecardsFourColumn ? 156 : 148,
                      },
                  height: compactCompareRow ? { md: '100%' } : 'auto',
                  flex: compactCompareRow ? { md: 1 } : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  bgcolor: 'background.paper',
                  background: isDark
                    ? `linear-gradient(185deg, ${item.tint} 0%, #1C1E22 52%)`
                    : `linear-gradient(185deg, ${item.tint} 0%, #FFFFFF 52%)`,
                  justifyContent:
                    compactCompareRow && isSummaryMetric ? { md: 'center' } : 'flex-start',
                  boxSizing: 'border-box',
                }}
              >
                <>
                  <Box
                    sx={{
                      width: {
                        xs: isSummaryMetric ? 32 : scorecardsFourColumn ? 40 : 48,
                        sm: isSummaryMetric ? 34 : 48,
                      },
                      height: {
                        xs: isSummaryMetric ? 32 : scorecardsFourColumn ? 40 : 48,
                        sm: isSummaryMetric ? 34 : 48,
                      },
                      borderRadius: 2,
                      bgcolor: item.iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mb: showTrendCharts
                        ? isTrendMetric
                          ? { xs: 0.75, sm: 1 }
                          : { xs: 0.35, sm: 0.45 }
                        : { xs: scorecardsFourColumn ? 1 : 1.5, sm: 1.5 },
                      border: `1px solid ${item.accent}22`,
                    }}
                  >
                    <item.icon
                      sx={{
                        fontSize: {
                          xs: isSummaryMetric ? 18 : scorecardsFourColumn ? 22 : 26,
                          sm: isSummaryMetric ? 20 : 26,
                        },
                        color: item.accent,
                      }}
                    />
                  </Box>
                  <Typography
                    sx={{
                      ...METRIC_LABEL_SX,
                      color: 'text.primary',
                      mb: {
                        xs: isTrendMetric
                          ? 0.5
                          : isSummaryMetric
                            ? 0.35
                            : scorecardsFourColumn
                              ? 0.75
                              : 1.25,
                        sm: isTrendMetric ? 0.65 : isSummaryMetric ? 0.4 : 1.25,
                      },
                      px: { xs: scorecardsFourColumn ? 0.25 : 1, sm: 1 },
                      ...(scorecardsFourColumn || isSummaryMetric
                        ? {
                            fontSize: {
                              xs: isSummaryMetric ? '0.6rem' : '0.65rem',
                              sm: isSummaryMetric ? '0.68rem' : '0.75rem',
                            },
                            lineHeight: 1.25,
                          }
                        : {}),
                    }}
                  >
                    {item.title}
                  </Typography>
                  {isTrendMetric ? (
                    <Box
                      sx={{
                        width: '100%',
                        mt: 'auto',
                        pt: 0.1,
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <Box
                        sx={{
                          width: '100%',
                          flex: 1,
                          minHeight: compactCompareRow ? { md: 130 } : 140,
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={avgTrendSeries}
                            margin={{ top: 4, right: 6, left: 0, bottom: 2 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={isDark ? '#2A2C32' : '#CFD8DC'}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="sprintLabel"
                              angle={-38}
                              textAnchor="end"
                              height={46}
                              interval={0}
                              tick={{
                                fontSize: 9,
                                fill: isDark ? '#9A9A9A' : '#424242',
                              }}
                              axisLine={{ stroke: isDark ? '#2A2C32' : '#000000' }}
                              tickLine={false}
                              dy={6}
                            />
                            <YAxis
                              width={24}
                              tick={{ fontSize: 9, fill: isDark ? '#9A9A9A' : '#424242' }}
                              axisLine={{ stroke: isDark ? '#2A2C32' : '#000000' }}
                              tickLine={false}
                              domain={['dataMin - 0.5', 'dataMax + 0.5']}
                            />
                            <Tooltip
                              formatter={(value) => [
                                `${Number(value).toFixed(1)}`,
                                item.title.includes('hours') ? 'Avg hours/dev' : 'Avg tasks/dev',
                              ]}
                              labelFormatter={(label) => `${label}`}
                              {...trendChartTooltipStyles}
                            />
                            <Line
                              type="monotone"
                              dataKey={
                                item.title.includes('hours') ? 'avgHoursPerDev' : 'avgTasksPerDev'
                              }
                              stroke={item.accent}
                              strokeWidth={2.25}
                              dot={{ r: 2.75, fill: item.accent }}
                              activeDot={{ r: 3.5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                      <Typography
                        sx={{
                          ...METRIC_HELPER_SX,
                          textAlign: 'center',
                          pt: 0.25,
                          px: { xs: scorecardsFourColumn ? 0.15 : 0.75, sm: 0.75 },
                          fontSize: {
                            xs: scorecardsFourColumn ? '0.62rem' : '0.8125rem',
                            sm: '0.72rem',
                          },
                          lineHeight: 1.3,
                          color: 'text.secondary',
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
                          color: 'text.primary',
                          mb: item.subtitle ? (isSummaryMetric ? 0.25 : 0.5) : 0,
                          ...(item.valueCompact
                            ? {
                                fontSize: {
                                  xs: scorecardsFourColumn ? '0.9rem' : '1rem',
                                  sm: '1.05rem',
                                },
                                lineHeight: 1.35,
                                fontWeight: 700,
                              }
                            : isSummaryMetric
                              ? { fontSize: { xs: '1.15rem', sm: '1.35rem', md: '1.4rem' } }
                              : scorecardsFourColumn
                                ? { fontSize: { xs: '1.35rem', sm: '1.65rem', md: '1.75rem' } }
                                : {}),
                        }}
                      >
                        {item.value}
                      </Typography>
                      {item.subtitle ? (
                        <Typography
                          sx={{
                            ...METRIC_HELPER_SX,
                            textAlign: 'center',
                            mt: isSummaryMetric && compactCompareRow ? 0 : 0,
                            pt: isSummaryMetric ? 0.35 : 0.5,
                            px: { xs: scorecardsFourColumn ? 0.15 : 0.75, sm: 0.75 },
                            fontSize: {
                              xs: isSummaryMetric
                                ? '0.62rem'
                                : scorecardsFourColumn
                                  ? '0.68rem'
                                  : '0.8125rem',
                              sm: isSummaryMetric ? '0.7rem' : '0.8125rem',
                            },
                            lineHeight: 1.3,
                            color: 'text.secondary',
                            fontWeight: 700,
                          }}
                        >
                          {item.subtitle}
                        </Typography>
                      ) : null}
                    </>
                  )}
                </>
              </Paper>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
