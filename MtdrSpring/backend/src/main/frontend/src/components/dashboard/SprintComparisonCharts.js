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
} from 'recharts';
import { avgHoursPerTask } from './dashboardSprintData';
import { RECHARTS_BAR_TOOLTIP_PROPS, CHART_DESC_SX } from './dashboardTypography';

const CHART_H_BASE = 228;

const Y_AXIS_TICK = { fontSize: 12, fill: '#1A1A1A', fontWeight: 500 };
const X_AXIS_LINE = { stroke: '#BDBDBD' };
const GRID_STROKE = '#E1BEE7';
const FALLBACK_SPRINT_COLOR = '#424242';

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
        : 'Average';

  return (
    <Box sx={{ ...tooltipPaper, border: `1px solid ${sprintColor}66` }}>
      <Typography sx={{ fontWeight: 700, color: sprintColor, display: 'block', fontSize: '0.95rem' }}>
        {row.name}
      </Typography>
      <Typography sx={{ color: sprintColor, display: 'block', mt: 0.5, fontSize: '0.9rem', fontWeight: 700 }}>
        {metricLabel}: {formattedValue}
      </Typography>
      {(metric === 'hours' || metric === 'avgPerTask') ? (
        <Typography sx={{ color: sprintColor, display: 'block', mt: 0.35, fontSize: '0.84rem', fontWeight: 600, opacity: 0.85 }}>
          Open tasks: {pending}
        </Typography>
      ) : null}
    </Box>
  );
}

function SprintCompareBarBlock({
  title,
  description,
  data,
  dataKey,
  valueFormatter,
}) {
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
      <Typography sx={{ fontWeight: 800, color: '#1A1A1A', mb: description ? 0.35 : 1, fontSize: '1.02rem' }}>
        {title}
      </Typography>
      {description ? (
        <Typography sx={{ ...CHART_DESC_SX, mb: 1 }}>{description}</Typography>
      ) : null}
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={data} margin={{ top: 8, right: 10, left: 4, bottom: marginBottom }} barCategoryGap={barCategoryGap}>
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
        return {
          shortLabel: sp.shortLabel,
          name: sp.name,
          accentColor: sp.accentColor,
          completed: done,
          pending,
          hours: Number(Number(sp.totalHours).toFixed(1)),
          avgPerTask: parseFloat(avgHoursPerTask(sp)),
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
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
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
        <SprintCompareBarBlock
          title="Hours worked"
          description="Total hours logged per sprint."
          data={data}
          dataKey="hours"
          valueFormatter={(v) => `${v} h`}
        />
        <SprintCompareBarBlock
          title="Average hours / task"
          description="Average hours spent per completed task (effort per closure)."
          data={data}
          dataKey="avgPerTask"
          valueFormatter={(v) => `${v} hrs/task`}
        />
      </Box>
    </Paper>
  );
}
