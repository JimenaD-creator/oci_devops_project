import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const CHART_H = 260;
const LINE_FALLBACK = '#3949AB';

function ChartTooltip({ active, payload, label, valueLabel }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const color = row.color || LINE_FALLBACK;
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
        bgcolor: isDark ? '#1C1E22' : '#fff',
        p: 1.25,
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'text.primary', mt: 0.5 }}>
        {valueLabel}: {payload[0].value}
      </Typography>
    </Box>
  );
}

function ChartShell({ title, description, children }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
        bgcolor: 'background.paper',
        height: '100%',
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
        {description}
      </Typography>
      {children}
    </Paper>
  );
}

export function CompletedTasksBySprintChart({ data = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridStroke = isDark ? '#2A2C32' : '#E8E8E8';
  const tickFill = theme.palette.text.primary;

  return (
    <ChartShell
      title="Completed tasks by sprint"
      description="Number of your assignments marked complete in each sprint."
    >
      <Box sx={{ width: '100%', height: CHART_H }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: tickFill }}
              angle={-32}
              textAnchor="end"
              height={56}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickFill }} />
            <Tooltip content={<ChartTooltip valueLabel="Completed" />} />
            <Bar dataKey="completed" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color || LINE_FALLBACK} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </ChartShell>
  );
}

function ColoredDot({ cx, cy, payload }) {
  if (cx == null || cy == null) return null;
  const fill = payload?.color || LINE_FALLBACK;
  return <circle cx={cx} cy={cy} r={5} fill={fill} stroke={fill} strokeWidth={0} />;
}

export function HoursWorkedTrendChart({ data = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridStroke = isDark ? '#2A2C32' : '#E8E8E8';
  const tickFill = theme.palette.text.primary;
  const lineStroke = data[0]?.color || LINE_FALLBACK;

  return (
    <ChartShell
      title="Hours worked trend"
      description="Total hours you logged across sprints."
    >
      <Box sx={{ width: '100%', height: CHART_H }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: tickFill }}
              angle={-32}
              textAnchor="end"
              height={56}
            />
            <YAxis tick={{ fontSize: 11, fill: tickFill }} />
            <Tooltip content={<ChartTooltip valueLabel="Hours" />} />
            <Line
              type="monotone"
              dataKey="hours"
              stroke={lineStroke}
              strokeWidth={3}
              dot={<ColoredDot />}
              activeDot={{ r: 7, fill: lineStroke, stroke: lineStroke }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </ChartShell>
  );
}
