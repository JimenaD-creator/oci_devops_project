import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { shortDevName } from '../dashboard/dashboardSprintData';

const FALLBACK_SPRINT_COLOR = '#00897B';

const CHART_H = 300;

const AXIS_TICK = { fontSize: 14, fill: '#1565C0' };
const AXIS_LINE = { stroke: '#64B5F6' };
const GRID_STROKE = '#E1BEE7';
const TOOLTIP_CONTENT = { borderRadius: 8, border: '1px solid #90CAF9', fontSize: 14, padding: '10px 12px' };

/** Recharts needs minWidth: 0 so the canvas does not overflow the dashboard column. */
function ChartPlot({ children }) {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, height: CHART_H, overflow: 'hidden' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </Box>
  );
}

function ChartCard({ title, subtitle, iconElement, children }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: subtitle ? 0.75 : 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(199,70,52,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iconElement ?? null}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.12rem', lineHeight: 1.3 }}>{title}</Typography>
          {subtitle ? (
            <Typography sx={{ color: '#666', display: 'block', fontSize: '0.95rem', mt: 0.35, fontWeight: 500 }}>{subtitle}</Typography>
          ) : null}
        </Box>
      </Box>
      {children}
    </Paper>
  );
}

function sprintFieldKey(sp, suffix) {
  return `sp${sp.id}_${suffix}`;
}

function buildBarRows(selectedSprints, mode) {
  const suffix = mode === 'completed' ? 'c' : mode === 'assigned' ? 'a' : 'h';
  const names = new Set();
  selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      const key = sprintFieldKey(sp, suffix);
      if (mode === 'completed') {
        row[key] = dev ? dev.completed : 0;
      } else if (mode === 'assigned') {
        row[key] = dev ? (dev.assigned ?? 0) : 0;
      } else {
        row[key] = dev ? dev.hours : 0;
      }
    });
    return row;
  });
}

function buildSprintAverageRows(selectedSprints) {
  return selectedSprints.map((sp) => {
    const devs = sp.developers || [];
    const n = devs.length;
    const sumCompleted = devs.reduce((a, d) => a + (d.completed || 0), 0);
    const sumHours = devs.reduce((a, d) => a + (d.hours || 0), 0);
    const sumAssigned = devs.reduce((a, d) => a + (d.assigned || 0), 0);
    return {
      shortLabel: sp.shortLabel,
      avgTasksPerDev: n ? Number((sumCompleted / n).toFixed(2)) : 0,
      avgHoursPerDev: n ? Number((sumHours / n).toFixed(2)) : 0,
      avgAssignedPerDev: n ? Number((sumAssigned / n).toFixed(2)) : 0,
      developerCount: n,
      accentColor: sp.accentColor ?? FALLBACK_SPRINT_COLOR,
    };
  });
}

/**
 * Legend row with a dashed line swatch + a pill for EACH sprint's average value.
 * variant: 'assigned' | 'hours'
 */
