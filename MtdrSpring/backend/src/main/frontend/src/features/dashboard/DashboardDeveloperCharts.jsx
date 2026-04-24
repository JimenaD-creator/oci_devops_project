import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
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
import { buildCompareDeveloperChartsModel } from './dashboardSprintData';
import { DASHBOARD_SCROLL_VIEWPORT } from './ScrollReveal';
import {
  CHART_DESC,
  COMPLETED_FILL,
  HOURS_FILL,
  HOURS_LINE,
  HOURS_ASSIGNED,
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
  maxSingleHoursGrouped,
  maxCompareHoursGrouped,
  buildHoursAxisDomainTicks,
  maxSingleComboRange,
  maxCompareComboRange,
  comboHeightExtraFromRange,
  compareChartHeights,
} from './utils/chartUtils';
import { API_BASE } from '../sprints/constants/sprintConstants';

const MotionPaper = motion(Paper);

// ---------------------------------------------------------------------------
// Tooltips de comparación
// ---------------------------------------------------------------------------

function CompareWorkloadTooltip({ active, payload, sprintDefs }) {
  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX,
        bgcolor: '#fff',
        border: '1px solid #B0BEC5',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 200,
      }}
    >
      <Typography sx={{ fontWeight: 800, color: '#37474F', fontSize: '0.95rem', lineHeight: 1.3 }}>
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
              mt: idx === 0 ? 1 : 0,
              pt: idx === 0 ? 0 : 1.25,
              borderTop: idx === 0 ? 'none' : '1px solid #ECEFF1',
            }}
          >
            <Typography sx={{ fontWeight: 700, color: sp.accentColor, fontSize: '0.88rem' }}>
              {sp.shortLabel}
            </Typography>
            <Typography
              sx={{ color: sp.accentColor, fontSize: '0.84rem', mt: 0.35, fontWeight: 600 }}
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
  if (!active || !payload?.length || !sprintDefs?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <Box
      sx={{
        ...CHART_TOOLTIP_SX,
        bgcolor: '#fff',
        border: '1px solid #B0BEC5',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 220,
      }}
    >
      <Typography sx={{ fontWeight: 800, color: '#37474F', fontSize: '0.95rem', lineHeight: 1.3 }}>
        {row.name}
      </Typography>
      {sprintDefs.map((sp, idx) => {
        const worked = Number(row[`hw_${sp.id}`]) || 0;
        const assigned = Number(row[`ha_${sp.id}`]) || 0;
        return (
          <Box
            key={sp.id}
            sx={{
              mt: idx === 0 ? 1 : 0,
              pt: idx === 0 ? 0 : 1,
              borderTop: idx === 0 ? 'none' : '1px solid #ECEFF1',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.35,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: sp.accentColor, fontSize: '0.88rem' }}>
              {sp.shortLabel}
            </Typography>
            <Typography sx={{ color: '#546E7A', fontSize: '0.82rem', fontWeight: 600 }}>
              Hours worked: {worked.toFixed(1)} h · Estimated hours: {assigned.toFixed(1)} h
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function CompareComboTooltip({ active, payload, sprintDefs }) {
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
        bgcolor: '#fff',
        border: '1px solid #B0BEC5',
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        minWidth: 230,
      }}
    >
      <Typography sx={{ fontWeight: 800, color: '#37474F', fontSize: '0.95rem', lineHeight: 1.3 }}>
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
              borderTop: idx === 0 ? 'none' : '1px solid #ECEFF1',
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
                  color: '#546E7A',
                  fontWeight: focused ? 700 : 600,
                  lineHeight: 1.45,
                }}
              >
                Completed tasks: {tasks}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  color: '#546E7A',
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
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1.25,
        width: '100%',
        pb: 1.25,
      }}
    >
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
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>
            Hours worked (solid)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            component="span"
            sx={{
              width: 16,
              height: 16,
              borderRadius: 0.5,
              bgcolor: HOURS_ASSIGNED,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>
            Estimated hours (lighter)
          </Typography>
        </Box>
      </Box>
      <CompareSprintLegend sprintDefs={sprintDefs} />
    </Box>
  );
}

