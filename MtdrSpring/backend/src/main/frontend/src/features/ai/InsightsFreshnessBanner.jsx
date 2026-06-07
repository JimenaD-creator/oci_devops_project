import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { formatChangedKpiMetricsList } from './insightsFreshness';

function formatGeneratedAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function InsightsFreshnessBanner({
  generatedAt,
  status,
  kpiValuesChanged = false,
  changedMetricLabels = [],
  onRegenerate = null,
  regenerating = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const label = formatGeneratedAt(generatedAt);

  if (status !== 'loaded' || !label) return null;

  if (kpiValuesChanged) {
    const changedList = formatChangedKpiMetricsList(changedMetricLabels);
    return (
      <Box
        role="status"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          mb: 1.25,
          p: 1.25,
          borderRadius: 1.5,
          bgcolor: isDark ? 'rgba(255, 152, 0, 0.12)' : 'rgba(255, 152, 0, 0.1)',
          border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.45)' : 'rgba(230, 81, 0, 0.35)'}`,
        }}
      >
        <AlertTriangle
          size={18}
          color={isDark ? '#FFB74D' : '#E65100'}
          style={{ marginTop: 2, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>
            Sprint data changed since this analysis ({label})
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.35, lineHeight: 1.5 }}>
            {changedList
              ? `Updated values detected: ${changedList}. Regenerate insights so alerts, trends, and recommendations match the current KPIs.`
              : 'KPI or task counts changed since generation. Regenerate insights so the narrative matches current data.'}
          </Typography>
          {typeof onRegenerate === 'function' && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              disabled={regenerating}
              startIcon={<RefreshCw size={14} />}
              onClick={onRegenerate}
              sx={{
                mt: 1,
                textTransform: 'none',
                fontWeight: 700,
                borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                color: isDark ? '#FFB74D' : '#E65100',
                boxShadow: 'none',
                '& .MuiOutlinedButton-notchedOutline': {
                  borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                },
                '&:hover': {
                  borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                  bgcolor: isDark ? 'rgba(255, 152, 0, 0.12)' : 'rgba(255, 152, 0, 0.08)',
                  color: isDark ? '#FFB74D' : '#E65100',
                  boxShadow: 'none',
                },
                '&:hover .MuiOutlinedButton-notchedOutline': {
                  borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                },
                '&.Mui-focusVisible': {
                  outline: 'none',
                  borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                },
                '&.Mui-focusVisible .MuiOutlinedButton-notchedOutline': {
                  borderColor: isDark ? 'rgba(255, 152, 0, 0.55)' : 'rgba(230, 81, 0, 0.45)',
                },
              }}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate insights'}
            </Button>
          )}
        </Box>
      </Box>
    );
  }

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
      <Clock
        size={16}
        color={isDark ? '#9A9A9A' : '#607D8B'}
        style={{ marginTop: 2, flexShrink: 0 }}
      />
      <Box>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>
          AI interpretation generated {label}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
          Regenerate if tasks, hours, or KPI scores change significantly.
        </Typography>
      </Box>
    </Box>
  );
}