function SprintAvgLegend({ sprintAvgRows, variant }) {
  const innerLabel =
    variant === 'assigned'
      ? 'Average assigned tasks / developer'
      : 'Average hours per developer';

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25, flexWrap: 'wrap' }}>
      {/* One pill per sprint */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {sprintAvgRows.map((row) => {
          const value =
            variant === 'assigned'
              ? `${row.avgAssignedPerDev} assigned`
              : `${Number(row.avgHoursPerDev).toFixed(2)} h`;
          return (
            <Box
              key={row.shortLabel}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.5,
                borderRadius: 2,
                border: `1.5px dashed ${row.accentColor}`,
                bgcolor: `${row.accentColor}14`,
              }}
            >
              {/* Tiny colored dash swatch */}
              <Box component="span" sx={{ display: 'inline-block', width: 18, borderTop: `2.5px dashed ${row.accentColor}`, flexShrink: 0 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <Typography sx={{ fontSize: '0.70rem', fontWeight: 600, color: row.accentColor, whiteSpace: 'nowrap' }}>
                  {innerLabel}
                </Typography>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: row.accentColor, whiteSpace: 'nowrap' }}>
                  {row.shortLabel}: {value}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function AveragePrintLabel({ sprintAvgRows, variant }) {
  if (!sprintAvgRows?.length) return null;
  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1.25,
        bgcolor: '#FAFAFA',
        borderRadius: 2,
        border: '1px solid #E0E0E0',
        '@media print': { border: '1px solid #000', bgcolor: '#fff' },
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#757575', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.75 }}>
        Average (for selected sprint{sprintAvgRows.length > 1 ? 's' : ''})
      </Typography>
      <Typography component="div" sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#333', lineHeight: 1.5 }}>
        {sprintAvgRows.map((row) => {
          let val;
          let formatted;
          if (variant === 'assigned') {
            val = row.avgAssignedPerDev;
            formatted = `${val} assigned tasks (all statuses)`;
          } else if (variant === 'tasks') {
            val = row.avgTasksPerDev;
            formatted = `${val} completed tasks`;
          } else {
            val = row.avgHoursPerDev;
            formatted = `${Number(val).toFixed(2)} hours`;
          }
          return (
            <Box key={row.shortLabel} component="span" sx={{ display: 'inline-block', mr: 2, mb: 0.5 }}>
              <Box component="span" sx={{ color: row.accentColor, fontWeight: 800 }}>{row.shortLabel}</Box>
              {': '}
              {formatted}
              <Box component="span" sx={{ color: '#757575', fontWeight: 500, fontSize: '0.85rem', ml: 0.5 }}>
                ({row.developerCount} dev{row.developerCount === 1 ? '' : 's'})
              </Box>
            </Box>
          );
        })}
      </Typography>
    </Box>
  );
}

export default function DeveloperWorkloadCharts({ selectedSprints = [], compareMode = false }) {
  const { sprintAvgRows, completedRows, hoursRows, assignedRows, hasData } = useMemo(() => {
    if (!selectedSprints?.length) {
      return { sprintAvgRows: [], completedRows: [], hoursRows: [], assignedRows: [], hasData: false };
    }

    const sprintAvgRowsInner = buildSprintAverageRows(selectedSprints);
    const completedData = buildBarRows(selectedSprints, 'completed');
    const hoursData = buildBarRows(selectedSprints, 'hours');
    const assignedData = buildBarRows(selectedSprints, 'assigned');
    const hasCompleted = completedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'c')] || 0) > 0)
    );
    const hasHours = hoursData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'h')] || 0) > 0)
    );
    const hasAssigned = assignedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'a')] || 0) > 0)
    );
    const devNames = new Set();
    selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => d.name && devNames.add(d.name)));
    const n = devNames.size;

    return {
      sprintAvgRows: sprintAvgRowsInner,
      completedRows: completedData,
      hoursRows: hoursData,
      assignedRows: assignedData,
      hasData: n > 0 && (hasCompleted || hasHours || hasAssigned),
    };
  }, [selectedSprints]);

  if (!hasData) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: '1px dashed #ccc',
          borderRadius: 2,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography sx={{ color: 'text.secondary', fontSize: '1rem' }}>
          No developer breakdown for the selected sprints (assign work via user-tasks).
        </Typography>
      </Box>
    );
  }

  const tooltipStyle = TOOLTIP_CONTENT;

  const showAssignedWorkloadChart = assignedRows.length > 0;

  return (
    <Box
      sx={{
        mb: 3,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
        {/* ── Assigned tasks by developer (one or more sprints) ─────────── */}
        {showAssignedWorkloadChart ? (
          <ChartCard
            title="Assigned tasks by developer"
            subtitle={
              compareMode
                ? 'Grouped by sprint. Dashed line = average assigned tasks per developer in that sprint.'
                : 'Tasks assigned. Average = tasks / developers.'
            }
            iconElement={<AssignmentOutlinedIcon sx={{ color: '#5D4037', fontSize: 26 }} />}
          >
            <SprintAvgLegend sprintAvgRows={sprintAvgRows} variant="assigned" />
            <ChartPlot>
              <BarChart
                data={assignedRows}
                margin={{ top: 28, right: 16, left: 4, bottom: 8 }}
                barGap={4}
                barCategoryGap={compareMode ? '22%' : '24%'}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}`, 'Assigned tasks']} />
                <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                {selectedSprints.map((sp) => (
                  <Bar
                    key={sp.id}
                    dataKey={sprintFieldKey(sp, 'a')}
                    name={sp.shortLabel}
                    fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                ))}
                {sprintAvgRows.map((row) => (
                  <ReferenceLine
                    key={`avg-asg-${row.shortLabel}`}
                    y={row.avgAssignedPerDev}
                    stroke={row.accentColor}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    strokeOpacity={0.85}
                    ifOverflow="extendDomain"
                  />
                ))}
              </BarChart>
            </ChartPlot>
          </ChartCard>
        ) : null}

        <ChartCard title="Completed tasks by developer" iconElement={<BarChartIcon sx={{ color: '#C74634', fontSize: 26 }} />}>
          <ChartPlot>
            <BarChart data={completedRows} margin={{ top: 28, right: 16, left: 4, bottom: 8 }} barGap={4} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} tasks`, 'Completed']} />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
              {selectedSprints.map((sp) => (
                <Bar
                  key={sp.id}
                  dataKey={sprintFieldKey(sp, 'c')}
                  name={sp.shortLabel}
                  fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ChartPlot>
        </ChartCard>

        {/* ── Total worked hours by developer ──────────────────────────── */}
        <ChartCard title="Total worked hours by developer" iconElement={<ScheduleIcon sx={{ color: '#1E88E5', fontSize: 26 }} />}>
          <SprintAvgLegend sprintAvgRows={sprintAvgRows} variant="hours" />
          <ChartPlot>
            <BarChart data={hoursRows} margin={{ top: 28, right: 16, left: 4, bottom: 8 }} barGap={4} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
              <YAxis tick={AXIS_TICK} axisLine={false} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} h`, 'Real hours']} />
              <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
              {selectedSprints.map((sp) => (
                <Bar
                  key={sp.id}
                  dataKey={sprintFieldKey(sp, 'h')}
                  name={sp.shortLabel}
                  fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ))}
              {sprintAvgRows.map((row) => (
                <ReferenceLine
                  key={`avg-hrs-${row.shortLabel}`}
                  y={row.avgHoursPerDev}
                  stroke={row.accentColor}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  ifOverflow="extendDomain"
                />
              ))}
            </BarChart>
          </ChartPlot>
        </ChartCard>
      </Stack>
    </Box>
  );
}