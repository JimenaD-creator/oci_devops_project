import React, { useMemo, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Box, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  LabelList,
} from 'recharts';
import {
  CHART_TICK,
  CHART_AXIS_LABEL,
  CHART_TOOLTIP_SX,
  CHART_LEGEND_STYLE,
  CHART_LEGEND_ITEM_SX,
  CHART_TITLE_SX,
  CHART_DESC_SX,
  RECHARTS_BAR_TOOLTIP_PROPS,
} from './dashboardTypography';
import {
  buildCompareDeveloperChartsModel,
  buildTeamProductivityTrendSeries,
  sprintDbIdSortKey,
} from './dashboardSprintData';
import { DASHBOARD_SCROLL_VIEWPORT } from './ScrollReveal';
import {
  CHART_DESC,
  COMPLETED_FILL,
  HOURS_FILL,
  HOURS_LINE,
  HOURS_ASSIGNED,
  HOURS_ASSIGNED_LABEL,
  STACK_DONE,
  STACK_PENDING,
  GRID,
  CHART_BAR_ANIM_MS,
  CHART_BAR_EASING,
  Y_AXIS_HOURS,
  PRODUCTIVITY_SCORE_TREND,
} from './constants/dashboardChartConstants';
import {
  maxCompareWorkloadStack,
  maxSingleWorkloadStack,
  buildTaskAxisDomainTicks,
  buildCompareTaskAxisDomainTicks,
  maxSingleHoursGrouped,
  maxCompareHoursGrouped,
  buildHoursAxisDomainTicks,
  buildCompareHoursAxisDomainTicks,
  maxSingleComboRange,
  comboHeightExtraFromRange,
  compareChartHeights,
  buildProductivityScoreAxisDomainTicks,
} from './utils/chartUtils';
const MotionPaper = motion(Paper);

function HorizontalBarEndLabel({
  x,
  y,
  width,
  height,
  value,
  fill = '#1A1A1A',
  formatter = (v) => String(v ?? ''),
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const textColor = isDark ? '#F0F0F0' : fill;
  
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return (
    <text
      x={Number(x) + Number(width) + 6}
      y={Number(y) + Number(height) / 2}
      fill={textColor}
      fontSize={11}
      fontWeight={700}
      dominantBaseline="middle"
      textAnchor="start"
    >
      {formatter(n)}
    </text>
  );
}

function HoursValueLabel(props) {
  const { x, y, width, height, value, fill, withHoursSuffix = true } = props || {};
  return (
    <HorizontalBarEndLabel
      x={x}
      y={y}
      width={width}
      height={height}
      value={value}
      fill={fill || '#1A1A1A'}
      formatter={(v) => (withHoursSuffix ? `${Number(v).toFixed(1)}h` : `${Number(v).toFixed(1)}`)}
    />
  );
}

function resolveLabelRow(value, index, rows) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (Array.isArray(rows) && Number.isFinite(Number(index))) return rows[Number(index)] ?? null;
  return null;
}

/** Barra apilada con esquinas superiores redondeadas (como horas) cuando es el tope del stack. */
function CompareWorkloadStackBarShape({ x, y, width, height, fill, roundTop = false, topRadius = 6 }) {
  const px = Number(x);
  const py = Number(y);
  const pw = Number(width);
  const ph = Number(height);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pw) || !Number.isFinite(ph) || ph <= 0) {
    return null;
  }
  const r = roundTop ? Math.min(topRadius, pw / 2, ph) : 0;
  if (r <= 0) {
    return <rect x={px} y={py} width={pw} height={ph} fill={fill} />;
  }
  const right = px + pw;
  const bottom = py + ph;
  const d = [
    `M ${px} ${py + r}`,
    `Q ${px} ${py} ${px + r} ${py}`,
    `L ${right - r} ${py}`,
    `Q ${right} ${py} ${right} ${py + r}`,
    `L ${right} ${bottom}`,
    `L ${px} ${bottom}`,
    'Z',
  ].join(' ');
  return <path d={d} fill={fill} />;
}

function SingleWorkloadCompletedOutsideLabel(props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const {
    x,
    y,
    width,
    height,
    value,
    index,
    segment = 'pending',
    fill = '#3949AB',
    rows,
  } = props || {};
  const row = resolveLabelRow(value, index, rows);
  const pending = Number(row?.pending ?? 0);
  const completed = Number(
    row?.completed ?? (typeof value === 'number' || typeof value === 'string' ? value : 0) ?? 0,
  );
  if (!Number.isFinite(completed) || completed < 0) return null;
  const onPending = pending > 0;
  if ((onPending && segment !== 'pending') || (!onPending && segment !== 'completed')) return null;
  return (
    <text
      x={Number(x) + Number(width) + 10}
      y={Number(y) + Number(height) / 2}
      fill={isDark ? '#F0F0F0' : fill}
      fontSize={14}
      fontWeight={800}
      dominantBaseline="middle"
      textAnchor="start"
      stroke={isDark ? '#1C1E22' : '#fff'}
      strokeWidth={2}
      paintOrder="stroke"
    >
      {Math.round(completed)}
    </text>
  );
}

function CompareWorkloadCompletedOutsideLabel(props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const {
    x,
    y,
    width,
    height,
    value,
    index,
    sprintId,
    segment = 'pending',
    fill = '#3949AB',
    rows,
  } = props || {};
  const row = resolveLabelRow(value, index, rows);
  const pending = Number(row?.[`wo_${sprintId}`] ?? 0);
  const completed = Number(
    row?.[`wc_${sprintId}`] ??
      (typeof value === 'number' || typeof value === 'string' ? value : 0) ??
      0,
  );
  if (!Number.isFinite(completed) || completed < 0) return null;
  if (x == null || y == null || width == null) return null;
  const onPending = pending > 0;
  if ((onPending && segment !== 'pending') || (!onPending && segment !== 'completed')) return null;
  const px = Number(x);
  const py = Number(y);
  const pw = Number(width);
  const barHeight = Number(height) || 0;
  const centerX = px + pw / 2;
  const labelY =
    barHeight > 0
      ? Math.max(10, py - Math.max(14, 12 + Math.min(8, barHeight)))
      : Math.max(10, py - 14);
  return (
    <text
      x={centerX}
      y={labelY}
      fill={isDark ? '#F0F0F0' : fill}
      fontSize={14}
      fontWeight={800}
      dominantBaseline="middle"
      textAnchor="middle"
      stroke={isDark ? '#1C1E22' : '#fff'}
      strokeWidth={2}
      paintOrder="stroke"
    >
      {Math.round(completed)}
    </text>
  );
}

// ---------------------------------------------------------------------------
// Tooltips de comparación
// ---------------------------------------------------------------------------

