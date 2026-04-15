import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ListTodo } from 'lucide-react';

const ORACLE_RED = '#C74634';

const CHART_HEIGHT = 158;
const PIE_OUTER_RADIUS = 62;

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
  const fill = row.fill || ORACLE_RED;
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
 */
export default function TaskStatusDistributionChart({ distribution = [], total = 0 }) {
  const hasTasks = total > 0;

  const pieData = useMemo(
    () =>
      distribution
        .filter((d) => d.count > 0)
        .map((d) => ({
          name: d.name,
          value: d.count,
          fill: d.color,
        })),
    [distribution]
  );

  const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, value, fill, payload }) => {
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
        fontSize={10}
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
        borderTop: `3px solid ${ORACLE_RED}`,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.45rem' }}>
        <div
          style={{
            width: '2.65rem',
            height: '2.65rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(199,70,52,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ListTodo style={{ width: '1.35rem', height: '1.35rem', color: ORACLE_RED }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1A1A1A', fontSize: '0.9rem', lineHeight: 1.3 }}>
            Tasks by status
          </Typography>
          <Typography sx={{ fontSize: '0.72rem', color: '#1565C0', mt: 0.15, fontWeight: 600, lineHeight: 1.3 }}>
            To Do · In Progress · In Review · Done
          </Typography>
        </div>
      </div>

      <Box
        sx={{
          width: '100%',
          height: CHART_HEIGHT,
          minHeight: CHART_HEIGHT,
          flexShrink: 0,
        }}
      >
        {hasTasks && pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={PIE_OUTER_RADIUS}
                paddingAngle={2}
                labelLine={false}
                label={renderSliceLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<StatusTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: CHART_HEIGHT,
              minHeight: CHART_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #B39DDB',
              borderRadius: 2,
              bgcolor: '#F3E5F5',
            }}
          >
            <Typography sx={{ color: '#6A1B9A', fontWeight: 600, fontSize: '0.8rem' }}>
              No tasks in this sprint
            </Typography>
          </Box>
        )}
      </Box>

      {hasTasks ? (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: '0.35rem 0.75rem',
            justifyContent: 'center',
            alignItems: 'center',
            mt: 0.65,
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
                fontSize: '0.75rem',
                color: d.color,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                fontWeight: 700,
              }}
            >
              <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: d.color }} />
              {d.name}: {d.count}
            </Typography>
          ))}
        </Box>
      ) : null}
    </div>
  );
}
