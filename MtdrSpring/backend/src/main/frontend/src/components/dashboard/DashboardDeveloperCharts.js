import React, { useMemo, useRef } from 'react';
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

const MotionPaper = motion(Paper);

/** One line under chart titles — what the reader should take away. */
const CHART_DESC = {
  compare: {
    workload:
      'Completed vs pending tasks per developer; bars are stacked by sprint color.',
    hours:
      'Per sprint: solid bar = hours worked; lighter bar = estimated hours from task estimates.',
    combo: 'Bars show completed tasks; lines show hours — both broken down by sprint.',
  },
  single: {
    workload: 'Completed and pending tasks assigned to each developer in this sprint.',
    hours:
      'Hours worked (logged) next to estimated hours from task estimates per developer.',
    combo: 'Side-by-side view of completed tasks (bars) and hours worked (line) per developer.',
  },
};

const COMPLETED_FILL = '#5C6BC0';
const HOURS_FILL = '#FB8C00';
const HOURS_LINE = '#F57C00';
/** Planned / estimated hours (lighter bar next to worked). */
const HOURS_ASSIGNED = alpha(HOURS_FILL, 0.45);

const STACK_DONE = '#1565C0';
const STACK_PENDING = '#90CAF9';

const GRID = '#E0E0E0';

/** Recharts: bar/line growth when the plot mounts in view. */
const CHART_BAR_ANIM_MS = 950;
const CHART_BAR_EASING = 'ease-out';

const Y_AXIS_HOURS = 'Hours';

function maxCompareWorkloadStack(rows, sprintDefs) {
  let m = 0;
  if (!rows?.length || !sprintDefs?.length) return m;
  for (const row of rows) {
    for (const sp of sprintDefs) {
      const h = (Number(row[`wc_${sp.id}`]) || 0) + (Number(row[`wo_${sp.id}`]) || 0);
      m = Math.max(m, h);
    }
  }
  return m;
}

function maxSingleWorkloadStack(rows) {
  let m = 0;
  for (const row of rows || []) {
    m = Math.max(m, (Number(row.completed) || 0) + (Number(row.pending) || 0));
  }
  return m;
}

function buildTaskAxisDomainTicks(maxStack) {
  const padded = Math.max(maxStack * 1.25, maxStack + 3, 8);
  /** Mismo tope que con ticks de 1 en 1 (ceil del padded). */
  const domainMax = Math.max(1, Math.ceil(padded));
  /** Ticks más separados: nunca de 1 en 1; el dominio [0, domainMax] no cambia. */
  let step = 2;
  if (domainMax > 48) step = 5;
  if (domainMax > 120) step = 10;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

function maxSingleHoursGrouped(rows) {
  let m = 0;
  for (const row of rows || []) {
    const a = Number(row.hWorked) || 0;
    const b = Number(row.hAssigned) || 0;
    m = Math.max(m, a, b);
  }
  return m;
}

function maxCompareHoursGrouped(rows, sprintDefs) {
  let m = 0;
  if (!rows?.length || !sprintDefs?.length) return m;
  for (const row of rows) {
    for (const sp of sprintDefs) {
      const id = sp.id;
      const w = Number(row[`hw_${id}`] || 0);
      const a = Number(row[`ha_${id}`] || 0);
      m = Math.max(m, w, a);
    }
  }
  return m;
}

/** Same tick strategy as tasks axis, for hour totals on stacked bullet bars. */
function buildHoursAxisDomainTicks(maxHours) {
  const padded = Math.max(maxHours * 1.45, maxHours + 4, 10);
  const domainMax = Math.max(1, Math.ceil(padded));
  let step = 4;
  if (domainMax > 40) step = 6;
  if (domainMax > 80) step = 10;
  if (domainMax > 160) step = 20;
  const ticks = [];
  for (let v = 0; v < domainMax; v += step) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== domainMax) ticks.push(domainMax);
  return { domain: [0, domainMax], ticks, domainMax };
}