function CompareWorkloadTooltip({ active, payload, sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX(isDark),
        p: { xs: 1.75, sm: 2.25 },
        px: { xs: 2, sm: 2.5 },
        bgcolor: 'background.paper',
        border: `1px solid ${isDark ? '#2A2C32' : '#B0BEC5'}`,
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 220,
        boxSizing: 'border-box',
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          color: 'text.primary',
          fontSize: '0.95rem',
          lineHeight: 1.35,
          mb: 1.25,
          pr: 0.5,
        }}
      >
        {row.name}
      </Typography>
      {sprintDefs.map((sp, idx) => {
        const completed = Number(row[`wc_${sp.id}`]) || 0;
        const pending = Number(row[`wo_${sp.id}`]) || 0;
        const assigned = completed + pending;
        return (
          <Box
            key={sp.id}
            sx={{
              mt: idx === 0 ? 0 : 0.75,
              pt: idx === 0 ? 0 : 1.35,
              pb: idx === sprintDefs.length - 1 ? 0 : 0.25,
              borderTop: idx === 0 ? 'none' : `1px solid ${isDark ? '#2A2C32' : '#ECEFF1'}`,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: sp.accentColor, fontSize: '0.88rem', mb: 0.5 }}>
              {sp.shortLabel}
            </Typography>
            <Typography
              sx={{
                color: isDark ? '#9A9A9A' : sp.accentColor,
                fontSize: '0.84rem',
                lineHeight: 1.45,
                fontWeight: 600,
                pr: 0.25,
              }}
            >
              Completed: {completed} · Pending: {pending} · Assigned: {assigned}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function CompareHoursTooltip({ active, payload, sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX(isDark),
        p: { xs: 1.75, sm: 2.25 },
        px: { xs: 2, sm: 2.5 },
        bgcolor: 'background.paper',
        border: `1px solid ${isDark ? '#2A2C32' : '#B0BEC5'}`,
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 220,
        boxSizing: 'border-box',
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          color: 'text.primary',
          fontSize: '0.95rem',
          lineHeight: 1.35,
          mb: 1.25,
          pr: 0.5,
        }}
      >
        {row.name}
      </Typography>
      {sprintDefs.map((sp, idx) => {
        const worked = Number(row[`hw_${sp.id}`]) || 0;
        return (
          <Box
            key={sp.id}
            sx={{
              mt: idx === 0 ? 0 : 0.75,
              pt: idx === 0 ? 0 : 1.35,
              pb: idx === sprintDefs.length - 1 ? 0 : 0.25,
              borderTop: idx === 0 ? 'none' : `1px solid ${isDark ? '#2A2C32' : '#ECEFF1'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: sp.accentColor, fontSize: '0.88rem' }}>
              {sp.shortLabel}
            </Typography>
            <Typography
              sx={{ color: 'text.secondary', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.45, pr: 0.25 }}
            >
              Hours worked: {worked.toFixed(1)} h
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function TeamProductivityTrendTooltip({ active, payload }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const score = Number(row.productivityScore) || 0;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX(isDark),
        p: { xs: 1.75, sm: 2 },
        px: { xs: 2, sm: 2.25 },
        bgcolor: 'background.paper',
        border: `1px solid ${isDark ? '#2A2C32' : '#B0BEC5'}`,
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 220,
      }}
    >
      <Typography sx={{ fontWeight: 800, color: row.accentColor || PRODUCTIVITY_SCORE_TREND, fontSize: '0.9rem', mb: 0.75 }}>
        {row.sprintLabel}
      </Typography>
      <Typography sx={{ color: 'text.primary', fontSize: '0.95rem', fontWeight: 800, mb: 0.75 }}>
        Productivity score: {score}%
      </Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', lineHeight: 1.45 }}>
        Completion {row.completionRate}% · On-time {row.onTimeDelivery}% · Participation{' '}
        {row.teamParticipation}% · Workload balance {row.workloadBalance}%
      </Typography>
      {row.totalTasks > 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 0.5, lineHeight: 1.4 }}>
          {row.totalCompleted} of {row.totalTasks} tasks completed in sprint
        </Typography>
      ) : null}
    </Box>
  );
}

function CompareComboTooltip({ active, payload, sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX(isDark),
        p: { xs: 1.75, sm: 2.25 },
        px: { xs: 2, sm: 2.5 },
        bgcolor: 'background.paper',
        border: `1px solid ${isDark ? '#2A2C32' : '#B0BEC5'}`,
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 220,
        boxSizing: 'border-box',
      }}
    >
      <Typography
        sx={{
          fontWeight: 800,
          color: 'text.primary',
          fontSize: '0.95rem',
          lineHeight: 1.35,
          mb: 1.25,
          pr: 0.5,
        }}
      >
        {row.name}
      </Typography>
      {sprintDefs.map((sp, idx) => {
        const tasks = Number(row[`cb_${sp.id}`]) || 0;
        const hours = Number(row[`ln_${sp.id}`]) || 0;
        return (
          <Box
            key={sp.id}
            sx={{
              mt: idx === 0 ? 0 : 0.75,
              pt: idx === 0 ? 0 : 1.35,
              pb: idx === sprintDefs.length - 1 ? 0 : 0.25,
              borderTop: idx === 0 ? 'none' : `1px solid ${isDark ? '#2A2C32' : '#ECEFF1'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: sp.accentColor, fontSize: '0.88rem' }}>
              {sp.shortLabel}
            </Typography>
            <Typography
              sx={{ color: 'text.secondary', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.45, pr: 0.25 }}
            >
              Completed tasks: {tasks} · Hours worked: {hours.toFixed(1)} h
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Leyendas
// ---------------------------------------------------------------------------

function CompareHoursBarLegend({ sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const multiSprint = (sprintDefs?.length ?? 0) > 1;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        pb: 0.25,
      }}
    >
      {!multiSprint ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: { xs: 1.25, sm: 2 },
            rowGap: 0.75,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              component="span"
              sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_FILL, flexShrink: 0 }}
            />
            <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary' }}>Hours worked</Typography>
          </Box>
        </Box>
      ) : null}
      <CompareSprintLegend sprintDefs={sprintDefs} />
    </Box>
  );
}

function CompareSprintLegend({ sprintDefs, dense, manySprints }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const n = sprintDefs?.length ?? 0;
  const squeeze = Boolean(manySprints) || (dense && n >= 6);
  const chip = squeeze ? 14 : 16;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: squeeze ? { xs: 0.5, sm: 0.75 } : dense ? { xs: 0.75, sm: 1.25 } : { xs: 1.25, sm: 2 },
        flexWrap: 'wrap',
        pb: dense ? 0 : 1,
        pt: dense ? 0 : 0.5,
        rowGap: squeeze ? 0.5 : dense ? 0.5 : 1,
      }}
    >
      {sprintDefs.map((sp) => (
        <Box key={sp.id} sx={{ display: 'flex', alignItems: 'center', gap: squeeze ? 0.5 : 0.75 }}>
          <Box
            component="span"
            sx={{
              width: chip,
              height: chip,
              borderRadius: 0.5,
              bgcolor: sp.accentColor,
              flexShrink: 0,
            }}
          />
          <Typography
            component="span"
            sx={{
              ...CHART_LEGEND_ITEM_SX,
              color: 'text.primary',
              fontSize: squeeze
                ? { xs: '0.6875rem', sm: '0.75rem' }
                : dense
                  ? { xs: '0.75rem', sm: '0.8125rem' }
                  : undefined,
              lineHeight: 1.25,
            }}
          >
            {sp.shortLabel}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function CompareWorkloadSymbolLegend({ sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const n = sprintDefs?.length ?? 0;
  const c = sprintDefs[0]?.accentColor ?? '#3949AB';
  const pendingTint = alpha(c, isDark ? 0.35 : 0.42);
  const donePendingFont = { xs: '0.75rem', sm: '0.8125rem' };
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        pt: 0,
        pb: 0.25,
        px: { xs: 0.5, sm: 1 },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 0.75,
          rowGap: 0.25,
          mt: { xs: 0.35, sm: 0.5 },
          width: '100%',
          maxWidth: 520,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            component="span"
            sx={{
              width: 14,
              height: 14,
              borderRadius: 0.5,
              bgcolor: c,
              flexShrink: 0,
              boxShadow: `0 0 0 1px ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}
          />
          <Typography
            sx={{
              ...CHART_LEGEND_ITEM_SX,
              color: 'text.primary',
              fontWeight: 700,
              fontSize: donePendingFont,
            }}
          >
            Completed (solid)
          </Typography>
        </Box>
        <Typography
          sx={{ color: isDark ? '#2A2C32' : '#B0BEC5', fontWeight: 700, fontSize: { xs: '0.7rem', sm: '0.75rem' } }}
        >
          ·
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            component="span"
            sx={{
              width: 14,
              height: 14,
              borderRadius: 0.5,
              bgcolor: pendingTint,
              flexShrink: 0,
              boxShadow: `0 0 0 1px ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
            }}
          />
          <Typography
            sx={{
              ...CHART_LEGEND_ITEM_SX,
              color: 'text.primary',
              fontWeight: 700,
              fontSize: donePendingFont,
            }}
          >
            Pending (lighter)
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mt: { xs: 0.45, sm: 0.55 }, '& .MuiTypography-root': { lineHeight: 1.2 } }}>
        <CompareSprintLegend sprintDefs={sprintDefs} dense manySprints={n >= 6} />
      </Box>
    </Box>
  );
}

function CompareComboLegend({ sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const n = sprintDefs?.length ?? 0;
  const splitRows = n >= 5;
  const many = n >= 6;
  const labelSize = many ? { xs: '0.6875rem', sm: '0.75rem' } : { xs: '0.75rem', sm: '0.8125rem' };

  const seriesKeys = (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: { xs: many ? 1 : 1.25, sm: many ? 1.25 : 2 },
        rowGap: 0.75,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65 }}>
        <Box
          component="span"
          sx={{
            width: many ? 18 : 20,
            height: many ? 10 : 11,
            borderRadius: 0.75,
            bgcolor: COMPLETED_FILL,
            flexShrink: 0,
            boxShadow: `0 0 0 1px ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
          }}
        />
        <Typography
          sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary', fontWeight: 700, fontSize: labelSize }}
        >
          Bars = completed tasks (left)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65 }}>
        <Box sx={{ position: 'relative', width: many ? 26 : 28, height: 12, flexShrink: 0 }}>
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 3,
              mt: '-1.5px',
              borderRadius: 1,
              bgcolor: HOURS_LINE,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              right: 0,
              top: '50%',
              width: many ? 7 : 8,
              height: many ? 7 : 8,
              mt: many ? '-3.5px' : '-4px',
              borderRadius: '50%',
              bgcolor: HOURS_LINE,
            }}
          />
        </Box>
        <Typography
          sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary', fontWeight: 700, fontSize: labelSize }}
        >
          Line = hours (right)
        </Typography>
      </Box>
    </Box>
  );

  const dividerSm = (
    <Box
      sx={{
        display: { xs: 'none', sm: 'block' },
        width: 1,
        height: 22,
        bgcolor: isDark ? '#2A2C32' : '#DCE3EA',
        flexShrink: 0,
        alignSelf: 'center',
      }}
    />
  );

  const sprintStrip = <CompareSprintLegend sprintDefs={sprintDefs} dense manySprints={many} />;

  if (splitRows) {
    return (
      <Box
        sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 1.25 } }}
      >
        {seriesKeys}
        <Box
          sx={{
            width: '100%',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.1)'}`,
            pt: { xs: 1, sm: 1.25 },
          }}
        >
          {sprintStrip}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: { xs: 1.25, sm: 2 },
        rowGap: 0.75,
      }}
    >
      {seriesKeys}
      {dividerSm}
      <Typography
        sx={{
          display: { xs: 'inline', sm: 'none' },
          color: isDark ? '#2A2C32' : '#B0BEC5',
          fontWeight: 800,
          lineHeight: 1,
          px: 0.25,
        }}
      >
        ·
      </Typography>
      {sprintStrip}
    </Box>
  );
}

function SingleWorkloadSymbolLegend({ completedFill = STACK_DONE, pendingFill = STACK_PENDING }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 3, pb: 1, pt: 0.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: completedFill, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary' }}>Completed tasks</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: pendingFill, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary' }}>Pending tasks</Typography>
      </Box>
    </Box>
  );
}