function CompareSprintLegend({ sprintDefs, dense, manySprints }) {
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
              color: '#546E7A',
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
  const n = sprintDefs?.length ?? 0;
  const c = sprintDefs[0]?.accentColor ?? '#3949AB';
  const pendingTint = alpha(c, 0.42);
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
              boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
            }}
          />
          <Typography
            sx={{
              ...CHART_LEGEND_ITEM_SX,
              color: '#546E7A',
              fontWeight: 700,
              fontSize: donePendingFont,
            }}
          >
            Completed (solid)
          </Typography>
        </Box>
        <Typography
          sx={{ color: '#B0BEC5', fontWeight: 700, fontSize: { xs: '0.85rem', sm: '0.9rem' } }}
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
              boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
            }}
          />
          <Typography
            sx={{
              ...CHART_LEGEND_ITEM_SX,
              color: '#546E7A',
              fontWeight: 700,
              fontSize: donePendingFont,
            }}
          >
            Pending (lighter)
          </Typography>
        </Box>
      </Box>
      <Box sx={{ mt: { xs: 1.3, sm: 1.55 }, '& .MuiTypography-root': { lineHeight: 1.2 } }}>
        <CompareSprintLegend sprintDefs={sprintDefs} dense manySprints={n >= 6} />
      </Box>
    </Box>
  );
}

function CompareComboLegend({ sprintDefs }) {
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
            boxShadow: '0 0 0 1px rgba(0,0,0,0.06)',
          }}
        />
        <Typography
          sx={{ ...CHART_LEGEND_ITEM_SX, color: '#455A64', fontWeight: 700, fontSize: labelSize }}
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
          sx={{ ...CHART_LEGEND_ITEM_SX, color: '#455A64', fontWeight: 700, fontSize: labelSize }}
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
        bgcolor: '#DCE3EA',
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
            borderTop: '1px solid rgba(15, 23, 42, 0.1)',
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
          color: '#B0BEC5',
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
  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 3, pb: 1, pt: 0.5 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: completedFill, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Completed tasks</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: pendingFill, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Pending tasks</Typography>
      </Box>
    </Box>
  );
}