function maxSingleComboRange(developers) {
  let maxT = 0;
  let maxH = 0;
  for (const d of developers || []) {
    maxT = Math.max(maxT, Number(d.completed) || 0);
    maxH = Math.max(maxH, Number(d.hours) || 0);
  }
  return { maxTasks: maxT, maxHours: maxH };
}

function maxCompareComboRange(comboRows, sprintDefs) {
  let maxT = 0;
  let maxH = 0;
  if (!comboRows?.length || !sprintDefs?.length) return { maxTasks: 0, maxHours: 0 };
  for (const row of comboRows) {
    for (const sp of sprintDefs) {
      maxT = Math.max(maxT, Number(row[`cb_${sp.id}`]) || 0);
      maxH = Math.max(maxH, Number(row[`ln_${sp.id}`]) || 0);
    }
  }
  return { maxTasks: maxT, maxHours: maxH };
}

/** Extra chart height when task/hour values are large (dual-axis combo needs more vertical room). */
function comboHeightExtraFromRange(maxTasks, maxHours) {
  const t = Math.max(0, Number(maxTasks) || 0);
  const h = Math.max(0, Number(maxHours) || 0);
  if (t === 0 && h === 0) return 0;
  return Math.min(220, Math.round(8 + 3.2 * t + 1.2 * h));
}

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
              sx={{
                color: sp.accentColor,
                fontSize: '0.84rem',
                mt: 0.35,
                fontWeight: 600,
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
            sx={{
              width: 16,
              height: 16,
              borderRadius: 0.5,
              bgcolor: HOURS_FILL,
              flexShrink: 0,
            }}
          />
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Hours worked (solid)</Typography>
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
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Estimated hours (lighter)</Typography>
        </Box>
      </Box>
      <CompareSprintLegend sprintDefs={sprintDefs} />
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
              <Typography sx={{ fontSize: '0.82rem', color: '#546E7A', fontWeight: focused ? 700 : 600, lineHeight: 1.45 }}>
                Completed tasks: {tasks}
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', color: '#546E7A', fontWeight: focused ? 700 : 600, lineHeight: 1.45 }}>
                Hours: {hours.toFixed(1)} h
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Height derived from selection (sprints × devs). Only extra‑small viewports get a slight shrink;
 * from `sm` (600px) up — tablet/escritorio — se usa el 100 % del valor calculado.
 */
function compareChartHeights(base) {
  const b = Math.max(280, base);
  return {
    xs: Math.round(Math.max(280, b * 0.9)),
    sm: Math.round(b),
  };
}

function ChartShell({ title, description, height, children, accent, tint, compact, belowDescription }) {
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
      : { width: '100%', minWidth: 0, overflow: 'visible', height: typeof height === 'number' ? height : 400 };
  const descMb = belowDescription != null ? 1.25 : compact ? 1 : 1.35;
  const chartMt = belowDescription != null ? 0 : compact ? 0.25 : description ? 0.25 : 0.5;
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
      <Typography sx={{ ...CHART_TITLE_SX, color: a, mb: description ? 0.5 : 1.5 }}>
        {title}
      </Typography>
      {description ? (
        <Typography
          sx={{
            ...CHART_DESC_SX,
            mb: descMb,
            maxWidth: '68ch',
          }}
        >
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

function CompareSprintLegend({ sprintDefs, dense, manySprints }) {
  const n = sprintDefs?.length ?? 0;
  const squeeze = Boolean(manySprints) || (dense && n >= 6);
  const chip = squeeze ? 14 : 16;
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: squeeze
          ? { xs: 0.5, sm: 0.75 }
          : dense
            ? { xs: 0.75, sm: 1.25 }
            : { xs: 1.25, sm: 2 },
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

/** One block per sprint; wraps in columns on wide screens so 3+ sprints do not stack excessively tall. */
function CompareWorkloadSymbolLegend({ sprintDefs, compact: legendCompact }) {
  const tight = Boolean(legendCompact);
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: tight ? { xs: 1, sm: 1.25 } : { xs: 1.25, sm: 1.75 },
        rowGap: tight ? 0.75 : 1.25,
        pt: 0,
        pb: tight ? 1.25 : 2.5,
        px: { xs: 0.5, sm: 1 },
      }}
    >
      {sprintDefs.map((sp) => (
        <Box
          key={sp.id}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.5,
            minWidth: { xs: '100%', sm: 200, md: 210 },
            maxWidth: { xs: '100%', md: 280 },
            flex: { xs: '1 1 100%', sm: '0 1 auto' },
          }}
        >
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, fontWeight: 800, color: '#37474F' }}>{sp.shortLabel}</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1, sm: 1.25 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                component="span"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '2px',
                  bgcolor: sp.accentColor,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                Completed
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                component="span"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '2px',
                  bgcolor: alpha(sp.accentColor, 0.42),
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A', fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                Pending
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Compare combo — bar/line keys + sprint colors; layout tightens when many sprints.
 * Rendered in ChartShell (not Recharts) so plot height stays intact.
 */
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
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#455A64', fontWeight: 700, fontSize: labelSize }}>
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
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#455A64', fontWeight: 700, fontSize: labelSize }}>
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

  const sprintStrip = (
    <CompareSprintLegend sprintDefs={sprintDefs} dense manySprints={many} />
  );

  if (splitRows) {
    return (
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: { xs: 1, sm: 1.25 } }}>
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

function SingleWorkloadSymbolLegend() {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 3,
        pb: 1,
        pt: 0.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: STACK_DONE, flexShrink: 0 }}
        />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Completed tasks</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box
          component="span"
          sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: STACK_PENDING, flexShrink: 0 }}
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
        <Box component="span" sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_FILL, flexShrink: 0 }} />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Hours worked (solid bar)</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box component="span" sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: HOURS_ASSIGNED, flexShrink: 0 }} />
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#546E7A' }}>Estimated hours (lighter bar)</Typography>
      </Box>
    </Box>
  );
}

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
  const compareModel = useMemo(() => {
    if (!compareMode || !selectedSprints?.length || selectedSprints.length < 2) return null;
    return buildCompareDeveloperChartsModel(selectedSprints);
  }, [compareMode, selectedSprints]);

  const compareHoursAxis = useMemo(() => {
    if (!compareModel?.hoursRows?.length || !compareModel?.sprintDefs?.length) {
      return buildHoursAxisDomainTicks(0);
    }
    return buildHoursAxisDomainTicks(
      maxCompareHoursGrouped(compareModel.hoursRows, compareModel.sprintDefs)
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
          Math.max(a.hours ?? 0, a.assignedHoursEstimate ?? 0)
      );
  }, [developers]);

  /** Grouped: hours worked vs estimated hours (task estimates). */
  const hoursGroupedRows = useMemo(() => {
    return byHoursDesc
      .map((d) => {
        const assigned = Number(d.assignedHoursEstimate) || 0;
        const worked = Number(d.hours) || 0;
        const pct =
          assigned > 0 ? Math.min(100, Math.round((100 * worked) / assigned)) : worked > 0 ? 100 : 0;
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
    [hoursGroupedRows]
  );

  const forCombo = useMemo(() => {
    return [...developers].sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0));
  }, [developers]);

  const singleComboRange = useMemo(() => maxSingleComboRange(forCombo), [forCombo]);
  const comboExtraSingle = comboHeightExtraFromRange(singleComboRange.maxTasks, singleComboRange.maxHours);

  const compareComboRange = useMemo(
    () =>
      compareModel?.comboRows?.length && compareModel?.sprintDefs?.length
        ? maxCompareComboRange(compareModel.comboRows, compareModel.sprintDefs)
        : { maxTasks: 0, maxHours: 0 },
    [compareModel]
  );
  const comboExtraCompare = comboHeightExtraFromRange(compareComboRange.maxTasks, compareComboRange.maxHours);

  const hasCompareData = compareModel && compareModel.workloadRows.length > 0;
  const hasSingleData = developers.length > 0;

  const singleWorkloadTaskAxis = useMemo(
    () => buildTaskAxisDomainTicks(maxSingleWorkloadStack(workloadStack)),
    [workloadStack]
  );

  const compareWorkloadTaskAxis = useMemo(() => {
    if (!compareModel?.workloadRows?.length || !compareModel?.sprintDefs?.length) {
      return buildTaskAxisDomainTicks(0);
    }
    return buildTaskAxisDomainTicks(
      maxCompareWorkloadStack(compareModel.workloadRows, compareModel.sprintDefs)
    );
  }, [compareModel]);

  const nSprints = compareModel?.sprintDefs?.length ?? 1;
  /** Extra chart pixels for compare mode: more when many sprints; little when few (avoids “floating” legend). */
  const WORKLOAD_COMPARE_LEGEND_EXTRA = Math.min(44, 4 + nSprints * 9);

  /** Altura total más contenida; pocas filas de devs no fuerzan un canvas enorme. */
  const hWorkloadCompareBase = hasCompareData
    ? Math.max(
        330 + WORKLOAD_COMPARE_LEGEND_EXTRA,
        Math.min(
          740 + WORKLOAD_COMPARE_LEGEND_EXTRA,
          270 + compareModel.workloadRows.length * (42 + nSprints * 7) + WORKLOAD_COMPARE_LEGEND_EXTRA
        )
      )
    : null;
  const hoursScaleExtraCompare = hasCompareData
    ? Math.min(
        120,
        Math.round(0.42 * maxCompareHoursGrouped(compareModel.hoursRows, compareModel.sprintDefs))
      )
    : 0;
  const hHoursCompareBase = hasCompareData
    ? Math.max(
        370 + WORKLOAD_COMPARE_LEGEND_EXTRA,
        Math.min(
          760 + WORKLOAD_COMPARE_LEGEND_EXTRA + hoursScaleExtraCompare,
          290 + compareModel.hoursRows.length * (42 + nSprints * 7) + WORKLOAD_COMPARE_LEGEND_EXTRA + hoursScaleExtraCompare
        )
      )
    : null;
  const hComboCompareBase = hasCompareData
    ? Math.max(
        300,
        Math.min(
          620 + comboExtraCompare,
          220 + compareModel.comboRows.length * (30 + nSprints * 4) + comboExtraCompare
        )
      )
    : null;

  const hoursScaleExtraSingle = Math.min(120, Math.round(0.5 * maxSingleHoursGrouped(hoursGroupedRows)));
  const hWorkloadSingleBase = Math.max(340, Math.min(700, 235 + workloadStack.length * 42));
  const hHoursSingleBase = Math.max(
    340,
    Math.min(700, 235 + hoursGroupedRows.length * 42 + hoursScaleExtraSingle)
  );
  const hComboSingleBase = Math.max(
    320,
    Math.min(520 + comboExtraSingle, 240 + forCombo.length * 38 + comboExtraSingle)
  );

  const hWorkload = hasCompareData
    ? compareChartHeights(hWorkloadCompareBase)
    : compareChartHeights(hWorkloadSingleBase);
  const hHours = hasCompareData ? compareChartHeights(hHoursCompareBase) : compareChartHeights(hHoursSingleBase);
  const hCombo = hasCompareData ? compareChartHeights(hComboCompareBase) : compareChartHeights(hComboSingleBase);

  /** Pocos sprints → barras más gruesas (tope mayor + menos hueco entre categorías abajo). */
  const maxBarCompareCap = nSprints <= 2 ? 40 : nSprints <= 3 ? 34 : 28;
  const maxBarCompare = Math.max(
    8,
    Math.min(maxBarCompareCap, Math.floor(96 / Math.max(1, nSprints)))
  );

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
        <Typography sx={{ color: '#546E7A', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.55 }}>
          No developer data for the selected sprint(s).
        </Typography>
      </Paper>
    );
  }

  if (hasCompareData) {
    const { sprintDefs, workloadRows, hoursRows, comboRows } = compareModel;
    const firstAccent = sprintDefs[0]?.accentColor ?? '#3949AB';
    const comboAccent = sprintDefs[sprintDefs.length - 1]?.accentColor ?? sprintDefs[0]?.accentColor ?? '#7E57C2';

    const marginTopWorkload = Math.min(
      280,
      28 +
        Math.ceil(nSprints / 2) * (nSprints <= 3 ? 38 : 52) +
        (nSprints <= 2 ? 14 : nSprints <= 4 ? 26 : 44)
    );
    const marginTopHours = Math.min(
      144,
      18 + Math.ceil(nSprints / 2) * (nSprints <= 3 ? 24 : 30) + (nSprints <= 2 ? 12 : nSprints <= 4 ? 20 : 28)
    );
    /** Combo plot margin only (simbología va en ChartShell, bajo el subtítulo). */
    const marginTopComboPlot = 16;
    const nDevRows = Math.max(workloadRows.length, hoursRows.length, comboRows.length);
    const bottomAxisCompare = Math.min(
      132,
      84 + Math.max(0, nSprints - 3) * 8 + Math.min(24, Math.max(0, nDevRows - 6) * 3)
    );
    const xAxisTickHeight = Math.min(
      104,
      74 + Math.max(0, nSprints - 4) * 10 + Math.min(12, Math.max(0, nDevRows - 5) * 2)
    );
    /** Menos hueco entre desarrolladores cuando hay pocos sprints → barras más anchas. */
    const barCategoryGapCompare =
      nSprints >= 6 ? '8%' : nSprints >= 4 ? '12%' : nSprints >= 3 ? '8%' : '5%';
    const lineStrokeW = nSprints > 5 ? 1.5 : 2;
    const lineDotR = nSprints > 5 ? 2 : nSprints > 3 ? 3 : 4;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
        <ChartShell
          title="Assigned workload by developer"
          description={CHART_DESC.compare.workload}
          height={hWorkload}
          accent={firstAccent}
          tint={alpha(firstAccent, 0.08)}
        >
          <BarChart
            data={workloadRows}
            margin={{ top: marginTopWorkload, right: 24, left: 8, bottom: bottomAxisCompare }}
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
                paddingBottom: nSprints <= 3 ? 4 : 12,
                top: nSprints <= 3 ? 0 : 4,
              }}
              content={() => (
                <CompareWorkloadSymbolLegend sprintDefs={sprintDefs} compact={nSprints <= 3} />
              )}
            />
            {sprintDefs.map((sp) => (
              <React.Fragment key={`w-${sp.id}`}>
                <Bar
                  stackId={`sp-${sp.id}`}
                  dataKey={`wc_${sp.id}`}
                  name={`${sp.shortLabel} · completed`}
                  fill={sp.accentColor}
                  radius={[0, 0, 0, 0]}
                  maxBarSize={maxBarCompare}
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
                  maxBarSize={maxBarCompare}
                  animationDuration={CHART_BAR_ANIM_MS}
                  animationEasing={CHART_BAR_EASING}
                  activeBar={false}
                />
              </React.Fragment>
            ))}
          </BarChart>
        </ChartShell>

        <ChartShell
          title="Hours worked by developer"
          description={CHART_DESC.compare.hours}
          height={hHours}
          accent="#FB8C00"
          tint="rgba(251, 140, 0, 0.1)"
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

        <ChartShell
          title="Developer productivity (tasks vs hours)"
          description={CHART_DESC.compare.combo}
          belowDescription={<CompareComboLegend sprintDefs={sprintDefs} />}
          height={hCombo}
          accent={comboAccent}
          tint={alpha(comboAccent, 0.08)}
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 0 }}>
      <ChartShell
        title="Assigned workload by developer"
        description={CHART_DESC.single.workload}
        height={hWorkload}
        accent="#2E7D32"
        tint="rgba(46, 125, 50, 0.08)"
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
            content={() => <SingleWorkloadSymbolLegend />}
          />
          <Bar
            stackId="load"
            dataKey="completed"
            name="Completed tasks"
            fill={STACK_DONE}
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
            fill={STACK_PENDING}
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
              return `${row.name} · ${row.pctOfPlan}% of plan`;
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
