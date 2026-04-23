import React, { useMemo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Box, Paper, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import KpiDonutChart from './KpiDonutChart';

const GAUGE_HEADER_ACCENT = '#1565C0';

/** Chart arc is 0–100; participation can exceed 100% — cap fill only. */
const GAUGE_GOALS = {
  onTimeDelivery: 80,
  teamParticipation: 100,
  workloadBalance: 80,
};

function numericForKpi(def, kpis) {
  const v = kpis?.[def.key];
  if (v == null) return null;
  let n;
  if (def.numeric) n = def.numeric(v);
  else n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function aggregateGaugeScore(def, selectedSprints, compareMode) {
  if (!selectedSprints?.length) return { avg: 0, chartPct: 0 };
  const vals = selectedSprints
    .map((s) => numericForKpi(def, s.kpis))
    .filter((x) => x != null && Number.isFinite(x));
  if (!vals.length) return { avg: 0, chartPct: 0 };
  const avg =
    compareMode && selectedSprints.length > 1
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : vals[0];
  const chartPct = Math.min(100, Math.max(0, Number(avg)));
  return { avg, chartPct };
}

function goalLabel(key) {
  const g = GAUGE_GOALS[key];
  if (g == null) return '';
  if (key === 'workloadBalance') return `Goal: ${g}`;
  return `Goal: ${g}%`;
}

function TrendIcon({ trend }) {
  const wrap = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 22,
    height: 22,
    overflow: 'visible',
  };
  const icon = { width: 18, height: 18, flexShrink: 0 };
  if (trend === 'up') {
    return (
      <Box sx={wrap} aria-hidden>
        <TrendingUp style={{ ...icon, color: '#1565C0' }} />
      </Box>
    );
  }
  if (trend === 'down') {
    return (
      <Box sx={wrap} aria-hidden>
        <TrendingDown style={{ ...icon, color: '#FB8C00' }} />
      </Box>
    );
  }
  return <Box sx={{ width: 22, flexShrink: 0 }} aria-hidden />;
}

function CompareKpiRows({ def, orderedSprints }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.1,
        mt: 1.5,
        pt: 1.5,
        px: 0.25,
        pr: 1,
        borderTop: '1px solid #F0F0F0',
        overflow: 'visible',
        minWidth: 0,
      }}
    >
      {orderedSprints.map((sp, idx) => {
        const val = sp.kpis?.[def.key];
        const display = val != null ? def.format(val) : '—';
        const cur = numericForKpi(def, sp.kpis);
        const prev = idx > 0 ? numericForKpi(def, orderedSprints[idx - 1].kpis) : null;
        let trend = null;
        if (prev != null && cur != null) {
          if (cur > prev) trend = 'up';
          else if (cur < prev) trend = 'down';
        }

        return (
          <Box
            key={sp.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              py: 0.25,
              minWidth: 0,
              overflow: 'visible',
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: sp.accentColor,
                flexShrink: 0,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                minWidth: 0,
                color: '#555',
                fontWeight: 600,
                fontSize: '0.8rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sp.shortLabel}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 800,
                color: '#1A1A1A',
                fontSize: '0.9rem',
                minWidth: 36,
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {display}
            </Typography>
            <TrendIcon trend={trend} />
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * @param {object} def — entry from KPI_DEFS (key, title, format, icon, tooltip, numeric?)
 * @param {object[]} selectedSprints
 * @param {boolean} compareMode
 * @param {object[]} ordered — sprints sorted by id for compare rows
 */
export default function KpiGaugeCard({ def, selectedSprints, compareMode, ordered }) {
  const { avg, chartPct } = useMemo(
    () => aggregateGaugeScore(def, selectedSprints, compareMode),
    [def, selectedSprints, compareMode],
  );

  const goal = GAUGE_GOALS[def.key] ?? 80;
  const above = avg >= goal;
  const main = def.key === 'workloadBalance' ? String(Math.round(avg)) : String(Math.round(avg));
  const suffix = def.key === 'workloadBalance' ? '/ 100' : '%';

  const showCompareRows = compareMode && selectedSprints.length > 1;

  const Icon = def.icon;

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
        overflow: 'visible',
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
          mb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
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
            <Icon style={{ width: '1.25rem', height: '1.25rem', color: GAUGE_HEADER_ACCENT }} />
          </Box>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, color: '#1A1A1A', lineHeight: 1.25 }}
          >
            {def.title}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: { xs: 'center', sm: 'space-between' },
          gap: { xs: 1.5, sm: 3 },
          width: '100%',
          mt: 0.5,
        }}
      >
        <KpiDonutChart pct={chartPct} displayValue={main} displaySuffix={suffix} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: { xs: 'center', sm: 'flex-start' },
            justifyContent: 'center',
            gap: 0.75,
            flex: 1,
            minWidth: 0,
            textAlign: { xs: 'center', sm: 'left' },
          }}
        >
          <Typography variant="body2" sx={{ color: '#888', fontWeight: 600 }}>
            {goalLabel(def.key)}
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

      {showCompareRows ? <CompareKpiRows def={def} orderedSprints={ordered} /> : null}
    </Paper>
  );
}
