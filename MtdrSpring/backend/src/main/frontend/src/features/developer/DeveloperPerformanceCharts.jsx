import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
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
  LabelList,
} from 'recharts';
import { PRODUCTIVITY_SCORE_TREND } from '../dashboard/constants/dashboardChartConstants';
import { formatProductivityScoreDisplay } from '../kpis/productivityScoreUtils';

const CHART_H = 260;
const LINE_FALLBACK = '#3949AB';
const SCORE_LINE = PRODUCTIVITY_SCORE_TREND;

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
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color }}>{label}</Typography>
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

function ProductivityScoreTooltip({ active, payload }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const score = Number(row.productivityScore) || 0;
  const color = row.color || SCORE_LINE;
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
        bgcolor: isDark ? '#1C1E22' : '#fff',
        p: 1.25,
        boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
        minWidth: 200,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color }}>{row.name}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: 'text.primary', mt: 0.5 }}>
        Productivity score: {formatProductivityScoreDisplay(score)}
      </Typography>
      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5, lineHeight: 1.45 }}>
        Completion {row.completionRate}%
        {typeof row.onTime === 'number' ? ` · On-time ${row.onTime}%` : ''}
        {typeof row.participation === 'number' ? ` · Participation ${row.participation}%` : ''}
        {typeof row.workload === 'number' ? ` · Workload ${row.workload}%` : ''}
      </Typography>
      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>
        {row.completed} of {row.assigned} tasks · {Number(row.hours || 0).toFixed(1)} h logged
        {Number(row.estimated) > 0 ? ` · ${Number(row.estimated).toFixed(1)} h estimated` : ''}
      </Typography>
    </Box>
  );
}

