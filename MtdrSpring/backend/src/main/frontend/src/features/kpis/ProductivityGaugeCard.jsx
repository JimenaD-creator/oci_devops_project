import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { KpiInfoCornerButton, KPI_TOOLTIPS } from './KpiTooltipParts';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import KpiDonutChart from './KpiDonutChart';

const GAUGE_HEADER_ACCENT = '#1565C0';

const GOAL_PCT = 80;

export default function ProductivityGaugeCard({ selectedSprints, compareMode }) {
  const score = React.useMemo(() => {
    if (!selectedSprints?.length) return 0;
    if (compareMode && selectedSprints.length > 1) {
      return (
        selectedSprints.reduce((a, s) => a + (s.kpis?.productivityScore ?? 0), 0) /
        selectedSprints.length
      );
    }
    return selectedSprints[0]?.kpis?.productivityScore ?? 0;
  }, [selectedSprints, compareMode]);

  const display = Number(score).toFixed(1);
  const pct = Math.min(100, Math.max(0, Number(score)));
  const above = score >= GOAL_PCT;

  return (
    <Paper
      component="div"
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'rgba(21, 101, 192, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrackChangesIcon sx={{ color: GAUGE_HEADER_ACCENT, fontSize: 22 }} />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.35,
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            <Typography
              component="span"
              variant="subtitle1"
              sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1.25 }}
            >
              Productivity Score
            </Typography>
            <KpiInfoCornerButton
              id="kpi-info-gauge-productivity"
              bodyProps={KPI_TOOLTIPS.productivityScore}
              ariaLabel="Productivity score: how it is calculated"
              iconSize="1.1rem"
              placement="inline"
            />
          </Box>
        </Box>
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
              justifyContent: { xs: 'center', sm: 'flex-start' },
            }}
          >
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
        </Box>
      </Box>
    </Paper>
  );
}
