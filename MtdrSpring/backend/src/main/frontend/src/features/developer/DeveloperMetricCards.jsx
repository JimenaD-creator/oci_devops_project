import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import BarChartIcon from '@mui/icons-material/BarChart';
import StarBorderIcon from '@mui/icons-material/StarBorder';

const DEFAULT_ACCENT = { main: '#378ADD', light: '#E6F1FB', label: '#185FA5' };
const POSITIVE_ACCENT = { main: '#1D9E75', light: '#E1F5EE', label: '#0F6E56' };
const NEGATIVE_ACCENT = { main: '#E24B4A', light: '#FCEBEB', label: '#A32D2D' };

const ICON_MAP = {
  tasks_assigned:   AssignmentOutlinedIcon,
  tasks_completed:  CheckCircleOutlineIcon,
  completion_rate:  PieChartOutlineIcon,
  hours_worked:     AccessTimeOutlinedIcon,
  trending_up:      TrendingUpIcon,
  trending_down:    TrendingDownIcon,
  bar_chart:        BarChartIcon,
  default:          StarBorderIcon,
};

function clampProgress(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Accepts palette object or legacy hex string from callers. */
function resolveAccent(accent, barTone, isDark) {
  if (barTone === 'positive') return POSITIVE_ACCENT;
  if (barTone === 'negative') return NEGATIVE_ACCENT;
  if (accent && typeof accent === 'object' && accent.main) return accent;
  if (typeof accent === 'string' && accent.trim()) {
    const main = accent.trim();
    return {
      main,
      light: isDark ? alpha(main, 0.22) : alpha(main, 0.12),
      label: main,
    };
  }
  return DEFAULT_ACCENT;
}

/**
 * @param {{
 *   label: string,
 *   value: string|number,
 *   subtitle?: string,
 *   accent?: { main: string, light: string, label: string },
 *   progress?: number,
 *   barTone?: 'neutral'|'positive'|'negative',
 *   iconKey?: keyof typeof ICON_MAP,
 * }[]} metrics
 */
export default function DeveloperMetricCards({ metrics = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {metrics.map((m) => {
        const barTone = m.barTone || 'neutral';
        const accent = resolveAccent(m.accent, barTone, isDark);

        const progress = clampProgress(m.progress);
        const showBar = typeof m.progress === 'number';

        const IconComponent = ICON_MAP[m.iconKey] || ICON_MAP.default;

        const topBorderColor = accent.main;
        const iconBg = isDark ? alpha(accent.main, 0.18) : accent.light;
        const iconColor = isDark ? accent.light : accent.label;
const labelColor = isDark ? alpha(accent.light, 0.95) : accent.label;
        const trackBg = isDark ? 'rgba(255,255,255,0.14)' : alpha(accent.main, 0.15);


        return (
          <Grid item xs={12} sm={6} md={3} key={m.label}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                height: '100%',
                borderRadius: 3,
                border: `0.5px solid ${isDark ? '#3A3C42' : '#ECECEC'}`,
                borderTop: `3px solid ${topBorderColor}`,
                bgcolor: isDark ? '#1E2025' : 'background.paper',
              }}
            >
              {/* Icon chip */}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  bgcolor: iconBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1.25,
                }}
              >
                <IconComponent sx={{ fontSize: 17, color: iconColor }} />
              </Box>

              {/* Label */}
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: labelColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  mb: 0.5,
                }}
              >
                {m.label}
              </Typography>

              {/* Value */}
              <Typography
                sx={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: 'text.primary',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                {m.value}
              </Typography>

              {/* Subtitle */}
              {m.subtitle ? (
                <Typography
                  sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.75, mb: 0.25 }}
                >
                  {m.subtitle}
                </Typography>
              ) : null}

              {/* Progress bar */}
              {showBar ? (
                <Box
                  sx={{
                    mt: 1.25,
                    height: 3,
                    borderRadius: 999,
                    bgcolor: trackBg,
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      width: `${progress}%`,
                      height: '100%',
                      bgcolor: accent.main,
                      borderRadius: 999,
                      transition: 'width 0.35s ease',
                    }}
                  />
                </Box>
              ) : null}
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}