function ProductivityCompareTooltip({ active, payload, label, series = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const entries = (series || [])
    .map((s) => {
      const score = row[s.dataKey];
      if (score == null || !Number.isFinite(Number(score))) return null;
      const meta = row._meta?.[s.dataKey];
      return { ...s, score: Number(score), meta };
    })
    .filter(Boolean)
    .sort((a, b) => (a.isCurrentUser ? -1 : 0) - (b.isCurrentUser ? -1 : 0) || b.score - a.score);

  if (!entries.length) return null;

  const panelBg = isDark ? '#1C1E22' : '#FFFFFF';

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${isDark ? '#3A3C42' : '#D0D0D0'}`,
        bgcolor: panelBg,
        backgroundColor: panelBg,
        opacity: 1,
        p: 1.25,
        boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.55)' : '0 4px 16px rgba(0,0,0,0.14)',
        minWidth: 220,
        maxWidth: 320,
        pointerEvents: 'none',
      }}
    >
      <Typography
        sx={{ fontWeight: 700, fontSize: '0.875rem', color: row.color || SCORE_LINE, mb: 1 }}
      >
        {label}
      </Typography>
      {entries.map((e) => (
        <Box key={e.dataKey} sx={{ mb: entries.length > 1 ? 0.75 : 0 }}>
          <Typography
            sx={{ fontWeight: e.isCurrentUser ? 800 : 600, fontSize: '0.85rem', color: e.color }}
          >
            {e.name}
            {e.isCurrentUser ? ' (you)' : ''}: {formatProductivityScoreDisplay(e.score)}
          </Typography>
          {e.meta ? (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
              Completion {e.meta.completionRate}%
              {typeof e.meta.onTime === 'number' ? ` · On-time ${e.meta.onTime}%` : ''}
              {typeof e.meta.participation === 'number'
                ? ` · Participation ${e.meta.participation}%`
                : ''}
              {typeof e.meta.workload === 'number' ? ` · Workload ${e.meta.workload}%` : ''}
            </Typography>
          ) : null}
          {e.meta ? (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
              {e.meta.completed} of {e.meta.assigned} tasks · {Number(e.meta.hours || 0).toFixed(1)}{' '}
              h
              {Number(e.meta.estimated) > 0
                ? ` / ${Number(e.meta.estimated).toFixed(1)} h est.`
                : ''}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

function compareLineStroke(s, isDark) {
  if (s.isCurrentUser) {
    return { color: s.color, opacity: 1, width: 4 };
  }
  return {
    color: alpha(s.color, isDark ? 0.58 : 0.55),
    opacity: isDark ? 0.78 : 0.72,
    width: 2,
  };
}

/** Teammate lines first; signed-in developer last so their line draws on top. */
function compareSeriesRenderOrder(series) {
  return [...series].sort((a, b) => {
    if (a.isCurrentUser === b.isCurrentUser) return 0;
    return a.isCurrentUser ? 1 : -1;
  });
}

function CompareLineDot({ cx, cy, payload, seriesItem, isDark }) {
  if (cx == null || cy == null || payload == null || !Number.isFinite(payload)) return null;
  const { color, opacity, width } = compareLineStroke(seriesItem, isDark);
  if (seriesItem.isCurrentUser) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke={isDark ? '#1C1E22' : '#FFFFFF'}
        strokeWidth={2}
        style={{ opacity }}
      />
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill={color} stroke="none" style={{ opacity }} />;
}

/** Recharts wraps custom tooltip content in a semi-transparent box — strip that layer. */
const PRODUCTIVITY_COMPARE_TOOLTIP_PROPS = {
  wrapperStyle: { opacity: 1, zIndex: 20, outline: 'none' },
  contentStyle: {
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: 0,
    opacity: 1,
  },
  cursor: { stroke: 'rgba(0,0,0,0.12)', strokeWidth: 1 },
  isAnimationActive: false,
};

/** Developer line legend — rendered below the chart so it does not overlap the Sprint axis label. */
function ProductivityCompareLegend({ series = [], isDark = false, compact = false }) {
  if (!series.length) return null;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: compact ? { xs: 0.65, sm: 1 } : { xs: 1.25, sm: 2 },
        pt: compact ? 0.75 : 1.5,
        pb: compact ? 0.15 : 0.5,
        px: 0.5,
        flexShrink: 0,
        borderTop: (theme) => `1px solid ${theme.palette.mode === 'dark' ? '#2A2C32' : '#ECECEC'}`,
      }}
    >
      {series.map((s) => {
        const stroke = compareLineStroke(s, isDark);
        return (
          <Box
            key={s.dataKey}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              maxWidth: compact ? 'calc(50% - 6px)' : '100%',
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: s.isCurrentUser ? 22 : 18,
                height: s.isCurrentUser ? 4 : 3,
                borderRadius: 1,
                bgcolor: stroke.color,
                opacity: stroke.opacity,
                flexShrink: 0,
              }}
            />
            <Typography
              noWrap
              sx={{
                fontSize: compact ? '0.68rem' : '0.75rem',
                fontWeight: s.isCurrentUser ? 800 : compact ? 600 : 500,
                color: compact
                  ? isDark
                    ? '#F5F5F5'
                    : '#1A1A1A'
                  : s.isCurrentUser
                    ? 'text.primary'
                    : 'text.secondary',
                opacity: 1,
                lineHeight: 1.2,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.name}
              {s.isCurrentUser ? ' (you)' : ''}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

/** Multi-line productivity score chart body (no outer shell) for dashboard embed. */
export function ProductivityScoreCompareChartEmbed({
  data = [],
  series = [],
  chartHeight = 200,
  /** Fill parent ChartShell height; legend stays inside the same box. */
  fillParent = false,
  legendCompact = false,
  emptyMessage = 'No developer activity in the selected sprints.',
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridStroke = isDark ? '#2A2C32' : '#E8E8E8';
  const tickFill = theme.palette.text.primary;

  if (!data.length || !series.length) {
    return (
      <Typography sx={{ py: 3, textAlign: 'center', color: 'text.secondary', fontSize: '0.82rem' }}>
        {emptyMessage}
      </Typography>
    );
  }

  const chartAreaSx = fillParent
    ? { flex: '1 1 0', minHeight: 120, width: '100%', minWidth: 0 }
    : { width: '100%', height: chartHeight, minHeight: chartHeight };

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        height: fillParent ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Box sx={{ ...chartAreaSx, position: 'relative', zIndex: 1, overflow: 'visible' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 28, right: 12, left: 68, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: tickFill }}
              angle={-32}
              textAnchor="end"
              height={44}
              tickMargin={6}
              label={{
                value: 'Sprint',
                position: 'bottom',
                offset: 4,
                fill: tickFill,
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 20, 40, 60, 80, 100]}
              tick={{ fontSize: 10, fill: tickFill }}
              width={40}
              tickMargin={4}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: 'Score',
                angle: -90,
                position: 'left',
                offset: 8,
                fill: SCORE_LINE,
                fontSize: 11,
                fontWeight: 700,
                style: { textAnchor: 'middle' },
              }}
            />
            <Tooltip
              {...PRODUCTIVITY_COMPARE_TOOLTIP_PROPS}
              content={<ProductivityCompareTooltip series={series} />}
            />
            {compareSeriesRenderOrder(series).map((s) => {
              const stroke = compareLineStroke(s, isDark);
              return (
                <Line
                  key={s.dataKey}
                  type="monotone"
                  dataKey={s.dataKey}
                  name={s.name}
                  stroke={stroke.color}
                  strokeWidth={stroke.width}
                  strokeOpacity={stroke.opacity}
                  connectNulls={false}
                  dot={(dotProps) => {
                    const val = dotProps.payload?.[s.dataKey];
                    if (!Number.isFinite(Number(val))) return null;
                    return (
                      <CompareLineDot
                        cx={dotProps.cx}
                        cy={dotProps.cy}
                        payload={val}
                        seriesItem={s}
                        isDark={isDark}
                      />
                    );
                  }}
                  activeDot={{ r: 5, stroke: stroke.color, fill: stroke.color, strokeWidth: 2 }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <ProductivityCompareLegend series={series} isDark={isDark} compact={legendCompact} />
    </Box>
  );
}

export function ProductivityScoreTrendChart({ data = [], series = null, compareMode = false }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridStroke = isDark ? '#2A2C32' : '#E8E8E8';
  const tickFill = theme.palette.text.primary;

  const isCompare = compareMode && Array.isArray(series) && series.length > 0;

  if (!data.length) {
    return (
      <ChartShell
        title={isCompare ? 'Productivity score comparison' : 'Your productivity score trend'}
        description={
          isCompare
            ? 'Your score vs teammates across sprints (same formula as KPI Analytics).'
            : 'Weighted KPI per sprint (completion, on-time, participation, workload).'
        }
      >
        <Typography
          sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: '0.875rem' }}
        >
          No sprint activity yet. Complete tasks in a sprint to see your score trend.
        </Typography>
      </ChartShell>
    );
  }

  return (
    <ChartShell
      title={isCompare ? 'Productivity score comparison' : 'Your productivity score trend'}
      description={
        isCompare
          ? 'Your line in Oracle red (bold); teammates in lighter colors. Hover a sprint to compare scores.'
          : 'Weighted KPI per sprint (completion, on-time, participation, workload).'
      }
    >
      <Box sx={{ width: '100%' }}>
        <Box sx={{ width: '100%', height: CHART_H }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 28, right: 16, left: 72, bottom: isCompare ? 58 : 52 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: tickFill }}
                angle={-32}
                textAnchor="end"
                height={48}
                tickMargin={8}
                label={{
                  value: 'Sprint',
                  position: 'bottom',
                  offset: isCompare ? 4 : 12,
                  fill: tickFill,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fontSize: 11, fill: tickFill }}
                width={44}
                tickMargin={6}
                tickFormatter={(v) => `${v}%`}
                label={{
                  value: 'Productivity score',
                  angle: -90,
                  position: 'left',
                  offset: 12,
                  fill: SCORE_LINE,
                  fontSize: 12,
                  fontWeight: 700,
                  style: { textAnchor: 'middle' },
                }}
              />
              {isCompare ? (
                <>
                  <Tooltip
                    {...PRODUCTIVITY_COMPARE_TOOLTIP_PROPS}
                    content={<ProductivityCompareTooltip series={series} />}
                  />
                  {compareSeriesRenderOrder(series).map((s) => {
                    const stroke = compareLineStroke(s, isDark);
                    return (
                      <Line
                        key={s.dataKey}
                        type="monotone"
                        dataKey={s.dataKey}
                        name={s.name}
                        stroke={stroke.color}
                        strokeWidth={stroke.width}
                        strokeOpacity={stroke.opacity}
                        connectNulls={false}
                        dot={(dotProps) => {
                          const val = dotProps.payload?.[s.dataKey];
                          if (!Number.isFinite(Number(val))) return null;
                          return (
                            <CompareLineDot
                              cx={dotProps.cx}
                              cy={dotProps.cy}
                              payload={val}
                              seriesItem={s}
                              isDark={isDark}
                            />
                          );
                        }}
                        activeDot={
                          s.isCurrentUser
                            ? { r: 8, stroke: stroke.color, fill: stroke.color, strokeWidth: 2 }
                            : { r: 4, stroke: stroke.color, fill: stroke.color, strokeOpacity: 0.6 }
                        }
                      />
                    );
                  })}
                </>
              ) : (
                <>
                  <Tooltip content={<ProductivityScoreTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="productivityScore"
                    stroke={SCORE_LINE}
                    strokeWidth={3}
                    dot={<ColoredDot />}
                    activeDot={{ r: 7, fill: SCORE_LINE, stroke: SCORE_LINE }}
                  >
                    <LabelList
                      dataKey="productivityScore"
                      position="top"
                      fill={SCORE_LINE}
                      fontSize={11}
                      fontWeight={800}
                      formatter={(v) => formatProductivityScoreDisplay(v)}
                    />
                  </Line>
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </Box>
        {isCompare ? <ProductivityCompareLegend series={series} isDark={isDark} /> : null}
      </Box>
    </ChartShell>
  );
}

export function HoursWorkedTrendChart({ data = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gridStroke = isDark ? '#2A2C32' : '#E8E8E8';
  const tickFill = theme.palette.text.primary;
  const lineStroke = data[0]?.color || LINE_FALLBACK;

  return (
    <ChartShell title="Hours worked trend" description="Total hours you logged across sprints.">
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