function SingleHoursSymbolLegend() {
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
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>
          Hours worked (solid bar)
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_ASSIGNED, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>
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
  const palette =
    tone === 'workload'
      ? { bg: '#FFF8F2', border: '#FFE2CC', name: '#8A3A08', text: '#6D4C41' }
      : tone === 'hours'
        ? { bg: '#F3F8FF', border: '#DCEAFF', name: '#0D47A1', text: '#455A64' }
        : tone === 'productivity'
          ? { bg: '#F4FBF7', border: '#D7F0E1', name: '#1B5E20', text: '#455A64' }
          : { bg: '#F8FCFF', border: '#E6EEF5', name: '#1A1A1A', text: '#546E7A' };
  const cardPalettes =
    tone === 'workload'
      ? [
          { bg: '#FFF1E8', border: '#FFB98E', stripe: '#E65100' },
          { bg: '#FFEFF6', border: '#FF9FC5', stripe: '#C2185B' },
          { bg: '#EEF3FF', border: '#9DB6FF', stripe: '#3949AB' },
          { bg: '#ECFAF6', border: '#89DCC1', stripe: '#00796B' },
          { bg: '#F9F5FF', border: '#BFA2FF', stripe: '#6A1B9A' },
        ]
      : tone === 'hours'
        ? [
            { bg: '#ECF5FF', border: '#9CCDFF', stripe: '#1565C0' },
            { bg: '#EFF2FF', border: '#A8B5FF', stripe: '#303F9F' },
            { bg: '#EAF8FF', border: '#8EDCFF', stripe: '#0277BD' },
            { bg: '#F0FAF7', border: '#96E1CC', stripe: '#00695C' },
            { bg: '#F7F1FF', border: '#C8A7FF', stripe: '#7B1FA2' },
          ]
        : tone === 'productivity'
          ? [
              { bg: '#EEF9F2', border: '#9EDCB6', stripe: '#2E7D32' },
              { bg: '#F3FAEE', border: '#B7DB88', stripe: '#558B2F' },
              { bg: '#EAF8F5', border: '#93D8C6', stripe: '#00796B' },
              { bg: '#F6F8EC', border: '#CFD992', stripe: '#827717' },
              { bg: '#EFF4FF', border: '#AFC4FF', stripe: '#3949AB' },
            ]
          : [
              { bg: '#F8FCFF', border: '#BCD7EC', stripe: '#1976D2' },
              { bg: '#F7FAFF', border: '#C5D1E8', stripe: '#5C6BC0' },
              { bg: '#F6FBFA', border: '#BFE0D8', stripe: '#00897B' },
              { bg: '#FBF9FF', border: '#D2C3EA', stripe: '#8E24AA' },
            ];

  if (!rows?.length) {
    return (
      <Box sx={{ px: 0.5, pt: 0.5 }}>
        <Typography sx={{ color: '#90A4AE', fontSize: '0.78rem', fontStyle: 'italic' }}>
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
  const chartRef = useRef(null);
  const chartVisible = useInView(chartRef, {
    once: true,
    margin: '0px 0px -12% 0px',
    amount: 0.12,
  });
  const a = accent ?? '#5C6BC0';
  const bg = tint ?? 'rgba(92, 107, 192, 0.06)';
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
        border: '1px solid #E4E7ED',
        borderLeft: `5px solid ${a}`,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: `linear-gradient(135deg, ${bg} 0%, #FFFFFF 48%)`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
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
        <Typography sx={{ ...CHART_DESC_SX, mb: descMb, maxWidth: '68ch' }}>
          {description}
        </Typography>
      ) : null}

      {belowDescription != null ? (
        <Box
          sx={{
            width: '100%',
            mb: { xs: 1.75, sm: 2.25 },
            mt: 0.25,
            px: { xs: 1.25, sm: 1.75 },
            py: { xs: 1.25, sm: 1.5 },
            borderRadius: 2,
            bgcolor: 'rgba(15, 23, 42, 0.035)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
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
            borderTop: `1px solid rgba(15, 23, 42, 0.08)`,
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '0.7rem',
              color: '#607D8B',
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
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTaskRows, setAiTaskRows] = useState([]);
  const [aiHourRows, setAiHourRows] = useState([]);
  const [aiProductivityRows, setAiProductivityRows] = useState([]);

  const compareModel = useMemo(() => {
    if (!compareMode || !selectedSprints?.length || selectedSprints.length < 2) return null;
    return buildCompareDeveloperChartsModel(selectedSprints);
  }, [compareMode, selectedSprints]);

  const aiSprintPayload = useMemo(
    () =>
      selectedSprints.map((sp) => ({
        id: sp.id,
        shortLabel: sp.shortLabel,
        developers: (sp.developers || []).map((d) => ({
          name: d.name,
          assigned: Number(d.assigned || 0),
          completed: Number(d.completed || 0),
          hours: Number(d.hours || 0),
          assignedHoursEstimate: Number(d.assignedHoursEstimate || 0),
        })),
      })),
    [selectedSprints],
  );

  useEffect(() => {
    if (!compareMode || aiSprintPayload.length < 2) {
      setAiTaskRows([]);
      setAiHourRows([]);
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
      setAiTaskRows([]);
      setAiHourRows([]);
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
        const tasks = Array.isArray(insights.tasks) ? insights.tasks : [];
        const hours = Array.isArray(insights.hours) ? insights.hours : [];
        const productivity = Array.isArray(insights.productivity) ? insights.productivity : [];
        if (!cancelled) {
          setAiTaskRows(
            tasks.map((r, idx) => ({
              key: r?.key || `dash-task-${idx}`,
              name: r?.developerName || 'Developer',
              message: r?.message || 'No AI explanation returned.',
            })),
          );
          setAiHourRows(
            hours.map((r, idx) => ({
              key: r?.key || `dash-hour-${idx}`,
              name: r?.developerName || 'Developer',
              message: r?.message || 'No AI explanation returned.',
            })),
          );
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
          setAiTaskRows([]);
          setAiHourRows([]);
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

  const compareHoursAxis = useMemo(() => {
    if (!compareModel?.hoursRows?.length || !compareModel?.sprintDefs?.length)
      return buildHoursAxisDomainTicks(0);
    return buildHoursAxisDomainTicks(
      maxCompareHoursGrouped(compareModel.hoursRows, compareModel.sprintDefs),
    );
  }, [compareModel]);

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

  const compareComboRange = useMemo(
    () =>
      compareModel?.comboRows?.length && compareModel?.sprintDefs?.length
        ? maxCompareComboRange(compareModel.comboRows, compareModel.sprintDefs)
        : { maxTasks: 0, maxHours: 0 },
    [compareModel],
  );
  const comboExtraCompare = comboHeightExtraFromRange(
    compareComboRange.maxTasks,
    compareComboRange.maxHours,
  );

  const hasCompareData = compareModel && compareModel.workloadRows.length > 0;
  const hasSingleData = developers.length > 0;

  const singleSelectedSprintAccent = useMemo(() => {
    const sp = selectedSprints?.[0];
    return sp?.accentColor ?? '#3949AB';
  }, [selectedSprints]);

  const singleWorkloadTaskAxis = useMemo(
    () => buildTaskAxisDomainTicks(maxSingleWorkloadStack(workloadStack)),
    [workloadStack],
  );

  const compareWorkloadTaskAxis = useMemo(() => {
    if (!compareModel?.workloadRows?.length || !compareModel?.sprintDefs?.length)
      return buildTaskAxisDomainTicks(0);
    return buildTaskAxisDomainTicks(
      maxCompareWorkloadStack(compareModel.workloadRows, compareModel.sprintDefs),
    );
  }, [compareModel]);

  const nSprints = compareModel?.sprintDefs?.length ?? 1;
  const WORKLOAD_COMPARE_LEGEND_EXTRA = Math.min(44, 4 + nSprints * 9);

  const hWorkloadCompareBase = hasCompareData
    ? Math.max(
        300 + WORKLOAD_COMPARE_LEGEND_EXTRA,
        Math.min(
          680 + WORKLOAD_COMPARE_LEGEND_EXTRA,
          240 +
            compareModel.workloadRows.length * (38 + nSprints * 6) +
            WORKLOAD_COMPARE_LEGEND_EXTRA,
        ),
      )
    : null;
  const hoursScaleExtraCompare = hasCompareData
    ? Math.min(
        120,
        Math.round(0.42 * maxCompareHoursGrouped(compareModel.hoursRows, compareModel.sprintDefs)),
      )
    : 0;
  const hHoursCompareBase = hasCompareData
    ? Math.max(
        320 + WORKLOAD_COMPARE_LEGEND_EXTRA,
        Math.min(
          700 + WORKLOAD_COMPARE_LEGEND_EXTRA + hoursScaleExtraCompare,
          250 +
            compareModel.hoursRows.length * (38 + nSprints * 6) +
            WORKLOAD_COMPARE_LEGEND_EXTRA +
            hoursScaleExtraCompare,
        ),
      )
    : null;
  const hComboCompareBase = hasCompareData
    ? Math.max(
        270,
        Math.min(
          560 + comboExtraCompare,
          200 + compareModel.comboRows.length * (27 + nSprints * 3) + comboExtraCompare,
        ),
      )
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

  const maxBarCompareCap = nSprints <= 2 ? 40 : nSprints <= 3 ? 34 : 28;
  const maxBarCompare = Math.max(
    8,
    Math.min(maxBarCompareCap, Math.floor(96 / Math.max(1, nSprints))),
  );

  // ---- empty state ----

  if (!hasCompareData && !hasSingleData) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 3,
          border: '1px dashed #B0BEC5',
          textAlign: 'center',
          bgcolor: 'rgba(21, 101, 192, 0.04)',
        }}
      >
        <Typography
          sx={{ color: '#546E7A', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.55 }}
        >
          No developer data for the selected sprint(s).
        </Typography>
      </Paper>
    );
  }

  // ---- modo comparación ----

  if (hasCompareData) {
    const { sprintDefs, workloadRows, hoursRows, comboRows } = compareModel;
    const firstAccent = sprintDefs[0]?.accentColor ?? '#3949AB';
    const comboAccent =
      sprintDefs[sprintDefs.length - 1]?.accentColor ?? sprintDefs[0]?.accentColor ?? '#7E57C2';

    const marginTopWorkload = Math.min(
      280,
      28 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 38 : 52) +
        (nSprints <= 2 ? 14 : nSprints <= 4 ? 26 : 44),
    );
    const marginTopHours = Math.min(
      144,
      18 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 24 : 30) +
        (nSprints <= 2 ? 12 : nSprints <= 4 ? 20 : 28),
    );
    const marginTopComboPlot = 16;
    const nDevRows = Math.max(workloadRows.length, hoursRows.length, comboRows.length);
    const bottomAxisCompare = Math.min(
      92,
      58 + Math.max(0, nSprints - 3) * 6 + Math.min(14, Math.max(0, nDevRows - 6) * 2),
    );
    const xAxisTickHeight = Math.min(
      72,
      50 + Math.max(0, nSprints - 4) * 6 + Math.min(8, Math.max(0, nDevRows - 5) * 2),
    );
    const barCategoryGapCompare =
      nSprints >= 6 ? '8%' : nSprints >= 4 ? '12%' : nSprints >= 3 ? '8%' : '5%';
    /** Workload: wide bars, minimal gap between developers and sprint stacks. */
    const workloadBarCategoryGap =
      nSprints >= 6 ? '1%' : nSprints >= 4 ? '1%' : nSprints >= 3 ? '0%' : '0%';
    const workloadBarGap = 0;
    const maxBarWorkloadCompare = Math.max(
      10,
      Math.min(
        nSprints <= 2 ? 54 : nSprints <= 3 ? 46 : nSprints <= 5 ? 38 : 32,
        Math.floor(124 / Math.max(1, nSprints)),
      ),
    );
    const marginTopWorkloadTight = Math.max(68, marginTopWorkload - 26);
    const lineStrokeW = nSprints > 5 ? 1.5 : 2;
    const lineDotR = nSprints > 5 ? 2 : nSprints > 3 ? 3 : 4;

    const aiEmptyText = aiError || 'Select at least 2 sprints to compare.';

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
        {/* ── Workload ── */}
        <ChartShell
          title="Assigned workload by developer"
          description={CHART_DESC.compare.workload}
          height={hWorkload}
          accent={firstAccent}
          tint={alpha(firstAccent, 0.08)}
          footerTitle="AI summary: completed-task variation by developer"
          footer={
            <AIDeveloperVariationGrid
              rows={aiTaskRows}
              loading={aiLoading}
              emptyText={aiEmptyText}
              tone="workload"
            />
          }
        >
          <BarChart
            data={workloadRows}
            margin={{ top: marginTopWorkloadTight, right: 24, left: 8, bottom: bottomAxisCompare }}
            barCategoryGap={workloadBarCategoryGap}
            barGap={workloadBarGap}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={CHART_TICK}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeight}
              tickMargin={12}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: '#546E7A',
                ...CHART_AXIS_LABEL,
                fontSize: 15,
              }}
            />
            <YAxis
              type="number"
              allowDecimals={false}
              domain={compareWorkloadTaskAxis.domain}
              ticks={compareWorkloadTaskAxis.ticks}
              tick={CHART_TICK}
              tickMargin={8}
              width={52}
              label={{
                value: 'Tasks',
                angle: -90,
                position: 'insideLeft',
                fill: '#546E7A',
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
                marginBottom: -10,
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
                />
                <Bar
                  stackId={`sp-${sp.id}`}
                  dataKey={`wo_${sp.id}`}
                  name={`${sp.shortLabel} · pending`}
                  fill={alpha(sp.accentColor, 0.42)}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarWorkloadCompare}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                />
              </React.Fragment>
            ))}
          </BarChart>
        </ChartShell>

        {/* ── Hours ── */}
        <ChartShell
          title="Hours worked by developer"
          description={CHART_DESC.compare.hours}
          height={hHours}
          accent="#FB8C00"
          tint="rgba(251, 140, 0, 0.1)"
          footerTitle="AI summary: worked-hours variation by developer"
          footer={
            <AIDeveloperVariationGrid
              rows={aiHourRows}
              loading={aiLoading}
              emptyText={aiEmptyText}
              tone="hours"
            />
          }
        >
          <BarChart
            data={hoursRows}
            margin={{ top: marginTopHours, right: 12, left: 8, bottom: bottomAxisCompare }}
            barCategoryGap={barCategoryGapCompare}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={CHART_TICK}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeight}
              tickMargin={12}
              label={{
                value: 'Developer',
                position: 'insideBottom',
                offset: -4,
                fill: '#546E7A',
                ...CHART_AXIS_LABEL,
                fontSize: 15,
              }}
            />
            <YAxis
              type="number"
              domain={compareHoursAxis.domain}
              ticks={compareHoursAxis.ticks}
              tick={CHART_TICK}
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
              wrapperStyle={{ ...CHART_LEGEND_STYLE, top: 6, paddingBottom: 14 }}
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
                />
                <Bar
                  dataKey={`ha_${sp.id}`}
                  name={`${sp.shortLabel} · estimated hours`}
                  fill={alpha(sp.accentColor, 0.42)}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarCompare}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                />
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
          tint={alpha(comboAccent, 0.08)}
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
            margin={{ top: marginTopComboPlot, right: 22, left: 10, bottom: bottomAxisCompare }}
            barCategoryGap={barCategoryGapCompare}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="shortName"
              tick={CHART_TICK}
              interval={0}
              angle={-32}
              textAnchor="end"
              height={xAxisTickHeight}
              tickMargin={12}
            />
            <YAxis
              yAxisId="tasks"
              tick={CHART_TICK}
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
              tick={CHART_TICK}
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
                maxBarSize={Math.max(8, maxBarCompare)}
                animationDuration={CHART_BAR_ANIM_MS}
                animationEasing={CHART_BAR_EASING}
                activeBar={false}
              />
            ))}
            {sprintDefs.map((sp) => (
              <Line
                key={`ln-${sp.id}`}
                yAxisId="hrs"
                type="monotone"
                dataKey={`ln_${sp.id}`}
                name={`${sp.shortLabel} · hours`}
                stroke={sp.accentColor}
                strokeWidth={lineStrokeW}
                animationDuration={CHART_BAR_ANIM_MS}
                dot={{ r: lineDotR, fill: sp.accentColor, strokeWidth: 0 }}
              />
            ))}
          </ComposedChart>
        </ChartShell>
      </Box>
    );
  }

  // ---- modo single sprint ----

  const workloadPendingTint = alpha(singleSelectedSprintAccent, 0.42);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
      <ChartShell
        title="Assigned workload by developer"
        description={CHART_DESC.single.workload}
        height={hWorkload}
        accent={singleSelectedSprintAccent}
        tint={alpha(singleSelectedSprintAccent, 0.08)}
      >
        <BarChart
          layout="vertical"
          data={workloadStack}
          margin={{ top: 48, right: 24, left: 4, bottom: 56 }}
          barCategoryGap="10%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={singleWorkloadTaskAxis.domain}
            ticks={singleWorkloadTaskAxis.ticks}
            tick={CHART_TICK}
            tickMargin={10}
            label={{
              value: 'Tasks',
              position: 'bottom',
              offset: 8,
              fill: '#546E7A',
              ...CHART_AXIS_LABEL,
              fontSize: 15,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tick={{ ...CHART_TICK }}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            contentStyle={CHART_TOOLTIP_SX}
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
          />
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
          />
        </BarChart>
      </ChartShell>

      <ChartShell
        title="Hours worked by developer"
        description={CHART_DESC.single.hours}
        height={hHours}
        accent="#FB8C00"
        tint="rgba(251, 140, 0, 0.1)"
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
            tick={CHART_TICK}
            tickMargin={10}
            label={{
              value: Y_AXIS_HOURS,
              position: 'bottom',
              offset: 8,
              fill: '#546E7A',
              ...CHART_AXIS_LABEL,
              fontSize: 15,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tick={{ ...CHART_TICK }}
            tickMargin={8}
            interval={0}
          />
          <Tooltip
            {...RECHARTS_BAR_TOOLTIP_PROPS}
            contentStyle={CHART_TOOLTIP_SX}
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
          />
          <Bar
            dataKey="hAssigned"
            name="Estimated hours"
            fill={HOURS_ASSIGNED}
            radius={[6, 0, 0, 6]}
            maxBarSize={38}
            animationDuration={CHART_BAR_ANIM_MS}
            animationEasing={CHART_BAR_EASING}
            activeBar={false}
          />
        </BarChart>
      </ChartShell>

      <ChartShell
        title="Developer productivity (tasks vs hours)"
        description={CHART_DESC.single.combo}
        height={hCombo}
        accent="#7E57C2"
        tint="rgba(126, 87, 194, 0.08)"
      >
        <ComposedChart data={forCombo} margin={{ top: 12, right: 22, left: 10, bottom: 82 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="shortName"
            tick={CHART_TICK}
            interval={0}
            angle={-32}
            textAnchor="end"
            height={80}
            tickMargin={12}
          />
          <YAxis
            yAxisId="tasks"
            tick={CHART_TICK}
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
            tick={CHART_TICK}
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
            contentStyle={CHART_TOOLTIP_SX}
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
          />
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
