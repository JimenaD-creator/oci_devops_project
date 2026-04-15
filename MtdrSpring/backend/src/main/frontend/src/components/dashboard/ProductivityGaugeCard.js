import React from 'react';
import { Box, Paper, Typography, Tooltip, IconButton } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { KpiTooltipBody, tooltipChromeSx, tooltipArrowSx } from './DashboardKpiTooltipParts';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import KpiDonutChart from './KpiDonutChart';

const ORACLE_RED = '#C74634';

const GOAL_PCT = 80;

const pulseIconSx = {
  '@keyframes prodGaugeInfoPulse': {
    '0%, 100%': { transform: 'scale(1)', opacity: 1 },
    '50%': { transform: 'scale(1.12)', opacity: 0.88 },
  },
  animation: 'prodGaugeInfoPulse 2.2s ease-in-out infinite',
  color: '#1565C0',
  '&:hover': {
    animation: 'none',
    opacity: 1,
    bgcolor: 'rgba(21, 101, 192, 0.08)',
  },
};

const PRODUCTIVITY_TOOLTIP = {
  what:
    'A score from 0 to 100 that summarizes sprint productivity for quick comparison. It reflects how many tasks are completed in the sprint.',
  representation:
    'Shown as a donut gauge: filled arc is the score, the rest is the track. The goal line is 80%. With several sprints selected, the gauge shows the average of each sprint’s score.',
  formula: {
    type: 'stack',
    parts: [
      {
        type: 'fraction',
        label: 'Productivity =',
        numerator: 'DONE tasks in the sprint',
        denominator: 'all tasks in the sprint',
        suffix: '× 100',
      },
      {
        type: 'plain',
        text: 'P̄ = (P₁ + P₂ + ⋯ + Pₙ) / n   (several sprints selected)',
      },
    ],
  },
};

export default function ProductivityGaugeCard({ selectedSprints, compareMode }) {
  const score = React.useMemo(() => {
    if (!selectedSprints?.length) return 0;
    if (compareMode && selectedSprints.length > 1) {
      return (
        selectedSprints.reduce((a, s) => a + (s.kpis?.productivityScore ?? 0), 0) / selectedSprints.length
      );
    }
    return selectedSprints[0]?.kpis?.productivityScore ?? 0;
  }, [selectedSprints, compareMode]);

  const display = Number(score).toFixed(1);
  const pct = Math.min(100, Math.max(0, Number(score)));
  const above = score >= GOAL_PCT;

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.25 },
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          alignSelf: 'stretch',
          mb: 0.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(199,70,52,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrackChangesIcon sx={{ color: ORACLE_RED, fontSize: 22 }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1.25 }}>
            Productivity Score
          </Typography>
        </Box>
        <Tooltip
          arrow
          placement="left"
          describeChild
          enterTouchDelay={0}
          leaveTouchDelay={4000}
          title={<KpiTooltipBody {...PRODUCTIVITY_TOOLTIP} />}
          componentsProps={{
            tooltip: { sx: tooltipChromeSx },
            arrow: { sx: tooltipArrowSx },
          }}
        >
          <IconButton size="small" aria-label="About Productivity Score" sx={pulseIconSx}>
            <InfoOutlinedIcon sx={{ fontSize: '1.15rem' }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: { xs: 'center', sm: 'space-between' },
          gap: { xs: 1.25, sm: 1.75 },
          width: '100%',
          mt: 0,
        }}
      >
        <KpiDonutChart
          pct={pct}
          displayValue={display}
          displaySuffix="/ 100"
          height={{ xs: 172, sm: 204 }}
          innerRadius={60}
          outerRadius={92}
          width={{ xs: '100%', sm: 236 }}
          maxWidth={310}
          valueFontSize={{ xs: '1.8rem', sm: '2rem' }}
        />

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', sm: 'flex-start' },
            justifyContent: 'center',
            gap: 0.5,
            flex: 1,
            minWidth: 0,
            textAlign: { xs: 'center', sm: 'left' },
          }}
        >
          <Typography variant="body2" sx={{ color: '#888', fontWeight: 600 }}>
            Goal: {GOAL_PCT}%
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', justifyContent: { xs: 'center', sm: 'flex-start' } }}>
            {above ? (
              <>
                <CheckCircleOutlineIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600 }}>
                  Above goal
                </Typography>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: '#C74634', fontWeight: 600 }}>
                Below goal
              </Typography>
            )}
          </Box>
          {compareMode && selectedSprints.length > 1 && (
            <Typography variant="caption" sx={{ color: '#AAA', mt: 0.25, lineHeight: 1.3 }}>
              Average of selected sprints
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