function SingleHoursSymbolLegend() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: { xs: 2, sm: 3 },
        pb: 1,
        pt: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_FILL, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary' }}>
          Hours worked (solid bar)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_ASSIGNED, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: 'text.primary' }}>
          Estimated hours (lighter bar)
        </Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ChartShell
// ---------------------------------------------------------------------------

function ChartShell({
  title,
  description,
  height,
  children,
  accent,
  tint,
  compact,
  belowDescription,
  headerAdornment,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chartRef = useRef(null);
  const chartVisible = useInView(chartRef, {
    once: true,
    margin: '0px 0px -12% 0px',
    amount: 0.12,
  });
  const a = accent ?? '#5C6BC0';
  const bg = tint ?? (isDark ? 'rgba(92, 107, 192, 0.1)' : 'rgba(92, 107, 192, 0.06)');
  const chartBoxSx =
    typeof height === 'object' && height !== null
      ? { width: '100%', minWidth: 0, overflow: 'visible', height }
      : {
          width: '100%',
          minWidth: 0,
          overflow: 'visible',
          height: typeof height === 'number' ? height : 400,
        };
  const descMb = belowDescription != null ? 1.25 : compact ? 1 : 1.35;
  const chartMt = belowDescription != null ? 0 : compact ? 0.25 : description ? 0.25 : 0.5;
  const titleMb = description ? 0.5 : compact ? 1 : headerAdornment ? 1.25 : 1.5;

  return (
    <MotionPaper
      elevation={0}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={DASHBOARD_SCROLL_VIEWPORT}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        ...(compact
          ? { p: { xs: 1.5, sm: 1.75 }, pt: 1.75, pb: 1.25 }
          : { p: { xs: 2, sm: 2.5 }, pt: 2.5, pb: 2 }),
        borderRadius: 3,
        border: `1px solid ${isDark ? '#2A2C32' : '#E4E7ED'}`,
        borderLeft: `5px solid ${a}`,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: isDark 
          ? `linear-gradient(135deg, ${bg} 0%, #1C1E22 48%)`
          : `linear-gradient(135deg, ${bg} 0%, #FFFFFF 48%)`,
        boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
        overflow: 'visible',
      }}
    >
      {/* Encabezado */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: titleMb,
        }}
      >
        <Typography
          sx={{
            ...CHART_TITLE_SX,
            color: a,
            flex: 1,
            minWidth: 0,
            mb: 0,
            pr: headerAdornment ? 1 : 0,
          }}
        >
          {title}
        </Typography>
        {headerAdornment ? (
          <Box
            sx={{ flexShrink: 0, pt: { xs: 0.1, sm: 0.25 }, maxWidth: { xs: '52%', sm: '46%' } }}
          >
            {headerAdornment}
          </Box>
        ) : null}
      </Box>

      {description ? (
        <Typography sx={{ ...CHART_DESC_SX, mb: descMb, maxWidth: '68ch', color: 'text.secondary' }}>
          {description}
        </Typography>
      ) : null}

      {belowDescription != null ? (
        <Box
          sx={{
            width: '100%',
            mb: 1,
            mt: 0.15,
            px: { xs: 0.75, sm: 1 },
            py: { xs: 0.5, sm: 0.65 },
            borderRadius: 1.5,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15, 23, 42, 0.035)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15, 23, 42, 0.08)'}`,
            boxSizing: 'border-box',
          }}
        >
          {belowDescription}
        </Box>
      ) : null}

      {/* Gráfica */}
      <Box ref={chartRef} sx={{ ...chartBoxSx, mt: chartMt }}>
        {chartVisible ? (
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        ) : null}
      </Box>
    </MotionPaper>
  );
}

