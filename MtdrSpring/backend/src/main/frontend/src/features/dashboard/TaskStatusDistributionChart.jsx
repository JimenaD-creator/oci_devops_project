import React, { useMemo, useRef } from 'react';
import { useInView } from 'framer-motion';
import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ListTodo } from 'lucide-react';
import { RECHARTS_TOOLTIP_PROPS, CHART_DESC_SX } from './dashboardTypography';

const CHART_CARD_ACCENT = '#1565C0';

const CHART_HEIGHT = 172;
const PIE_OUTER_RADIUS = 62;
/** Larger pie when shown beside scorecards (DashboardPage). */
const CHART_HEIGHT_EMBEDDED = 300;
const PIE_OUTER_RADIUS_EMBEDDED = 118;
const PIE_ANIM_MS = 1000;

const cardBase = {
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #EFEFEF',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  padding: '1.05rem 1.2rem',
  overflow: 'hidden',
};

function StatusTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const fill = row.fill || CHART_CARD_ACCENT;
  const pct = typeof row.percent === 'number' ? `${Math.round(row.percent * 100)}%` : '';
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        borderRadius: 1,
        px: 1.5,
        py: 1.25,
        fontSize: 14,
        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        border: '2px solid',
        borderColor: fill,
      }}
    >
      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: fill, lineHeight: 1.2 }}>
        {row.name}
      </Typography>
      <Typography sx={{ mt: 0.75, fontSize: '1.05rem', fontWeight: 800, color: fill }}>
        {row.value} tasks{pct ? ` · ${pct}` : ''}
      </Typography>
    </Box>
  );
}

/**
 * Full pie chart (not donut): task counts by status. Tooltips use each status color.
 * @param {{ embedded?: boolean, caption?: string }} props — optional line under title or above chart when embedded.
 */
export default function TaskStatusDistributionChart({
  distribution = [],
  total = 0,
  embedded = false,
  caption,
}) {
  const embeddedCaption = caption ?? 'Task counts by workflow stage for the current sprint.';
  const hasTasks = total > 0;
  const plotHeight = embedded ? CHART_HEIGHT_EMBEDDED : CHART_HEIGHT;
  const pieRadius = embedded ? PIE_OUTER_RADIUS_EMBEDDED : PIE_OUTER_RADIUS;

  const plotRef = useRef(null);
  const plotInView = useInView(plotRef, {
    once: true,
    margin: '0px 0px -12% 0px',
    amount: 0.15,
  });

  const pieData = useMemo(
    () =>
      distribution
        .filter((d) => d.count > 0)
        .map((d) => ({
          name: d.name,
          value: d.count,
          fill: d.color,
        })),
    [distribution],
  );

  const renderSliceLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    value,
    fill,
    payload,
  }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const ir = innerRadius ?? 0;
    const or = outerRadius ?? 0;
    const radius = ir + (or - ir) * 0.58;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const c = fill || payload?.fill || '#1A1A1A';
    return (
      <text
        x={x}
        y={y}
        fill={c}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={800}
      >
        {value}
      </text>
    );
  };

  return (
    <div
      style={{
        ...cardBase,
        borderTop: embedded ? 'none' : `3px solid ${CHART_CARD_ACCENT}`,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: embedded ? 1 : undefined,
        minHeight: 0,
        boxSizing: 'border-box',
        padding: embedded ? '0.25rem 0 0 0' : cardBase.padding,
      }}
    >
      {!embedded ? (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}
        >
          <div
            style={{
              width: '2.65rem',
              height: '2.65rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(21, 101, 192, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ListTodo style={{ width: '1.35rem', height: '1.35rem', color: CHART_CARD_ACCENT }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: '#1A1A1A',
                fontSize: '1.125rem',
                lineHeight: 1.35,
                letterSpacing: '-0.02em',
              }}
            >
              Tasks by status
            </Typography>
            <Typography sx={{ ...CHART_DESC_SX, mt: 0.35, display: 'block' }}>
              How workload is split across task stages.
            </Typography>
          </div>
        </div>
      ) : (
        <Typography
          sx={{ ...CHART_DESC_SX, textAlign: 'center', width: '100%', mb: 1.25, px: 0.5 }}
        >
          {embeddedCaption}
        </Typography>
      )}

      <Box
        ref={plotRef}
        sx={{
          width: '100%',
          height: plotHeight,
          minHeight: plotHeight,
          flexShrink: 0,
          flex: embedded ? 1 : undefined,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasTasks && pieData.length > 0 && plotInView ? (
          <ResponsiveContainer width="100%" height={plotHeight}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={pieRadius}
                paddingAngle={2}
                labelLine={false}
                label={renderSliceLabel}
                animationDuration={PIE_ANIM_MS}
                animationEasing="ease-out"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={entry.fill}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip {...RECHARTS_TOOLTIP_PROPS} content={<StatusTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: plotHeight,
              minHeight: plotHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #B39DDB',
              borderRadius: 2,
              bgcolor: '#F3E5F5',
            }}
          >
            <Typography sx={{ color: '#6A1B9A', fontWeight: 600, fontSize: '0.95rem' }}>
              No tasks in this sprint
            </Typography>
          </Box>
        )}
      </Box>

      {hasTasks ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: embedded ? 'wrap' : 'nowrap',
            gap: embedded ? '0.5rem 1rem' : '0.35rem 0.75rem',
            justifyContent: 'center',
            alignItems: 'center',
            mt: embedded ? 1.25 : 0.65,
            overflowX: 'auto',
            flexShrink: 0,
            width: '100%',
          }}
        >
          {distribution.map((d) => (
            <Typography
              key={d.key}
              component="span"
              sx={{
                fontSize: '1rem',
                color: d.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                fontWeight: 700,
              }}
            >
              <Box
                component="span"
                sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: d.color }}
              />
              {d.name}: {d.count}
            </Typography>
          ))}
        </Box>
      ) : null}
    </div>
  );
}
