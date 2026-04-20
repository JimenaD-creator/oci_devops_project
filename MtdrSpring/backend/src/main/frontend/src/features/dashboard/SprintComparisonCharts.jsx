import React, { useMemo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { avgHoursPerDeveloper } from './dashboardSprintData';
import { RECHARTS_BAR_TOOLTIP_PROPS, CHART_DESC_SX } from './dashboardTypography';

const CHART_H_BASE = 228;

const Y_AXIS_TICK = { fontSize: 12, fill: '#1A1A1A', fontWeight: 500 };
const X_AXIS_LINE = { stroke: '#BDBDBD' };
const GRID_STROKE = '#E1BEE7';
const FALLBACK_SPRINT_COLOR = '#424242';

/** Planned hours on TASK rows (assigned_hours). */
const HOURS_PLANNED_TASK_FILL = '#5C6BC0';
/** Logged hours summed from USER_TASK.worked_hours. */
const HOURS_WORKED_USER_TASK_FILL = '#FB8C00';

const tooltipPaper = {
  borderRadius: 8,
  border: '1px solid #90CAF9',
  fontSize: 14,
  padding: '10px 12px',
  background: '#fff',
  boxShadow: '0 2px 10px rgba(21,101,192,0.15)',
};

function SprintMetricTooltip({ active, payload, metric, valueFormatter }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const sprintColor = row.accentColor ?? FALLBACK_SPRINT_COLOR;
  const rawValue = payload[0]?.value;
  const formattedValue = valueFormatter ? valueFormatter(rawValue) : rawValue;
  const pending = row.pending ?? 0;
  const metricLabel =
    metric === 'completed'
      ? 'Completed'
      : metric === 'hours'
        ? 'Hours worked'
        : metric === 'avgHoursPerDev'
          ? 'Average hours / developer'
          : 'Average';

  return (
    <Box sx={{ ...tooltipPaper, border: `1px solid ${sprintColor}66` }}>
      <Typography
        sx={{ fontWeight: 700, color: sprintColor, display: 'block', fontSize: '0.95rem' }}
      >
        {row.name}
      </Typography>
      <Typography
        sx={{ color: sprintColor, display: 'block', mt: 0.5, fontSize: '0.9rem', fontWeight: 700 }}
      >
        {metricLabel}: {formattedValue}
      </Typography>
      {metric === 'hours' || metric === 'avgHoursPerDev' ? (
        <Typography
          sx={{
            color: sprintColor,
            display: 'block',
            mt: 0.35,
            fontSize: '0.84rem',
            fontWeight: 600,
            opacity: 0.85,
          }}
        >
          Open tasks: {pending}
        </Typography>
      ) : null}
    </Box>
  );
}

function SprintCompareBarBlock({ title, description, data, dataKey, valueFormatter }) {
  const n = data?.length ?? 0;
  const chartH = Math.min(340, CHART_H_BASE + Math.max(0, n - 4) * 16);
  const marginBottom = Math.min(64, 40 + Math.max(0, n - 4) * 6);
  const barCategoryGap = n >= 7 ? '12%' : n >= 5 ? '16%' : '24%';
  const tickFontSize = n > 7 ? 9 : n > 5 ? 10 : 11;

  const renderSprintXTick = (props) => {
    const { x, y, payload } = props;
    const row = data.find((d) => d.shortLabel === payload.value);
    const fill = row?.accentColor ?? FALLBACK_SPRINT_COLOR;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          transform="rotate(-38)"
          textAnchor="end"
          fill={fill}
          fontSize={tickFontSize}
          fontWeight={600}
          dy={8}
          dx={-2}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography
        sx={{ fontWeight: 800, color: '#1A1A1A', mb: description ? 0.35 : 1, fontSize: '1.02rem' }}
      >
        {title}
      </Typography>
      {description ? <Typography sx={{ ...CHART_DESC_SX, mb: 1 }}>{description}</Typography> : null}
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 10, left: 4, bottom: marginBottom }}
          barCategoryGap={barCategoryGap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={renderSprintXTick}
            axisLine={X_AXIS_LINE}
            tickLine={{ stroke: '#BDBDBD' }}
            interval={0}
            height={48}
          />
          <YAxis tick={Y_AXIS_TICK} axisLine={false} width={48} />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            shared={false}
            content={<SprintMetricTooltip metric={dataKey} valueFormatter={valueFormatter} />}
          />
          <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={44}>
            {data.map((row) => (
              <Cell key={row.shortLabel} fill={row.accentColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

function HoursPlannedVsWorkedTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const sprintColor = row.accentColor ?? FALLBACK_SPRINT_COLOR;
  const planned = Number(row.assignedHoursTasks ?? 0);
  const worked = Number(row.workedHoursUserTask ?? 0);
  const pending = row.pending ?? 0;
  return (
    <Box sx={{ ...tooltipPaper, border: `1px solid ${sprintColor}66` }}>
      <Typography
        sx={{ fontWeight: 700, color: sprintColor, display: 'block', fontSize: '0.95rem' }}
      >
        {row.name}
      </Typography>
      <Typography
        sx={{
          color: HOURS_PLANNED_TASK_FILL,
          display: 'block',
          mt: 0.75,
          fontSize: '0.88rem',
          fontWeight: 700,
        }}
      >
        Planned (TASK assigned hours): {planned.toFixed(1)} h
      </Typography>
      <Typography
        sx={{
          color: HOURS_WORKED_USER_TASK_FILL,
          display: 'block',
          mt: 0.35,
          fontSize: '0.88rem',
          fontWeight: 700,
        }}
      >
        Worked (USER_TASK logged): {worked.toFixed(1)} h
      </Typography>
      <Typography
        sx={{
          color: sprintColor,
          display: 'block',
          mt: 0.5,
          fontSize: '0.84rem',
          fontWeight: 600,
          opacity: 0.85,
        }}
      >
        Open tasks: {pending}
      </Typography>
    </Box>
  );
}

function SprintHoursCompareBlock({ data }) {
  const n = data?.length ?? 0;
  const chartH = Math.min(360, CHART_H_BASE + Math.max(0, n - 4) * 16);
  const marginBottom = Math.min(72, 48 + Math.max(0, n - 4) * 6);
  const barCategoryGap = n >= 7 ? '12%' : n >= 5 ? '16%' : '24%';
  const tickFontSize = n > 7 ? 9 : n > 5 ? 10 : 11;

  const renderSprintXTick = (props) => {
    const { x, y, payload } = props;
    const row = data.find((d) => d.shortLabel === payload.value);
    const fill = row?.accentColor ?? FALLBACK_SPRINT_COLOR;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          transform="rotate(-38)"
          textAnchor="end"
          fill={fill}
          fontSize={tickFontSize}
          fontWeight={600}
          dy={8}
          dx={-2}
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800, color: '#1A1A1A', mb: 0.35, fontSize: '1.02rem' }}>
        Hours: planned vs worked
      </Typography>
      <Typography sx={{ ...CHART_DESC_SX, mb: 1 }}>
        Planned = sum of task assigned hours; worked = sum of USER_TASK worked hours per sprint.
      </Typography>
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 10, left: 4, bottom: marginBottom }}
          barCategoryGap={barCategoryGap}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={renderSprintXTick}
            axisLine={X_AXIS_LINE}
            tickLine={{ stroke: '#BDBDBD' }}
            interval={0}
            height={48}
          />
          <YAxis tick={Y_AXIS_TICK} axisLine={false} width={48} />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            shared
            content={<HoursPlannedVsWorkedTooltip />}
          />
          <Legend
            verticalAlign="top"
            wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingBottom: 4 }}
          />
          <Bar
            dataKey="assignedHoursTasks"
            name="Planned (TASK assigned hours)"
            fill={HOURS_PLANNED_TASK_FILL}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            dataKey="workedHoursUserTask"
            name="Worked (USER_TASK logged)"
            fill={HOURS_WORKED_USER_TASK_FILL}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

/**
 * Bar charts per metric when two or more sprints are selected (chronological order on X).
 */
export default function SprintComparisonCharts({ selectedSprints = [] }) {
  const data = useMemo(() => {
    if (!selectedSprints?.length || selectedSprints.length < 2) return [];
    return [...selectedSprints]
      .sort((a, b) => a.id - b.id)
      .map((sp) => {
        const total = sp.totalTasks ?? 0;
        const done = sp.totalCompleted ?? 0;
        const pending = Math.max(0, total - done);
        const planned = Number(sp.totalAssignedHoursTasks ?? 0);
        const worked = Number(sp.totalHours ?? 0);
        return {
          shortLabel: sp.shortLabel,
          name: sp.name,
          accentColor: sp.accentColor,
          completed: done,
          pending,
          assignedHoursTasks: Number(planned.toFixed(1)),
          workedHoursUserTask: Number(worked.toFixed(1)),
          avgHoursPerDev: avgHoursPerDeveloper(sp),
        };
      });
  }, [selectedSprints]);

  if (data.length < 2) return null;

  return (
    <Paper
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(21, 101, 192, 0.09)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CompareArrowsIcon sx={{ color: '#1565C0', fontSize: 26 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.12rem' }}>
            Sprint comparison
          </Typography>
          <Typography sx={{ ...CHART_DESC_SX, mt: 0.5, display: 'block' }}>
            Side-by-side bars for each selected sprint (chronological on the X axis).
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <SprintCompareBarBlock
          title="Completed tasks per sprint"
          description="Tasks marked completed in each sprint."
          data={data}
          dataKey="completed"
          valueFormatter={(v) => `${v} tasks`}
        />
        <SprintHoursCompareBlock data={data} />
        <SprintCompareBarBlock
          title="Average hours / developer"
          description="Total hours worked (USER_TASK) in the sprint divided by the number of developers."
          data={data}
          dataKey="avgHoursPerDev"
          valueFormatter={(v) => `${v} h/dev`}
        />
      </Box>
    </Paper>
  );
}