/** @param {'tasks' | 'hours'} metric */
function CompareDeveloperTotalsSummary({ developers, accent, isDark, metric }) {
  const rows = useMemo(() => {
    return [...(developers || [])]
      .map((d) => ({
        name: d.name,
        assigned: Math.max(0, Math.round(Number(d.assigned) || 0)),
        completed: Math.max(0, Math.round(Number(d.completed) || 0)),
        hours: Math.max(0, Number(d.hours) || 0),
      }))
      .sort((a, b) => {
        if (metric === 'hours') {
          return (
            b.hours - a.hours ||
            b.completed - a.completed ||
            String(a.name).localeCompare(String(b.name))
          );
        }
        return (
          b.completed - a.completed ||
          b.hours - a.hours ||
          String(a.name).localeCompare(String(b.name))
        );
      });
  }, [developers, metric]);

  if (!rows.length) return null;

  const valueColor = metric === 'hours' ? HOURS_FILL : COMPLETED_FILL;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 0.5,
      }}
    >
      {rows.map((row) => (
        <Box
          key={row.name}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            py: 0.35,
            px: 0.75,
            borderRadius: 1,
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.04)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15, 23, 42, 0.08)'}`,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', minWidth: 0, flex: 1 }}>
            {row.name}
          </Typography>
          <Typography
            component="span"
            sx={{ fontWeight: 800, fontSize: '0.78rem', color: valueColor, whiteSpace: 'nowrap' }}
          >
            {metric === 'hours'
              ? `${row.hours.toFixed(1)} h`
              : `${row.completed} / ${row.assigned} completed`}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * @param {{ name: string, shortName: string, assigned?: number, completed: number, hours: number }[]} developers
 * @param {object[]} [selectedSprints]
 * @param {boolean} [compareMode]
 */
