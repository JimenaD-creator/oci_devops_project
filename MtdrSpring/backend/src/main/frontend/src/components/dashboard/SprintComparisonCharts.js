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

const tooltipPaper = {
  borderRadius: 8,
  border: '1px solid #EEE',
  fontSize: 12,
  padding: '8px 10px',
  background: '#fff',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
};

function HoursWithPendingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const hours = row.hours;
  const pending = row.pending ?? 0;
  return (
    <Box sx={tooltipPaper}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1A1A1A', display: 'block' }}>
        {row.name}
      </Typography>
      <Typography variant="caption" sx={{ color: '#555', display: 'block', mt: 0.5 }}>
        {hours} h logged
      </Typography>
      <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.25 }}>
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
      <Typography variant="caption" sx={{ fontWeight: 700, color: '#1A1A1A', display: 'block' }}>
        {row.name}
      </Typography>
      <Typography variant="caption" sx={{ color: '#555', display: 'block', mt: 0.5 }}>
        {avg} hrs/task (on completed work)
      </Typography>
      <Typography variant="caption" sx={{ color: '#888', display: 'block', mt: 0.25 }}>
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
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1A1A1A', mb: 0.25 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
          {subtitle}
        </Typography>
      ) : null}
      <ResponsiveContainer width="100%" height={CHART_H}>
        <BarChart data={data} margin={{ top: 6, right: 8, left: -8, bottom: 4 }} barCategoryGap="18%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
          <XAxis
            dataKey="shortLabel"
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#E0E0E0' }}
            interval={0}
          />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} width={40} />
          {hoursTooltipPending ? (
            <Tooltip content={<HoursWithPendingTooltip />} />
          ) : avgTooltipPending ? (
            <Tooltip content={<AvgWithPendingTooltip />} />
          ) : (
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }}
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
              <Bar dataKey="pending" name="pending" stackId="tasks" fill="#BDBDBD" radius={[4, 4, 0, 0]} maxBarSize={48} />
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
          <CompareArrowsIcon sx={{ color: '#C74634', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
            Sprint comparison
          </Typography>
          <Typography variant="caption" sx={{ color: '#888', display: 'block', maxWidth: 720 }}>
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
          subtitle="Stacked: done (color) + still open (gray)"
          data={data}
          dataKey="completed"
          valueFormatter={(v) => `${v} tasks`}
          stackedPending
        />
        <SprintCompareBarBlock
          title="Hours worked"
          subtitle="Total hours logged per sprint (tooltip shows open tasks)"
          data={data}
          dataKey="hours"
          valueFormatter={(v) => `${v} h`}
          hoursTooltipPending
        />
        <SprintCompareBarBlock
          title="Average hours / task"
          subtitle="Total hours ÷ completed tasks (tooltip shows open tasks)"
          data={data}
          dataKey="avgPerTask"
          valueFormatter={(v) => `${v} hrs/task`}
          avgTooltipPending
        />
      </Box>
    </Paper>
  );
}
