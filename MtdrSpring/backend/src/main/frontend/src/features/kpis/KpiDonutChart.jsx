import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

/** Chart arc color (indigo — avoid red/green in chart fills). */
const CHART_ARC = '#3949AB';

/**
 * Donut gauge 0–100 (arc fill). Default size matches KPI cards; pass larger radii for emphasis.
 */
export default function KpiDonutChart({
  pct,
  displayValue,
  displaySuffix,
  arcColor = CHART_ARC,
  height = { xs: 150, sm: 168 },
  innerRadius = 54,
  outerRadius = 72,
  width = { xs: '100%', sm: 200 },
  maxWidth = 280,
  valueFontSize = { xs: '1.65rem', sm: '1.85rem' },
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const p = Math.min(100, Math.max(0, Number(pct)));
  const data = [
    { name: 'score', value: p },
    { name: 'rest', value: 100 - p },
  ];

  // Color para la parte "restante" del donut
  const restFill = isDark ? '#2A2C32' : '#F0F0F0';

  return (
    <Box
      sx={{
        position: 'relative',
        width,
        maxWidth,
        height,
        mx: { xs: 'auto', sm: 0 },
        flexShrink: 0,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={arcColor} />
            <Cell fill={restFill} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <Typography
          sx={{
            fontSize: valueFontSize,
            fontWeight: 800,
            color: 'text.primary',
            lineHeight: 1,
          }}
        >
          {displayValue}
        </Typography>
        {displaySuffix ? (
          <Typography variant="caption" sx={{ color: isDark ? '#9A9A9A' : '#888', fontWeight: 600 }}>
            {displaySuffix}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}