export default function DashboardDeveloperCharts({
  developers = [],
  selectedSprints = [],
  compareMode = false,
  projectDevelopers = [],
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const orderedSelectedSprints = useMemo(
    () => [...(selectedSprints || [])].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b)),
    [selectedSprints],
  );

  const compareModel = useMemo(() => {
    if (!compareMode || orderedSelectedSprints.length < 2) return null;
    return buildCompareDeveloperChartsModel(orderedSelectedSprints, projectDevelopers);
  }, [compareMode, orderedSelectedSprints, projectDevelopers]);

  const teamProductivityTrend = useMemo(() => {
    if (!compareMode || orderedSelectedSprints.length < 2) return [];
    return buildTeamProductivityTrendSeries(orderedSelectedSprints);
  }, [compareMode, orderedSelectedSprints]);

  const teamTrendAxis = useMemo(() => buildProductivityScoreAxisDomainTicks(), []);

  // ---- cálculos de ejes y alturas (sin cambios) ----

  const workloadStack = useMemo(() => {
    return [...developers]
      .map((d) => {
        const assigned = Math.max(0, Number(d.assigned) || 0);
        const completedRaw = Math.max(0, Number(d.completed) || 0);
        const completed = Math.min(completedRaw, assigned);
        const pending = Math.max(0, assigned - completed);
        const pct = assigned > 0 ? Math.round((100 * completed) / assigned) : 0;
        return {
          name: d.name,
          shortName: d.shortName ?? d.name,
          assigned,
          completed,
          pending,
          pctComplete: pct,
        };
      })
      .sort((a, b) => b.assigned - a.assigned || String(a.name).localeCompare(String(b.name)));
  }, [developers]);

  const byHoursDesc = useMemo(() => {
    return [...developers]
      .map((d) => ({
        ...d,
        assignedHoursEstimate: Number(d.assignedHoursEstimate) || 0,
        hours: Number(d.hours) || 0,
      }))
      .sort(
        (a, b) =>
          Math.max(b.hours ?? 0, b.assignedHoursEstimate ?? 0) -
          Math.max(a.hours ?? 0, a.assignedHoursEstimate ?? 0),
      );
  }, [developers]);

  const hoursGroupedRows = useMemo(() => {
    return byHoursDesc
      .map((d) => {
        const assigned = Number(d.assignedHoursEstimate) || 0;
        const worked = Number(d.hours) || 0;
        const pct =
          assigned > 0
            ? Math.min(100, Math.round((100 * worked) / assigned))
            : worked > 0
              ? 100
              : 0;
        return {
          name: d.name,
          shortName: d.shortName ?? d.name,
          hWorked: worked,
          hAssigned: assigned,
          pctOfPlan: pct,
        };
      })
      .sort((a, b) => {
        const ta = Math.max(a.hWorked, a.hAssigned);
        const tb = Math.max(b.hWorked, b.hAssigned);
        return tb - ta || String(a.name).localeCompare(String(b.name));
      });
  }, [byHoursDesc]);

  const singleHoursAxis = useMemo(
    () => buildHoursAxisDomainTicks(maxSingleHoursGrouped(hoursGroupedRows)),
    [hoursGroupedRows],
  );

  const forCombo = useMemo(
    () => [...developers].sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0)),
    [developers],
  );

  const singleComboRange = useMemo(() => maxSingleComboRange(forCombo), [forCombo]);
  const comboExtraSingle = comboHeightExtraFromRange(
    singleComboRange.maxTasks,
    singleComboRange.maxHours,
  );

  const compareWorkloadStack = useMemo(() => {
    if (!compareMode || !developers.length) return [];
    return [...developers]
      .map((d) => {
        const assigned = Number(d.assigned) || 0;
        const completed = Math.min(Number(d.completed) || 0, assigned);
        const pending = Math.max(0, assigned - completed);
        const pctComplete = assigned > 0 ? Math.round((100 * completed) / assigned) : 0;
        return {
          name: d.shortName || d.name,
          completed,
          pending,
          pctComplete,
        };
      })
      .sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0));
  }, [compareMode, developers]);

  const compareHoursGroupedRows = useMemo(() => {
    if (!compareMode || !developers.length) return [];
    return [...developers]
      .map((d) => {
        const worked = Number(d.hours) || 0;
        const assigned = Number(d.assignedHoursEstimate) || 0;
        return {
          name: d.shortName || d.name,
          hWorked: worked,
          hAssigned: assigned,
        };
      })
      .sort((a, b) => Math.max(b.hWorked, b.hAssigned) - Math.max(a.hWorked, a.hAssigned));
  }, [compareMode, developers]);

  const compareWorkloadTaskAxis = useMemo(() => {
    if (!compareModel) return buildCompareTaskAxisDomainTicks(0);
    const { workloadRows, sprintDefs } = compareModel;
    const defs = [...(sprintDefs || [])].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b));
    return buildCompareTaskAxisDomainTicks(maxCompareWorkloadStack(workloadRows, defs));
  }, [compareModel]);

  const compareHoursAxis = useMemo(() => {
    if (!compareModel) return buildCompareHoursAxisDomainTicks(0);
    const { hoursRows, sprintDefs } = compareModel;
    const defs = [...(sprintDefs || [])].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b));
    return buildCompareHoursAxisDomainTicks(maxCompareHoursGrouped(hoursRows, defs));
  }, [compareModel]);

  const compareHoursScaleExtra = Math.min(
    120,
    Math.round(0.5 * maxSingleHoursGrouped(compareHoursGroupedRows)),
  );

  const hasCompareData =
    compareMode && orderedSelectedSprints.length >= 2 && developers.length > 0;
  const hasSingleData = !compareMode && developers.length > 0;

  const singleSelectedSprintAccent = useMemo(() => {
    const sp = orderedSelectedSprints?.[0];
    return sp?.accentColor ?? '#3949AB';
  }, [orderedSelectedSprints]);

  const singleWorkloadTaskAxis = useMemo(
    () => buildTaskAxisDomainTicks(maxSingleWorkloadStack(workloadStack)),
    [workloadStack],
  );

  const compareTotalsChartBonus = hasCompareData
    ? Math.min(72, 18 + Math.ceil(developers.length / 2) * 16)
    : 0;

  const hWorkloadCompareBase = hasCompareData
    ? Math.max(
        280,
        Math.min(520, 210 + compareWorkloadStack.length * 32 + compareTotalsChartBonus),
      )
    : null;
  const hHoursCompareBase = hasCompareData
    ? Math.max(
        280,
        Math.min(
          520,
          210 +
            compareHoursGroupedRows.length * 32 +
            Math.round(compareHoursScaleExtra * 0.45) +
            compareTotalsChartBonus,
        ),
      )
    : null;
  const hTeamTrendCompareBase = hasCompareData
    ? Math.max(260, Math.min(340, 220 + teamProductivityTrend.length * 28))
    : null;

  const hoursScaleExtraSingle = Math.min(
    120,
    Math.round(0.5 * maxSingleHoursGrouped(hoursGroupedRows)),
  );
  const hWorkloadSingleBase = Math.max(340, Math.min(700, 235 + workloadStack.length * 42));
  const hHoursSingleBase = Math.max(
    340,
    Math.min(700, 235 + hoursGroupedRows.length * 42 + hoursScaleExtraSingle),
  );
  const hComboSingleBase = Math.max(
    320,
    Math.min(520 + comboExtraSingle, 240 + forCombo.length * 38 + comboExtraSingle),
  );

  const hWorkload = hasCompareData
    ? compareChartHeights(hWorkloadCompareBase)
    : compareChartHeights(hWorkloadSingleBase);
  const hHours = hasCompareData
    ? compareChartHeights(hHoursCompareBase)
    : compareChartHeights(hHoursSingleBase);
  const hTeamTrend = hasCompareData ? compareChartHeights(hTeamTrendCompareBase) : null;
  const hCombo = hasCompareData ? null : compareChartHeights(hComboSingleBase);

  const compareSprintCount = orderedSelectedSprints.length;
  const compareAccent = orderedSelectedSprints[0]?.accentColor ?? '#3949AB';
  const compareWorkloadPendingTint = alpha(compareAccent, isDark ? 0.35 : 0.42);

  // ---- empty state ----

  if (!hasCompareData && !hasSingleData) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          border: `1px dashed ${isDark ? '#2A2C32' : '#B0BEC5'}`,
          textAlign: 'center',
          bgcolor: isDark ? 'rgba(21, 101, 192, 0.08)' : 'rgba(21, 101, 192, 0.04)',
        }}
      >
        <Typography
          sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.55 }}
        >
          No developer data for the selected sprint(s).
        </Typography>
      </Paper>
    );
  }

  // ---- modo comparación ----

  if (hasCompareData && compareModel) {
    const { sprintDefs: compareSprintDefs, workloadRows, hoursRows } = compareModel;
    const sprintDefs = [...(compareSprintDefs || [])].sort(
      (a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b),
    );
    const nSprints = sprintDefs.length;
    const compareWorkloadBarKey = (idx) => {
      const n = String(idx).padStart(2, '0');
      return { completed: `w${n}_c`, pending: `w${n}_p`, stackId: `w${n}` };
    };
    const workloadRowsWithTotals = workloadRows.map((row) => {
      const enriched = { ...row };
      sprintDefs.forEach((sp, idx) => {
        const keys = compareWorkloadBarKey(idx);
        const completed = Number(row[`wc_${sp.id}`]) || 0;
        const pending = Number(row[`wo_${sp.id}`]) || 0;
        enriched[keys.completed] = completed > 0 ? completed : null;
        enriched[keys.pending] = pending > 0 ? pending : null;
        enriched[`wt_${sp.id}`] = completed + pending;
      });
      return enriched;
    });
    const compareHoursBarKey = (idx) => `h${String(idx).padStart(2, '0')}`;
    const hoursRowsKeyed = hoursRows.map((row) => {
      const enriched = { ...row };
      sprintDefs.forEach((sp, idx) => {
        const hours = Number(row[`hw_${sp.id}`]) || 0;
        enriched[compareHoursBarKey(idx)] = hours > 0 ? hours : null;
      });
      return enriched;
    });
    const firstAccent = sprintDefs[0]?.accentColor ?? '#3949AB';
    const teamTrendAccent = PRODUCTIVITY_SCORE_TREND;
    const compareWorkloadTotalsSummary = (
      <CompareDeveloperTotalsSummary
        developers={developers}
        accent={firstAccent}
        isDark={isDark}
        metric="tasks"
      />
    );
    const compareHoursTotalsSummary = (
      <CompareDeveloperTotalsSummary
        developers={developers}
        accent="#FB8C00"
        isDark={isDark}
        metric="hours"
      />
    );

    const marginTopWorkload = Math.min(
      132,
      10 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 18 : 22) +
        (nSprints <= 2 ? 4 : nSprints <= 4 ? 8 : 10),
    );
    const marginTopHours = Math.min(
      84,
      8 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 14 : 18) +
        (nSprints <= 2 ? 4 : nSprints <= 4 ? 6 : 8),
    );
    const nWorkloadHoursRows = Math.max(workloadRows.length, hoursRows.length);
    const bottomAxisWorkloadHours = Math.min(
      78,
      50 + Math.max(0, nSprints - 3) * 5 + Math.min(12, Math.max(0, nWorkloadHoursRows - 6) * 2),
    );
    const xAxisTickHeightWorkloadHours = Math.min(
      64,
      44 + Math.max(0, nSprints - 4) * 5 + Math.min(8, Math.max(0, nWorkloadHoursRows - 5) * 2),
    );
    const compareBarRadius = [6, 6, 0, 0];
    /**
     * Workload compare: 1 columna apilada por sprint (completed abajo, pending claro arriba).
     * barCategoryGap en px (no %) para que el bloque por developer quede compacto.
     */
    const workloadBarCategoryGap = nSprints >= 6 ? 4 : nSprints >= 4 ? 6 : 8;
    const workloadBarGap = 0;
    const compareWorkloadBarSize = Math.max(
      24,
      Math.min(
        nSprints <= 2 ? 56 : nSprints <= 3 ? 48 : nSprints <= 5 ? 40 : nSprints <= 7 ? 34 : 28,
        Math.floor(300 / Math.max(1, nSprints)),
      ),
    );
    /**
     * Hours compare: barras del mismo developer pegadas (barGap 0); más espacio entre developers
     * cuando hay muchos sprints (p. ej. All Sprints).
     */
    const hoursBarCategoryGap = Math.min(
      72,
      (nSprints >= 7 ? 56 : nSprints >= 5 ? 44 : nSprints >= 4 ? 34 : nSprints >= 3 ? 26 : 18) +
        Math.min(16, Math.max(0, nWorkloadHoursRows - 4) * 3),
    );
    const hoursBarGap = 0;
    const compareHoursBarSize = Math.max(
      20,
      Math.min(
        nSprints <= 2 ? 56 : nSprints <= 3 ? 48 : nSprints <= 5 ? 40 : nSprints <= 7 ? 34 : 28,
        Math.floor(300 / Math.max(1, nSprints)),
      ),
    );
    const marginTopWorkloadTight = Math.max(58, marginTopWorkload - 6);

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', minWidth: 0 }}>
        {/* ── Workload ── */}
        <ChartShell
          compact
          title="Assigned workload by developer"
          description={CHART_DESC.compare.workload}
          belowDescription={compareWorkloadTotalsSummary}
          height={hWorkload}
          accent={firstAccent}
          tint={alpha(firstAccent, isDark ? 0.12 : 0.08)}
        >
          <BarChart
            data={workloadRowsWithTotals}
            margin={{ top: marginTopWorkloadTight, right: 56, left: 8, bottom: bottomAxisWorkloadHours }}
            barCategoryGap={workloadBarCategoryGap}
            barGap={workloadBarGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeightWorkloadHours}
              tickMargin={12}
              padding={{ left: 4, right: 4 }}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
              }}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              domain={compareWorkloadTaskAxis.domain}
              ticks={compareWorkloadTaskAxis.ticks}
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              tickMargin={8}
              width={52}
              label={{
                value: 'Tasks',
                angle: -90,
                position: 'insideLeft',
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
              }}
            />
            <Tooltip
              {...RECHARTS_BAR_TOOLTIP_PROPS}
              shared
              allowEscapeViewBox={{ x: true, y: true }}
              reverseDirectionAllowInDimension={{ x: true, y: true }}
              content={(props) => <CompareWorkloadTooltip {...props} sprintDefs={sprintDefs} />}
            />
            <Legend
              verticalAlign="top"
              align="center"
              layout="horizontal"
              wrapperStyle={{
                width: '100%',
                paddingTop: 0,
                paddingBottom: 0,
                marginBottom: -22,
                top: 0,
              }}
              content={() => <CompareWorkloadSymbolLegend sprintDefs={sprintDefs} />}
            />
            {sprintDefs.flatMap((sp, idx) => {
              const keys = compareWorkloadBarKey(idx);
              const pendingFill = alpha(sp.accentColor, isDark ? 0.35 : 0.42);
              return [
                <Bar
                  key={`wc-${sp.id}`}
                  stackId={keys.stackId}
                  dataKey={keys.completed}
                  name={`${sp.shortLabel} · completed`}
                  fill={sp.accentColor}
                  barSize={compareWorkloadBarSize}
                  shape={(barProps) => (
                    <CompareWorkloadStackBarShape
                      {...barProps}
                      roundTop={(Number(barProps.payload?.[keys.pending]) || 0) <= 0}
                      topRadius={compareBarRadius[0]}
                    />
                  )}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                >
                  <LabelList
                    valueAccessor={(entry) => entry?.payload}
                    content={(p) => (
                      <CompareWorkloadCompletedOutsideLabel
                        {...p}
                        sprintId={sp.id}
                        fill={sp.accentColor}
                        segment="completed"
                        rows={workloadRowsWithTotals}
                      />
                    )}
                  />
                </Bar>,
                <Bar
                  key={`wo-${sp.id}`}
                  stackId={keys.stackId}
                  dataKey={keys.pending}
                  name={`${sp.shortLabel} · pending`}
                  fill={pendingFill}
                  barSize={compareWorkloadBarSize}
                  shape={(barProps) => (
                    <CompareWorkloadStackBarShape
                      {...barProps}
                      roundTop
                      topRadius={compareBarRadius[0]}
                    />
                  )}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                >
                  <LabelList
                    valueAccessor={(entry) => entry?.payload}
                    content={(p) => (
                      <CompareWorkloadCompletedOutsideLabel
                        {...p}
                        sprintId={sp.id}
                        fill={sp.accentColor}
                        segment="pending"
                        rows={workloadRowsWithTotals}
                      />
                    )}
                  />
                </Bar>,
              ];
            })}
          </BarChart>
        </ChartShell>

        {/* ── Hours ── */}
        <ChartShell
          compact
          title="Hours worked by developer"
          description={sprintDefs.length > 1 ? undefined : CHART_DESC.compare.hours}
          belowDescription={compareHoursTotalsSummary}
          height={hHours}
          accent="#FB8C00"
          tint={isDark ? 'rgba(251, 140, 0, 0.15)' : 'rgba(251, 140, 0, 0.1)'}
        >
          <BarChart
            data={hoursRowsKeyed}
            margin={{ top: marginTopHours, right: 56, left: 8, bottom: bottomAxisWorkloadHours }}
            barCategoryGap={hoursBarCategoryGap}
            barGap={hoursBarGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeightWorkloadHours}
              tickMargin={12}
              padding={{ left: 4, right: 4 }}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
              }}
            />
            <YAxis
              type="number"
              domain={compareHoursAxis.domain}
              ticks={compareHoursAxis.ticks}
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              width={56}
              tickMargin={8}
              label={{
                value: Y_AXIS_HOURS,
                angle: -90,
                position: 'insideLeft',
                fill: HOURS_FILL,
                ...CHART_AXIS_LABEL,
              }}
            />
            <Tooltip
              {...RECHARTS_BAR_TOOLTIP_PROPS}
              shared
              allowEscapeViewBox={{ x: true, y: true }}
              reverseDirectionAllowInDimension={{ x: true, y: true }}
              content={(props) => <CompareHoursTooltip {...props} sprintDefs={sprintDefs} />}
            />
            <Legend
              verticalAlign="top"
              align="center"
              wrapperStyle={{ ...CHART_LEGEND_STYLE, top: 0, paddingBottom: 0, marginBottom: -20 }}
              content={() => <CompareHoursBarLegend sprintDefs={sprintDefs} />}
            />
            {sprintDefs.map((sp, idx) => (
              <Bar
                key={`hw-${sp.id}`}
                dataKey={compareHoursBarKey(idx)}
                name={`${sp.shortLabel} · hours worked`}
                fill={sp.accentColor}
                radius={compareBarRadius}
                barSize={compareHoursBarSize}
                animationDuration={CHART_BAR_ANIM_MS}
                animationEasing={CHART_BAR_EASING}
                activeBar={false}
              >
                <LabelList
                  dataKey={compareHoursBarKey(idx)}
                  position="top"
                  fill={sp.accentColor}
                  fontSize={12}
                  fontWeight={800}
                  formatter={(v) => {
                    const h = Number(v || 0);
                    return h > 0 ? `${h.toFixed(1)}h` : '';
                  }}
                />
              </Bar>
            ))}
          </BarChart>
        </ChartShell>

        {/* ── Team productivity trend ── */}
        <ChartShell
          compact
          title="Team productivity score trend"
          description={CHART_DESC.compare.teamTrend}
          height={hTeamTrend}
          accent={teamTrendAccent}
          tint={alpha(teamTrendAccent, isDark ? 0.12 : 0.08)}
        >
          <LineChart
            data={teamProductivityTrend}
            margin={{ top: 36, right: 20, left: 72, bottom: 52 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="sprintLabel"
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              tickMargin={8}
              height={40}
              label={{
                value: 'Sprint',
                position: 'bottom',
                offset: 16,
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
              }}
            />
            <YAxis
              domain={teamTrendAxis.domain}
              ticks={teamTrendAxis.ticks}
              tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              width={44}
              tickMargin={6}
              tickFormatter={(v) => `${Math.round(Number(v) || 0)}%`}
              label={{
                value: 'Productivity score',
                angle: -90,
                position: 'left',
                offset: 12,
                fill: teamTrendAccent,
                ...CHART_AXIS_LABEL,
                style: { textAnchor: 'middle', fontSize: 13, fontWeight: 700 },
              }}
            />
            <Tooltip
              {...RECHARTS_BAR_TOOLTIP_PROPS}
              content={(props) => <TeamProductivityTrendTooltip {...props} />}
            />
            <Line
              type="monotone"
              dataKey="productivityScore"
              name="Productivity score"
              stroke={teamTrendAccent}
              strokeWidth={3}
              connectNulls={false}
              animationDuration={CHART_BAR_ANIM_MS}
              animationEasing={CHART_BAR_EASING}
              dot={(dotProps) => {
                const { cx, cy, payload } = dotProps || {};
                if (cx == null || cy == null || !Number.isFinite(payload?.productivityScore)) return null;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={payload.accentColor || teamTrendAccent}
                    stroke={isDark ? '#1C1E22' : '#fff'}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 7, strokeWidth: 2 }}
            >
              <LabelList
                dataKey="productivityScore"
                position="top"
                fill={teamTrendAccent}
                fontSize={12}
                fontWeight={800}
                formatter={(v) => `${Math.round(Number(v) || 0)}%`}
              />
            </Line>
          </LineChart>
        </ChartShell>
      </Box>
    );
  }

  // ---- modo single sprint ----

  const workloadPendingTint = alpha(singleSelectedSprintAccent, isDark ? 0.35 : 0.42);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
      <ChartShell
        title="Assigned workload by developer"
        description={CHART_DESC.single.workload}
        height={hWorkload}
        accent={singleSelectedSprintAccent}
        tint={alpha(singleSelectedSprintAccent, isDark ? 0.12 : 0.08)}
      >
        <BarChart
          layout="vertical"
          data={workloadStack}
          margin={{ top: 48, right: 90, left: 4, bottom: 56 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={singleWorkloadTaskAxis.domain}
            ticks={singleWorkloadTaskAxis.ticks}
            tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            tickMargin={10}
            label={{
              value: 'Tasks',
              position: 'bottom',
              offset: 8,
              fill: isDark ? '#9A9A9A' : '#1A1A1A',
              ...CHART_AXIS_LABEL,
              fontSize: 15,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            contentStyle={{ ...CHART_TOOLTIP_SX, backgroundColor: isDark ? '#1C1E22' : '#fff', color: isDark ? '#F0F0F0' : '#1A1A1A', borderColor: isDark ? '#2A2C32' : '#B0BEC5' }}
            formatter={(value) => [`${value} tasks`, '']}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return label;
              return `${row.name} · ${row.pctComplete}%`;
            }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            layout="horizontal"
            wrapperStyle={{ ...CHART_LEGEND_STYLE, paddingBottom: 6, marginBottom: 2 }}
            content={() => (
              <SingleWorkloadSymbolLegend
                completedFill={singleSelectedSprintAccent}
                pendingFill={workloadPendingTint}
              />
            )}
          />
          <Bar
            stackId="load"
            dataKey="completed"
            name="Completed tasks"
            fill={singleSelectedSprintAccent}
            maxBarSize={38}
            shape={(barProps) => (
              <CompareWorkloadStackBarShape
                {...barProps}
                roundTop={(Number(barProps.payload?.pending) || 0) <= 0}
                topRadius={6}
              />
            )}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          >
            <LabelList
              valueAccessor={(entry) => entry?.payload}
              content={(p) => (
                <SingleWorkloadCompletedOutsideLabel
                  {...p}
                  fill={singleSelectedSprintAccent}
                  segment="completed"
                  rows={workloadStack}
                />
              )}
            />
          </Bar>
          <Bar
            stackId="load"
            dataKey="pending"
            name="Pending tasks"
            fill={workloadPendingTint}
            maxBarSize={38}
            shape={(barProps) => (
              <CompareWorkloadStackBarShape {...barProps} roundTop topRadius={6} />
            )}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          >
            <LabelList
              valueAccessor={(entry) => entry?.payload}
              content={(p) => (
                <SingleWorkloadCompletedOutsideLabel
                  {...p}
                  fill={singleSelectedSprintAccent}
                  segment="pending"
                  rows={workloadStack}
                />
              )}
            />
          </Bar>
        </BarChart>
      </ChartShell>

      <ChartShell
        title="Hours worked by developer"
        description={CHART_DESC.single.hours}
        height={hHours}
        accent="#FB8C00"
        tint={isDark ? 'rgba(251, 140, 0, 0.15)' : 'rgba(251, 140, 0, 0.1)'}
      >
        <BarChart
          layout="vertical"
          data={hoursGroupedRows}
          margin={{ top: 48, right: 24, left: 4, bottom: 56 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            domain={singleHoursAxis.domain}
            ticks={singleHoursAxis.ticks}
            tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            tickMargin={10}
            label={{
              value: Y_AXIS_HOURS,
              position: 'bottom',
              offset: 8,
              fill: isDark ? '#9A9A9A' : '#1A1A1A',
              ...CHART_AXIS_LABEL,
              fontSize: 15,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            contentStyle={{ ...CHART_TOOLTIP_SX, backgroundColor: isDark ? '#1C1E22' : '#fff', color: isDark ? '#F0F0F0' : '#1A1A1A', borderColor: isDark ? '#2A2C32' : '#B0BEC5' }}
            formatter={(value, name) => [`${Number(value).toFixed(1)} h`, name]}
            labelFormatter={(label, payload) => {
              const row = payload?.[0]?.payload;
              if (!row) return label;
              return row.name;
            }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            layout="horizontal"
            wrapperStyle={{ ...CHART_LEGEND_STYLE, paddingBottom: 6, marginBottom: 2 }}
            content={() => <SingleHoursSymbolLegend />}
          />
          <Bar
            dataKey="hWorked"
            name="Hours worked"
            fill={HOURS_FILL}
            radius={[0, 6, 6, 0]}
            maxBarSize={38}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          >
            <LabelList
              dataKey="hWorked"
              position="right"
              fill={HOURS_FILL}
              fontSize={13}
              fontWeight={800}
              formatter={(v) => `${Number(v || 0).toFixed(1)}h`}
            />
          </Bar>
          <Bar
            dataKey="hAssigned"
            name="Estimated hours"
            fill={HOURS_ASSIGNED}
            radius={[6, 0, 0, 6]}
            maxBarSize={38}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          >
            <LabelList
              dataKey="hAssigned"
              content={(p) => <HoursValueLabel {...p} fill={HOURS_ASSIGNED_LABEL} />}
            />
          </Bar>
        </BarChart>
      </ChartShell>

      <ChartShell
        title="Developer productivity (tasks vs hours)"
        description={CHART_DESC.single.combo}
        height={hCombo}
        accent="#7E57C2"
        tint={isDark ? 'rgba(126, 87, 194, 0.12)' : 'rgba(126, 87, 194, 0.08)'}
      >
        <ComposedChart data={forCombo} margin={{ top: 12, right: 22, left: 10, bottom: 82 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="shortName"
            tick={{ ...CHART_TICK(isDark), fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={80}
            tickMargin={12}
          />
          <YAxis
            yAxisId="tasks"
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            width={56}
            tickMargin={8}
            allowDecimals={false}
            label={{
              value: 'Tasks',
              angle: -90,
              position: 'insideLeft',
              fill: COMPLETED_FILL,
              ...CHART_AXIS_LABEL,
            }}
          />
          <YAxis
            yAxisId="hrs"
            orientation="right"
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
            width={58}
            tickMargin={8}
            label={{
              value: Y_AXIS_HOURS,
              angle: 90,
              position: 'insideRight',
              fill: HOURS_LINE,
              ...CHART_AXIS_LABEL,
            }}
          />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            contentStyle={{ ...CHART_TOOLTIP_SX, backgroundColor: isDark ? '#1C1E22' : '#fff', color: isDark ? '#F0F0F0' : '#1A1A1A', borderColor: isDark ? '#2A2C32' : '#B0BEC5' }}
            formatter={(value, name) => {
              if (name === 'Tasks completed') return [`${value}`, 'Tasks completed'];
              if (name === Y_AXIS_HOURS) return [`${Number(value).toFixed(1)} h`, Y_AXIS_HOURS];
              return [value, name];
            }}
          />
          <Legend wrapperStyle={{ ...CHART_LEGEND_STYLE, paddingTop: 8 }} />
          <Bar
            yAxisId="tasks"
            dataKey="completed"
            name="Tasks completed"
            fill={COMPLETED_FILL}
            radius={[6, 6, 0, 0]}
            maxBarSize={38}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          ></Bar>
          <Line
            yAxisId="hrs"
            type="monotone"
            dataKey="hours"
            name={Y_AXIS_HOURS}
            stroke={HOURS_LINE}
            strokeWidth={3}
            animationDuration={CHART_BAR_ANIM_MS}
            dot={{ r: 5, fill: HOURS_LINE, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ChartShell>
    </Box>
  );
}