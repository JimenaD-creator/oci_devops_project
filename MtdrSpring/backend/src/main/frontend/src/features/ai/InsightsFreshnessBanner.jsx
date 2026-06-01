import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Clock } from 'lucide-react';

function formatGeneratedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function InsightsFreshnessBanner({ generatedAt, status }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const label = formatGeneratedAt(generatedAt);

  if (status !== 'loaded' || !label) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        mb: 1.25,
        p: 1,
        borderRadius: 1.5,
        bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      }}
    >
      <Clock size={16} color={isDark ? '#9A9A9A' : '#607D8B'} style={{ marginTop: 2, flexShrink: 0 }} />
      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>
          AI interpretation generated {label}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
          Regenerate if tasks or hours changed significantly since this analysis.
        </Typography>
      </Box>
    </Box>
  );
}
