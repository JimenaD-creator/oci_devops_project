import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const ORACLE_RED = '#C74634';

export default function ProductivityGaugeCard({ selectedSprints, compareMode }) {
  const meta = 80;
  const score = React.useMemo(() => {
    if (!selectedSprints?.length) return 0;
    if (compareMode && selectedSprints.length > 1) {
      return (
        selectedSprints.reduce((a, s) => a + (s.kpis?.productivityScore ?? 0), 0) / selectedSprints.length
      );
    }
    return selectedSprints[0]?.kpis?.productivityScore ?? 0;
  }, [selectedSprints, compareMode]);

  const display = score.toFixed(1);
  const pct = Math.min(100, Math.max(0, score));
  const above = score >= meta;

  const data = [
    { name: 'score', value: pct },
    { name: 'rest', value: 100 - pct },
  ];

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, alignSelf: 'flex-start', mb: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(199,70,52,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TrackChangesIcon sx={{ color: ORACLE_RED, fontSize: 22 }} />
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
          Productivity Score
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', width: '100%', height: 200, mt: 0.5 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={88}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={ORACLE_RED} />
              <Cell fill="#F0F0F0" />
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
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>
            {display}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888', fontWeight: 600 }}>
            / 100
          </Typography>
        </Box>
      </Box>

      <Typography variant="body2" sx={{ color: '#888', mt: 1 }}>
        Meta: {meta}%
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
        {above ? (
          <>
            <CheckCircleOutlineIcon sx={{ color: '#2E7D32', fontSize: 20 }} />
            <Typography variant="body2" sx={{ color: '#2E7D32', fontWeight: 600 }}>
              Por encima de la meta
            </Typography>
          </>
        ) : (
          <Typography variant="body2" sx={{ color: '#C74634', fontWeight: 600 }}>
            Por debajo de la meta
          </Typography>
        )}
      </Box>
      {compareMode && selectedSprints.length > 1 && (
        <Typography variant="caption" sx={{ color: '#AAA', mt: 1, textAlign: 'center' }}>
          Promedio de los sprints seleccionados
        </Typography>
      )}
    </Paper>
  );
}
