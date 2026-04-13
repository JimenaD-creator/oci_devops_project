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

const CHART_H = 220;

/** Stacked segment for tasks still open — distinct from sprint accent colors (completed). */
const PENDING_TASKS_COLOR = '#FB8C00';

const AXIS_TICK = { fontSize: 14, fill: '#1565C0' };
const AXIS_LINE = { stroke: '#64B5F6' };
const GRID_STROKE = '#E1BEE7';

const tooltipPaper = {
  borderRadius: 8,
  border: '1px solid #90CAF9',
  fontSize: 14,
  padding: '10px 12px',
  background: '#fff',
  boxShadow: '0 2px 10px rgba(21,101,192,0.15)',
};

function HoursWithPendingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const hours = row.hours;
  const pending = row.pending ?? 0;
  return (
    <Box sx={tooltipPaper}>
      <Typography sx={{ fontWeight: 700, color: '#1565C0', display: 'block', fontSize: '0.95rem' }}>
        {row.name}
      </Typography>
      <Typography sx={{ color: '#0277BD', display: 'block', mt: 0.5, fontSize: '0.9rem', fontWeight: 600 }}>
        {hours} h logged
      </Typography>
      <Typography sx={{ color: '#E65100', display: 'block', mt: 0.35, fontSize: '0.85rem', fontWeight: 600 }}>
        {pending} task{pending === 1 ? '' : 's'} still open
      </Typography>
    </Box>
  );
}

function AvgWithPendingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const avg = row.avgPerTask;
  const pending = row.pending ?? 0;
  return (
    <Box sx={tooltipPaper}>
      <Typography sx={{ fontWeight: 700, color: '#1565C0', display: 'block', fontSize: '0.95rem' }}>
        {row.name}
      </Typography>
      <Typography sx={{ color: '#2E7D32', display: 'block', mt: 0.5, fontSize: '0.9rem', fontWeight: 600 }}>
        {avg} hrs/task (on completed work)
      </Typography>
      <Typography sx={{ color: '#E65100', display: 'block', mt: 0.35, fontSize: '0.85rem', fontWeight: 600 }}>
        {pending} task{pending === 1 ? '' : 's'} still open in sprint
      </Typography>
    </Box>
  );
}

function SprintCompareBarBlock({
  title,
  subtitle,
  data,
  dataKey,
  valueFormatter,
  stackedPending,
  hoursTooltipPending,
  avgTooltipPending,
}) {
  return (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800, color: '#1A1A1A', mb: 0.35, fontSize: '1.02rem' }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography sx={{ color: '#666', display: 'block', mb: 1, fontSize: '0.92rem', fontWeight: 500 }}>
          {subtitle}
        </Typography>
      ) : null}
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={AXIS_TICK}
            axisLine={AXIS_LINE}
            interval={0}
          />
          <YAxis tick={AXIS_TICK} axisLine={false} width={44} />
          {hoursTooltipPending ? (
            <Tooltip content={<HoursWithPendingTooltip />} />
          ) : avgTooltipPending ? (
            <Tooltip content={<AvgWithPendingTooltip />} />
          ) : (
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #90CAF9', fontSize: 14, padding: '10px 12px' }}
              formatter={(v, name) => {
                if (stackedPending && (name === 'completed' || name === 'Completed')) {
                  return [`${v} done`, 'Completed'];
                }
                if (stackedPending && (name === 'pending' || name === 'Pending')) {
                  return [`${v} open`, 'Pending'];
                }
                return [valueFormatter ? valueFormatter(v) : v, ''];
              }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? ''}
            />
          )}
          {stackedPending ? (
            <>
              <Bar dataKey="completed" name="completed" stackId="tasks" radius={[0, 0, 0, 0]} maxBarSize={48}>
                {data.map((row) => (
                  <Cell key={`${row.shortLabel}-c`} fill={row.accentColor} />
                ))}
              </Bar>
              <Bar
                dataKey="pending"
                name="pending"
                stackId="tasks"
                fill={PENDING_TASKS_COLOR}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </>
          ) : (
            <Bar dataKey={dataKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((row) => (
                <Cell key={row.shortLabel} fill={row.accentColor} />
              ))}
            </Bar>
          )}
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
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(199,70,52,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CompareArrowsIcon sx={{ color: '#C74634', fontSize: 26 }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.12rem' }}>
            Sprint comparison
          </Typography>
          <Typography sx={{ color: '#666', display: 'block', maxWidth: 720, fontSize: '0.95rem', mt: 0.35, fontWeight: 500 }}>
            Stacked tasks show completed vs pending; hours include pending count in the tooltip.
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          gap: { xs: 2.5, md: 2 },
          alignItems: 'stretch',
        }}
      >
        <SprintCompareBarBlock
          title="Tasks: completed vs pending"
          subtitle="Stacked: completed (sprint color) + pending (amber)"
          data={data}
          dataKey="completed"
          valueFormatter={(v) => `${v} tasks`}
          stackedPending
        />
        <SprintCompareBarBlock
          title="Hours worked"
          subtitle="Total hours worked per sprint"
          data={data}
          dataKey="hours"
          valueFormatter={(v) => `${v} h`}
          hoursTooltipPending
        />
        <SprintCompareBarBlock
          title="Average hours / task"
          subtitle="Total hours / completed tasks"
          data={data}
          dataKey="avgPerTask"
          valueFormatter={(v) => `${v} hrs/task`}
          avgTooltipPending
        />
      </Box>
    </Paper>
  );
}
