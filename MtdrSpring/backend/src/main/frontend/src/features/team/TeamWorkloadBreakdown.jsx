import React, { useMemo } from 'react';
import {
  Avatar,
  Box,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { developerAvatarColors } from '../../utils/developerColors';

const HEALTHY_COLOR = '#2E7D32';
const HEALTHY_TRACK_LIGHT = 'rgba(46, 125, 50, 0.18)';
const HEALTHY_TRACK_DARK = 'rgba(46, 125, 50, 0.25)';
const OVERLOAD_COLOR = '#C62828';
const OVERLOAD_TRACK_LIGHT = 'rgba(198, 40, 40, 0.18)';
const OVERLOAD_TRACK_DARK = 'rgba(198, 40, 40, 0.25)';
const OVERLOAD_BORDER = '#F9A825';

function initialsFromName(name) {
  if (!name) return '?';
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Build a Map<lowercaseName, { overloaded, insight }> from the AI developerInsights rows. */
function buildAiOverloadMap(aiRows) {
  const map = new Map();
  if (!Array.isArray(aiRows)) return map;
  aiRows.forEach((row) => {
    const name = String(row?.developerName || '')
      .trim()
      .toLowerCase();
    if (!name) return;
    map.set(name, {
      overloaded: row?.overloaded === true,
      insight: typeof row?.insight === 'string' ? row.insight : '',
    });
  });
  return map;
}

export default function TeamWorkloadBreakdown({ sprint, aiDeveloperInsights = null }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const aiOverloadMap = useMemo(
    () => buildAiOverloadMap(aiDeveloperInsights),
    [aiDeveloperInsights],
  );
  const aiAvailable = Array.isArray(aiDeveloperInsights) && aiDeveloperInsights.length > 0;

  const rows = useMemo(() => {
    const devs = Array.isArray(sprint?.developers) ? sprint.developers : [];
    return devs
      .map((d) => {
        const name = String(d?.name || 'Unknown');
        const assigned = Number(d?.assigned) || 0;
        const completed = Number(d?.completed) || 0;
        const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        const workload = clampPercent(d?.workload);
        const aiEntry = aiOverloadMap.get(name.toLowerCase());
        return {
          name,
          assigned,
          completed,
          completionRate,
          workload,
          profilePicture: d?.profilePicture || null,
          isOverloaded: Boolean(aiEntry?.overloaded),
          aiReason: aiEntry?.insight ?? '',
        };
      })
      .sort((a, b) => b.workload - a.workload);
  }, [sprint, aiOverloadMap]);

  if (rows.length === 0) return null;

  const trackColor = (isOverloaded) => {
    if (isOverloaded) return isDark ? OVERLOAD_TRACK_DARK : OVERLOAD_TRACK_LIGHT;
    return isDark ? HEALTHY_TRACK_DARK : HEALTHY_TRACK_LIGHT;
  };

  return (
    <Paper
      sx={{
        mb: 3,
        borderRadius: 2,
        border: '1px solid',
        borderColor: isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: isDark ? 'rgba(46, 125, 50, 0.12)' : 'rgba(46, 125, 50, 0.08)',
          borderBottom: '1px solid',
          borderBottomColor: isDark ? 'rgba(46, 125, 50, 0.3)' : 'rgba(46, 125, 50, 0.2)',
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary' }}>
          Workload breakdown
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
          {aiAvailable
            ? 'Overload is flagged by AI Insights based on this sprint’s workload.'
            : 'Generate AI Insights for this sprint to flag overloaded developers.'}
        </Typography>
      </Box>
      <Stack spacing={1.25} sx={{ p: { xs: 1.5, md: 2 } }}>
        {rows.map((row) => {
          const palette = developerAvatarColors(row.name);
          const barColor = row.isOverloaded ? OVERLOAD_COLOR : HEALTHY_COLOR;
          const trackBgColor = trackColor(row.isOverloaded);
          return (
            <Box
              key={row.name}
              sx={{
                position: 'relative',
                p: 1.5,
                borderRadius: 2,
                border: row.isOverloaded
                  ? `1.5px solid ${OVERLOAD_BORDER}`
                  : `1px solid ${isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)'}`,
                bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    src={row.profilePicture || undefined}
                    sx={{
                      bgcolor: palette.bg,
                      color: palette.color,
                      fontWeight: 700,
                      width: 44,
                      height: 44,
                    }}
                  >
                    {!row.profilePicture && initialsFromName(row.name)}
                  </Avatar>
                  {row.isOverloaded && (
                    <Box
                      aria-hidden
                      sx={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: OVERLOAD_BORDER,
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${isDark ? '#1C1E22' : '#FFFFFF'}`,
                      }}
                    >
                      !
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 1,
                      mb: 0.75,
                    }}
                  >
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: 'text.primary',
                        fontSize: { xs: '0.95rem', sm: '1rem' },
                      }}
                    >
                      {row.name}
                    </Typography>
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color: isDark ? '#9A9A9A' : '#37474F',
                        fontSize: { xs: '0.85rem', sm: '0.9rem' },
                      }}
                    >
                      {row.assigned} task{row.assigned === 1 ? '' : 's'}
                      <Box component="span" sx={{ color: isDark ? '#78909C' : '#78909C', fontWeight: 600, ml: 1 }}>
                        Completion: {row.completionRate}%
                      </Box>
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <LinearProgress
                      variant="determinate"
                      value={row.workload}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        bgcolor: trackBgColor,
                        '& .MuiLinearProgress-bar': { bgcolor: barColor },
                      }}
                    />
                    <Typography
                      sx={{
                        fontWeight: 800,
                        color: barColor,
                        fontSize: { xs: '0.85rem', sm: '0.9rem' },
                        minWidth: 44,
                        textAlign: 'right',
                      }}
                    >
                      {row.workload}%
                    </Typography>
                    {row.isOverloaded && (
                      <Tooltip
                        title={row.aiReason || 'Flagged as overloaded by AI Insights.'}
                        arrow
                        placement="top"
                      >
                        <Chip
                          label="Overload"
                          size="small"
                          sx={{
                            bgcolor: isDark ? '#3B2A1A' : '#FFF3E0',
                            color: '#E65100',
                            fontWeight: 700,
                            border: `1px solid ${OVERLOAD_BORDER}`,
                            height: 22,
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}