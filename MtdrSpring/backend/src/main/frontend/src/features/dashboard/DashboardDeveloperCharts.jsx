import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  sprintDbIdSortKey,
  buildBlockedReportsForAiSprint,
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
  maxCompareComboRange,
  comboHeightExtraFromRange,
  compareChartHeights,
} from './utils/chartUtils';
import { API_BASE } from '../sprints/constants/sprintConstants';

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
  const onPending = pending > 0;
  if ((onPending && segment !== 'pending') || (!onPending && segment !== 'completed')) return null;
  const px = Number(x);
  const py = Number(y);
  const pw = Number(width);
  const centerX = px + pw / 2;
  const labelY = Math.max(10, py - Math.max(14, 12 + Math.min(8, Number(height) || 0)));
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

function CompareComboTooltip({ active, payload, sprintDefs }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const p = payload[0];
  const row = p.payload;
  const key = String(p.dataKey ?? '');
  let focusedSprintId = null;
  if (key.startsWith('cb_')) focusedSprintId = Number(key.replace('cb_', ''));
  if (key.startsWith('ln_')) focusedSprintId = Number(key.replace('ln_', ''));
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX,
        bgcolor: 'background.paper',
        border: `1px solid ${isDark ? '#2A2C32' : '#B0BEC5'}`,
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.4)' : '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 230,
      }}
    >
      <Typography sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.95rem', lineHeight: 1.3 }}>
        {row.name}
      </Typography>
      {sprintDefs.map((sp, idx) => {
        const tasks = Number(row[`cb_${sp.id}`]) || 0;
        const hours = Number(row[`ln_${sp.id}`]) || 0;
        const focused = Number(sp.id) === Number(focusedSprintId);
        return (
          <Box
            key={sp.id}
            sx={{
              mt: idx === 0 ? 1 : 0,
              pt: idx === 0 ? 0 : 1,
              borderTop: idx === 0 ? 'none' : `1px solid ${isDark ? '#2A2C32' : '#ECEFF1'}`,
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                color: sp.accentColor,
                fontSize: '0.88rem',
                opacity: focused || focusedSprintId == null ? 1 : 0.85,
              }}
            >
              {sp.shortLabel}
            </Typography>
            <Box sx={{ mt: 0.35 }}>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: 'text.primary',
                  fontWeight: focused ? 700 : 600,
                  lineHeight: 1.45,
                }}
              >
                Completed tasks: {tasks}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: 'text.primary',
                  fontWeight: focused ? 700 : 600,
                  lineHeight: 1.45,
                }}
              >
                Hours: {hours.toFixed(1)} h
              </Typography>
            </Box>
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
              fontSize: squeeze ? { xs: '0.75rem', sm: '0.8125rem' } : undefined,
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
  const donePendingFont = { xs: '0.9rem', sm: '0.97rem' };
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
          sx={{ color: isDark ? '#2A2C32' : '#B0BEC5', fontWeight: 700, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}
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
  const labelSize = many ? { xs: '0.75rem', sm: '0.8125rem' } : { xs: '0.8125rem', sm: '0.875rem' };

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
// AI Insights — grid 2×2 embebido dentro del ChartShell
// ---------------------------------------------------------------------------

/**
 * Muestra los insights de IA en un grid 2×2 (1 columna en mobile).
 * Se renderiza como `footer` dentro de ChartShell, debajo de la gráfica.
 */
function AIDeveloperVariationGrid({ rows, emptyText, loading, tone = 'default' }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const palette =
    tone === 'workload'
      ? { bg: isDark ? '#2D1F12' : '#FFF8F2', border: isDark ? '#4A2E1A' : '#FFE2CC', name: '#FFB74D', text: isDark ? '#E0E0E0' : '#263238' }
      : tone === 'hours'
        ? { bg: isDark ? '#0D2137' : '#F3F8FF', border: isDark ? '#1A3A5C' : '#DCEAFF', name: '#64B5F6', text: isDark ? '#E0E0E0' : '#1A1A1A' }
        : tone === 'productivity'
          ? { bg: isDark ? '#0D2616' : '#F4FBF7', border: isDark ? '#1A4A2A' : '#D7F0E1', name: '#81C784', text: isDark ? '#E0E0E0' : '#1A1A1A' }
          : { bg: isDark ? '#1A1C20' : '#F8FCFF', border: isDark ? '#2A2C32' : '#E6EEF5', name: isDark ? '#F0F0F0' : '#1A1A1A', text: isDark ? '#E0E0E0' : '#1A1A1A' };
  const cardPalettes =
    tone === 'workload'
      ? [
          { bg: isDark ? '#2D1F12' : '#FFF1E8', border: isDark ? '#4A2E1A' : '#FFB98E', stripe: '#00897B' },
          { bg: isDark ? '#1F1626' : '#F3E5F5', border: isDark ? '#3A2A4A' : '#CE93D8', stripe: '#7B1FA2' },
          { bg: isDark ? '#161C26' : '#EEF3FF', border: isDark ? '#2A3A5C' : '#9DB6FF', stripe: '#3949AB' },
          { bg: isDark ? '#0D1F1A' : '#ECFAF6', border: isDark ? '#1A4A3A' : '#89DCC1', stripe: '#00796B' },
          { bg: isDark ? '#1A1426' : '#F9F5FF', border: isDark ? '#3A2A5C' : '#BFA2FF', stripe: '#6A1B9A' },
        ]
      : tone === 'hours'
        ? [
            { bg: isDark ? '#0D2137' : '#ECF5FF', border: isDark ? '#1A3A5C' : '#9CCDFF', stripe: '#1565C0' },
            { bg: isDark ? '#161C2E' : '#EFF2FF', border: isDark ? '#2A3A6C' : '#A8B5FF', stripe: '#303F9F' },
            { bg: isDark ? '#0D1F2E' : '#EAF8FF', border: isDark ? '#1A4A6C' : '#8EDCFF', stripe: '#0277BD' },
            { bg: isDark ? '#0D1F1A' : '#F0FAF7', border: isDark ? '#1A4A3A' : '#96E1CC', stripe: '#00695C' },
            { bg: isDark ? '#1A142E' : '#F7F1FF', border: isDark ? '#3A2A6C' : '#C8A7FF', stripe: '#7B1FA2' },
          ]
        : tone === 'productivity'
          ? [
              { bg: isDark ? '#0D2616' : '#EEF9F2', border: isDark ? '#1A4A2A' : '#9EDCB6', stripe: '#2E7D32' },
              { bg: isDark ? '#1A2610' : '#F3FAEE', border: isDark ? '#3A4A1A' : '#B7DB88', stripe: '#558B2F' },
              { bg: isDark ? '#0D1F1A' : '#EAF8F5', border: isDark ? '#1A4A3A' : '#93D8C6', stripe: '#00796B' },
              { bg: isDark ? '#1A1A0D' : '#F6F8EC', border: isDark ? '#3A3A1A' : '#CFD992', stripe: '#827717' },
              { bg: isDark ? '#161C2E' : '#EFF4FF', border: isDark ? '#2A3A6C' : '#AFC4FF', stripe: '#3949AB' },
            ]
          : [
              { bg: isDark ? '#1A1C20' : '#F8FCFF', border: isDark ? '#2A2C32' : '#BCD7EC', stripe: '#1976D2' },
              { bg: isDark ? '#1A1C26' : '#F7FAFF', border: isDark ? '#2A2C4A' : '#C5D1E8', stripe: '#5C6BC0' },
              { bg: isDark ? '#0D1F1A' : '#F6FBFA', border: isDark ? '#1A4A3A' : '#BFE0D8', stripe: '#00897B' },
              { bg: isDark ? '#1A1426' : '#FBF9FF', border: isDark ? '#3A2A5C' : '#D2C3EA', stripe: '#8E24AA' },
            ];

  if (!rows?.length) {
    return (
      <Box sx={{ px: 0.5, pt: 0.5 }}>
        <Typography
          sx={{ color: '#1565C0', fontSize: '0.78rem', fontStyle: 'italic', fontWeight: 600 }}
        >
          {loading ? 'Generating AI insights…' : emptyText}
        </Typography>
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 0.75,
      }}
    >
      {rows.map((r, idx) => {
        const cardTone = cardPalettes[idx % cardPalettes.length];
        return (
          <Box
            key={r.key}
            sx={{
              p: 0.55,
              borderRadius: 0.9,
              bgcolor: cardTone.bg,
              border: `1px solid ${cardTone.border}`,
              borderLeft: `4px solid ${cardTone.stripe}`,
            }}
          >
            <Typography
              sx={{ fontWeight: 700, color: cardTone.stripe, fontSize: '0.82rem', mb: 0.08 }}
            >
              {r.name}
            </Typography>
            <Typography sx={{ color: palette.text, fontSize: '0.78rem', lineHeight: 1.3 }}>
              {r.message}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ChartShell — acepta prop `footer` para los insights embebidos
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
  footer,
  footerTitle,
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

      {/* Footer AI insights embebido */}
      {footer != null ? (
        <Box
          sx={{
            mt: 0.35,
            pt: 0.25,
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '0.7rem',
              color: '#00897B',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 0.22,
            }}
          >
            {footerTitle ?? 'AI Insights'}
          </Typography>
          {footer}
        </Box>
      ) : null}
    </MotionPaper>
  );
}

/** @param {'tasks' | 'hours'} metric */
function CompareDeveloperTotalsSummary({ developers, accent, isDark, metric }) {
  const rows = useMemo(() => {
    return [...(developers || [])]
      .map((d) => ({
        name: d.name,
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
              : `${row.completed} ${row.completed === 1 ? 'task' : 'tasks'}`}
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
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiProductivityRows, setAiProductivityRows] = useState([]);

  const orderedSelectedSprints = useMemo(
    () => [...(selectedSprints || [])].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b)),
    [selectedSprints],
  );

  const compareModel = useMemo(() => {
    if (!compareMode || orderedSelectedSprints.length < 2) return null;
    return buildCompareDeveloperChartsModel(orderedSelectedSprints);
  }, [compareMode, orderedSelectedSprints]);

  const aiSprintPayload = useMemo(
    () =>
      orderedSelectedSprints.map((sp) => ({
        id: sp.id,
        shortLabel: sp.shortLabel,
        developers: (sp.developers || []).map((d) => ({
          name: d.name,
          assigned: Number(d.assigned || 0),
          completed: Number(d.completed || 0),
          hours: Number(d.hours || 0),
          assignedHoursEstimate: Number(d.assignedHoursEstimate || 0),
        })),
        blockedReports: buildBlockedReportsForAiSprint(sp),
      })),
    [orderedSelectedSprints],
  );

  useEffect(() => {
    if (!compareMode || aiSprintPayload.length < 2) {
      setAiProductivityRows([]);
      setAiLoading(false);
      setAiError('');
      return undefined;
    }
    const controller = new AbortController();
    let cancelled = false;
    const run = async () => {
      setAiLoading(true);
      setAiError('');
      setAiProductivityRows([]);
      try {
        const res = await fetch(`${API_BASE}/api/insights/developer-variation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sprints: aiSprintPayload }),
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const insights = data?.insights ?? {};
        const productivity = Array.isArray(insights.productivity) ? insights.productivity : [];
        if (!cancelled) {
          setAiProductivityRows(
            productivity.map((r, idx) => ({
              key: r?.key || `dash-productivity-${idx}`,
              name: r?.developerName || 'Developer',
              message: r?.message || 'No AI explanation returned.',
            })),
          );
        }
      } catch (_e) {
        if (!cancelled) {
          setAiError('AI insights are temporarily unavailable.');
          setAiProductivityRows([]);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [compareMode, aiSprintPayload]);

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
    ? Math.min(160, 36 + Math.ceil(developers.length / 2) * 28)
    : 0;

  const hWorkloadCompareBase = hasCompareData
    ? Math.max(
        400,
        Math.min(820, 280 + compareWorkloadStack.length * 48 + compareTotalsChartBonus),
      )
    : null;
  const hHoursCompareBase = hasCompareData
    ? Math.max(
        400,
        Math.min(
          820,
          280 + compareHoursGroupedRows.length * 48 + compareHoursScaleExtra + compareTotalsChartBonus,
        ),
      )
    : null;
  const hComboCompareBase = hasCompareData
    ? Math.max(320, Math.min(520 + comboExtraSingle, 240 + forCombo.length * 38 + comboExtraSingle))
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
  const hCombo = hasCompareData
    ? compareChartHeights(hComboCompareBase)
    : compareChartHeights(hComboSingleBase);

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
    const { sprintDefs: compareSprintDefs, workloadRows, hoursRows, comboRows } = compareModel;
    const sprintDefs = [...(compareSprintDefs || [])].sort(
      (a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b),
    );
    const nSprints = sprintDefs.length;
    const workloadRowsWithTotals = workloadRows.map((row) => {
      const enriched = { ...row };
      sprintDefs.forEach((sp) => {
        enriched[`wt_${sp.id}`] =
          (Number(row[`wc_${sp.id}`]) || 0) + (Number(row[`wo_${sp.id}`]) || 0);
      });
      return enriched;
    });
    const firstAccent = sprintDefs[0]?.accentColor ?? '#3949AB';
    const comboAccent =
      sprintDefs[sprintDefs.length - 1]?.accentColor ?? sprintDefs[0]?.accentColor ?? '#7E57C2';
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
      168,
      14 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 22 : 28) +
        (nSprints <= 2 ? 6 : nSprints <= 4 ? 10 : 14),
    );
    const marginTopHours = Math.min(
      100,
      10 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 16 : 20) +
        (nSprints <= 2 ? 4 : nSprints <= 4 ? 8 : 12),
    );
    const marginTopComboPlot = 16;
    const nWorkloadHoursRows = Math.max(workloadRows.length, hoursRows.length);
    const bottomAxisWorkloadHours = Math.min(
      92,
      58 + Math.max(0, nSprints - 3) * 6 + Math.min(14, Math.max(0, nWorkloadHoursRows - 6) * 2),
    );
    const xAxisTickHeightWorkloadHours = Math.min(
      72,
      50 + Math.max(0, nSprints - 4) * 6 + Math.min(8, Math.max(0, nWorkloadHoursRows - 5) * 2),
    );
    /** Productivity combo — layout independiente (no usar tuning de workload/hours). */
    const nComboRows = comboRows.length;
    const bottomAxisCombo = Math.min(
      92,
      58 + Math.max(0, nSprints - 3) * 6 + Math.min(14, Math.max(0, nComboRows - 6) * 2),
    );
    const xAxisTickHeightCombo = Math.min(
      72,
      50 + Math.max(0, nSprints - 4) * 6 + Math.min(8, Math.max(0, nComboRows - 5) * 2),
    );
    const barCategoryGapCombo =
      nSprints >= 6 ? '8%' : nSprints >= 4 ? '12%' : nSprints >= 3 ? '8%' : '5%';
    const barCategoryGapCompare = barCategoryGapCombo;
    const maxBarCombo = Math.max(
      10,
      Math.min(
        nSprints <= 2 ? 54 : nSprints <= 3 ? 46 : nSprints <= 5 ? 38 : 32,
        Math.floor(124 / Math.max(1, nSprints)),
      ),
    );
    const lineStrokeWCombo = nSprints > 5 ? 1.5 : 2;
    const lineDotRCombo = nSprints > 5 ? 2 : nSprints > 3 ? 3 : 4;
    /** Workload: wide bars, minimal gap between developers and sprint stacks. */
    const workloadBarCategoryGap =
      nSprints >= 6 ? '1%' : nSprints >= 4 ? '1%' : nSprints >= 3 ? '0%' : '0%';
    const workloadBarGap = 0;
    const maxBarWorkloadCompare = Math.max(
      14,
      Math.min(
        nSprints <= 2 ? 58 : nSprints <= 3 ? 50 : nSprints <= 5 ? 42 : 36,
        Math.floor(132 / Math.max(1, nSprints)),
      ),
    );
    const maxBarCompare = Math.max(
      16,
      Math.min(
        nSprints <= 2 ? 40 : nSprints <= 3 ? 32 : nSprints <= 5 ? 26 : 20,
        Math.floor(110 / Math.max(1, nSprints)),
      ),
    );
    const marginTopWorkloadTight = Math.max(58, marginTopWorkload - 6);

    const aiEmptyText = aiError || 'Select at least 2 sprints to compare.';

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
        {/* ── Workload ── */}
        <ChartShell
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
              tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeightWorkloadHours}
              tickMargin={12}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
                fontSize: 15,
              }}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              domain={compareWorkloadTaskAxis.domain}
              ticks={compareWorkloadTaskAxis.ticks}
              tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              tickMargin={8}
              width={52}
              label={{
                value: 'Tasks',
                angle: -90,
                position: 'insideLeft',
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
                fontSize: 15,
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
            {sprintDefs.map((sp) => (
              <React.Fragment key={`w-${sp.id}`}>
                <Bar
                  stackId={`sp-${sp.id}`}
                  dataKey={`wc_${sp.id}`}
                  name={`${sp.shortLabel} · completed`}
                  fill={sp.accentColor}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={maxBarWorkloadCompare}
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
                </Bar>
                <Bar
                  stackId={`sp-${sp.id}`}
                  dataKey={`wo_${sp.id}`}
                  name={`${sp.shortLabel} · pending`}
                  fill={alpha(sp.accentColor, isDark ? 0.35 : 0.42)}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarWorkloadCompare}
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
                </Bar>
              </React.Fragment>
            ))}
          </BarChart>
        </ChartShell>

        {/* ── Hours ── */}
        <ChartShell
          title="Hours worked by developer"
          description={sprintDefs.length > 1 ? undefined : CHART_DESC.compare.hours}
          belowDescription={compareHoursTotalsSummary}
          height={hHours}
          accent="#FB8C00"
          tint={isDark ? 'rgba(251, 140, 0, 0.15)' : 'rgba(251, 140, 0, 0.1)'}
        >
          <BarChart
            data={hoursRows}
            margin={{ top: marginTopHours, right: 12, left: 8, bottom: bottomAxisWorkloadHours }}
            barCategoryGap={barCategoryGapCompare}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeightWorkloadHours}
              tickMargin={12}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: isDark ? '#9A9A9A' : '#1A1A1A',
                ...CHART_AXIS_LABEL,
                fontSize: 15,
              }}
            />
            <YAxis
              type="number"
              domain={compareHoursAxis.domain}
              ticks={compareHoursAxis.ticks}
              tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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
            {sprintDefs.map((sp) => (
              <React.Fragment key={`hr-bullet-${sp.id}`}>
                <Bar
                  dataKey={`hw_${sp.id}`}
                  name={`${sp.shortLabel} · hours worked`}
                  fill={sp.accentColor}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={maxBarCompare}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                >
                  <LabelList
                    dataKey={`hw_${sp.id}`}
                    position="top"
                    fill={sp.accentColor}
                    fontSize={13}
                    fontWeight={800}
                    formatter={(v) => `${Number(v || 0).toFixed(1)}h`}
                  />
                </Bar>
              </React.Fragment>
            ))}
          </BarChart>
        </ChartShell>

        {/* ── Combo ── */}
        <ChartShell
          title="Developer productivity (tasks vs hours)"
          description={CHART_DESC.compare.combo}
          belowDescription={<CompareComboLegend sprintDefs={sprintDefs} />}
          height={hCombo}
          accent={comboAccent}
          tint={alpha(comboAccent, isDark ? 0.12 : 0.08)}
          footerTitle="AI summary: productivity (tasks vs hours) by developer"
          footer={
            <AIDeveloperVariationGrid
              rows={aiProductivityRows}
              loading={aiLoading}
              emptyText={aiEmptyText}
              tone="productivity"
            />
          }
        >
          <ComposedChart
            data={comboRows}
            margin={{ top: marginTopComboPlot, right: 22, left: 10, bottom: bottomAxisCombo }}
            barCategoryGap={barCategoryGapCombo}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeightCombo}
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
              shared={false}
              content={(props) => <CompareComboTooltip {...props} sprintDefs={sprintDefs} />}
            />
            {sprintDefs.map((sp) => (
              <Bar
                key={`cb-${sp.id}`}
                yAxisId="tasks"
                dataKey={`cb_${sp.id}`}
                name={`${sp.shortLabel} · tasks`}
                fill={sp.accentColor}
                radius={[6, 6, 0, 0]}
                maxBarSize={maxBarCombo}
                animationDuration={CHART_BAR_ANIM_MS}
                animationEasing={CHART_BAR_EASING}
                activeBar={false}
              ></Bar>
            ))}
            {sprintDefs.map((sp) => (
              <Line
                key={`ln-${sp.id}`}
                yAxisId="hrs"
                type="monotone"
                dataKey={`ln_${sp.id}`}
                name={`${sp.shortLabel} · hours`}
                stroke={sp.accentColor}
                strokeWidth={lineStrokeWCombo}
                animationDuration={CHART_BAR_ANIM_MS}
                dot={{ r: lineDotRCombo, fill: sp.accentColor, strokeWidth: 0 }}
              />
            ))}
          </ComposedChart>
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
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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
            radius={[0, 6, 6, 0]}
            maxBarSize={38}
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
            radius={[6, 0, 0, 6]}
            maxBarSize={38}
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
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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
            tick={{ ...CHART_TICK, fill: isDark ? '#9A9A9A' : '#1A1A1A' }}
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