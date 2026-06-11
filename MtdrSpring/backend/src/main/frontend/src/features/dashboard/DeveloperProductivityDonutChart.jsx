import React, { useMemo } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TrendingUp } from 'lucide-react';
import KpiDonutChart from '../kpis/KpiDonutChart';
import {
  formatEfficiencyScoreDisplay,
  formatProductivityScoreDisplay,
  normalizeEfficiencyPercent,
} from '../kpis/productivityScoreUtils';
import { completionRateProgressColor } from './constants/dashboardConstants';
import { CHART_DESC_SX } from './dashboardTypography';

const PRODUCTIVITY_COMPONENTS = [
  { key: 'completionRate', label: 'Completion rate', weight: 'x0.45', color: '#1565C0' },
  { key: 'onTimeDelivery', label: 'On-time delivery', weight: 'x0.35', color: '#1D9E75' },
  { key: 'efficiencyScore', label: 'Efficiency score', weight: 'x0.2', color: '#8E24AA' },
];

function formatComponentPct(key, value) {
  if (key === 'efficiencyScore') return formatEfficiencyScoreDisplay(value);
  return `${Math.round(value)}%`;
}

function ProductivityBreakdown({ components, compact = false, emphasized = false }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const spacing = compact ? 0.75 : emphasized ? 2 : 1.5;
  const cardPadding = compact ? 0.85 : emphasized ? 1.75 : 1.25;
  const labelGap = compact ? 0.45 : emphasized ? 1 : 0.75;
  const labelFontSize = compact ? '0.625rem' : emphasized ? '0.8125rem' : '0.7rem';
  const barHeight = compact ? 4 : emphasized ? 8 : 5;
  const valueFontSize = compact ? '0.6875rem' : emphasized ? '0.9375rem' : '0.75rem';
  const valueMinWidth = emphasized ? 36 : 28;

  return (
    <Grid container spacing={spacing} sx={{ width: '100%' }}>
      {components.map(({ key, label, value, weight, color }) => (
        <Grid item xs={12} sm={4} key={label}>
          <Box
            sx={{
              bgcolor: isDark ? '#16181C' : '#F8F9FA',
              borderRadius: emphasized ? 1.5 : 1.25,
              p: cardPadding,
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: labelGap }}>
              <Typography
                sx={{
                  fontSize: labelFontSize,
                  color: isDark ? '#9A9A9A' : '#607D8B',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontSize: labelFontSize,
                  color: '#90A4AE',
                  flexShrink: 0,
                  ml: 0.5,
                }}
              >
                {weight}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: emphasized ? 1 : 0.75 }}>
              <Box
                sx={{
                  flex: 1,
                  height: barHeight,
                  bgcolor: isDark ? '#2A2C32' : '#E0E0E0',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, key === 'efficiencyScore' ? normalizeEfficiencyPercent(value) : value))}%`,
                    bgcolor: color,
                    borderRadius: 99,
                  }}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: valueFontSize,
                  fontWeight: 700,
                  color: 'text.primary',
                  minWidth: valueMinWidth,
                  textAlign: 'right',
                }}
              >
                {formatComponentPct(key, value)}
              </Typography>
            </Box>
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Donut gauge for an individual developer's productivity score (embedded beside scorecards).
 */
export default function DeveloperProductivityDonutChart({
  score = 0,
  completionRate = 0,
  onTimeDelivery = 0,
  efficiencyScore = 0,
  embedded = false,
  wide = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const normalizedScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)));
  const arcColor = completionRateProgressColor(normalizedScore);

  const componentValues = useMemo(
    () => ({
      completionRate: Math.min(100, Math.max(0, Math.round(Number(completionRate) || 0))),
      onTimeDelivery: Math.min(100, Math.max(0, Math.round(Number(onTimeDelivery) || 0))),
      efficiencyScore: normalizeEfficiencyPercent(efficiencyScore),
    }),
    [completionRate, onTimeDelivery, efficiencyScore],
  );

  const components = useMemo(
    () =>
      PRODUCTIVITY_COMPONENTS.map(({ key, label, weight, color }) => ({
        key,
        label,
        weight,
        color,
        value: componentValues[key],
      })),
    [componentValues],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: embedded ? 'auto' : '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        p: embedded ? '0.25rem 0 0 0' : 0,
      }}
    >
      {!embedded ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
          <Box
            sx={{
              width: '2.65rem',
              height: '2.65rem',
              borderRadius: '10px',
              bgcolor: isDark ? 'rgba(46, 125, 50, 0.15)' : 'rgba(46, 125, 50, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp style={{ width: '1.35rem', height: '1.35rem', color: arcColor }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: 'text.primary',
                fontSize: '1.125rem',
                lineHeight: 1.35,
                letterSpacing: '-0.02em',
              }}
            >
              Productivity score
            </Typography>
            <Typography sx={{ ...CHART_DESC_SX, mt: 0.35, display: 'block', color: 'text.secondary' }}>
              Individual delivery score (45% completion, 35% on-time, 20% efficiency).
            </Typography>
          </Box>
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: wide ? { sm: 'center' } : undefined,
          gap: { xs: 1.25, sm: wide ? 2.5 : 1.5 },
          width: '100%',
          maxWidth: wide ? 780 : undefined,
          mx: wide ? 'auto' : undefined,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: { xs: '100%', sm: wide ? 180 : 132 },
          }}
        >
          <KpiDonutChart
            key={`dev-productivity-${normalizedScore}-${completionRate}-${onTimeDelivery}-${efficiencyScore}`}
            pct={normalizedScore}
            displayValue={formatProductivityScoreDisplay(normalizedScore)}
            arcColor={arcColor}
            height={{ xs: 136, sm: wide ? 180 : 140 }}
            innerRadius={wide ? 58 : 46}
            outerRadius={wide ? 76 : 62}
            width={{ xs: 136, sm: wide ? 180 : 132 }}
            maxWidth={wide ? 180 : 132}
            valueFontSize={{ xs: '1.625rem', sm: wide ? '2.25rem' : '1.65rem' }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: wide ? 540 : undefined }}>
          <ProductivityBreakdown
            components={components}
            compact={embedded && !wide}
            emphasized={wide}
          />
        </Box>
      </Box>
    </Box>
  );
}
