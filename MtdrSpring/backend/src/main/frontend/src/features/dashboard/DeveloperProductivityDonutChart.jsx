import React, { useMemo } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { TrendingUp } from 'lucide-react';
import KpiDonutChart from '../kpis/KpiDonutChart';
import { formatProductivityScoreDisplay } from '../kpis/productivityScoreUtils';
import { completionRateProgressColor } from './constants/dashboardConstants';
import { CHART_DESC_SX } from './dashboardTypography';

const PRODUCTIVITY_COMPONENTS = [
  { key: 'completionRate', label: 'Completion rate', weight: 'x0.4', color: '#1565C0' },
  { key: 'onTimeDelivery', label: 'On-time delivery', weight: 'x0.3', color: '#1D9E75' },
  { key: 'teamParticipation', label: 'Participation', weight: 'x0.2', color: '#8E24AA' },
  { key: 'workloadBalance', label: 'Workload balance', weight: 'x0.1', color: '#FB8C00' },
];

function ProductivityBreakdown({ components, compact = false }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Grid container spacing={compact ? 0.75 : 1.5} sx={{ width: '100%' }}>
      {components.map(({ label, value, weight, color }) => (
        <Grid item xs={6} key={label}>
          <Box
            sx={{
              bgcolor: isDark ? '#16181C' : '#F8F9FA',
              borderRadius: 1.25,
              p: compact ? 0.85 : 1.25,
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: compact ? 0.45 : 0.75 }}>
              <Typography
                sx={{
                  fontSize: compact ? '0.625rem' : '0.7rem',
                  color: isDark ? '#9A9A9A' : '#607D8B',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontSize: compact ? '0.625rem' : '0.7rem',
                  color: '#90A4AE',
                  flexShrink: 0,
                  ml: 0.5,
                }}
              >
                {weight}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{
                  flex: 1,
                  height: compact ? 4 : 5,
                  bgcolor: isDark ? '#2A2C32' : '#E0E0E0',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, value))}%`,
                    bgcolor: color,
                    borderRadius: 99,
                  }}
                />
              </Box>
              <Typography
                sx={{
                  fontSize: compact ? '0.6875rem' : '0.75rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {Math.round(value)}%
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
  teamParticipation = 0,
  workloadBalance = 0,
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
      teamParticipation: Math.min(100, Math.max(0, Math.round(Number(teamParticipation) || 0))),
      workloadBalance: Math.min(100, Math.max(0, Math.round(Number(workloadBalance) || 0))),
    }),
    [completionRate, onTimeDelivery, teamParticipation, workloadBalance],
  );

  const components = useMemo(
    () =>
      PRODUCTIVITY_COMPONENTS.map(({ key, label, weight, color }) => ({
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
              Individual sprint performance gauge.
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
          maxWidth: wide ? 720 : undefined,
          mx: wide ? 'auto' : undefined,
        }}
      >
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: { xs: '100%', sm: wide ? 168 : 132 },
          }}
        >
          <KpiDonutChart
            pct={normalizedScore}
            displayValue={formatProductivityScoreDisplay(normalizedScore)}
            arcColor={arcColor}
            height={{ xs: 132, sm: wide ? 168 : 140 }}
            innerRadius={wide ? 54 : 46}
            outerRadius={wide ? 72 : 62}
            width={{ xs: 132, sm: wide ? 168 : 132 }}
            maxWidth={wide ? 168 : 132}
            valueFontSize={{ xs: '1.5rem', sm: wide ? '2rem' : '1.65rem' }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: wide ? 420 : undefined }}>
          <ProductivityBreakdown components={components} compact={embedded && !wide} />
        </Box>
      </Box>
    </Box>
  );
}
