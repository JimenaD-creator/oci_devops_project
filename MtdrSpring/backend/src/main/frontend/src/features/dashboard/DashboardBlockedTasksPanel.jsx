import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Box, Paper, Typography, Chip, Button, Stack } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatBlockedSinceAge, sortBlockedTasksNewestFirst } from './dashboardSprintData';

function severityColors(count, isDark) {
  if (count >= 4) {
    return {
      bg: isDark ? '#2D1A1A' : '#FFEBEE',
      border: isDark ? '#7F3030' : '#EF9A9A',
      fg: isDark ? '#EF9A9A' : '#B71C1C',
      chipBg: isDark ? '#C62828' : '#C62828',
    };
  }
  if (count >= 2) {
    return {
      bg: isDark ? '#2D1F12' : '#FFF3E0',
      border: isDark ? '#7F4A1A' : '#FFCC80',
      fg: isDark ? '#FFB74D' : '#E65100',
      chipBg: isDark ? '#EF6C00' : '#EF6C00',
    };
  }
  return {
    bg: isDark ? '#2D2616' : '#FFF8E1',
    border: isDark ? '#7F6A1A' : '#FFE082',
    fg: isDark ? '#FFD54F' : '#F57F17',
    chipBg: isDark ? '#FB8C00' : '#FB8C00',
  };
}

export default function DashboardBlockedTasksPanel({ selectedSprints = [] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const byDeveloper = new Map();

  (selectedSprints || []).forEach((sp) => {
    (sp.blockedDevelopers || []).forEach((dev) => {
      const key = String(dev?.name || '').trim();
      if (!key) return;
      if (!byDeveloper.has(key)) {
        byDeveloper.set(key, { name: key, blockedCount: 0, blockedTasks: [] });
      }
      const row = byDeveloper.get(key);
      row.blockedCount += Number(dev.blockedCount) || 0;
      (dev.blockedTasks || []).forEach((t) => {
        if (!row.blockedTasks.some((x) => Number(x.id) === Number(t.id))) row.blockedTasks.push(t);
      });
    });
  });

  const cards = Array.from(byDeveloper.values())
    .sort((a, b) => b.blockedCount - a.blockedCount)
    .slice(0, 8);

  if (cards.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        component="h2"
        sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', mb: 1 }}
      >
        Blocked tasks
      </Typography>

      <Stack spacing={1.25}>
        {cards.map((dev) => {
          const palette = severityColors(dev.blockedCount, isDark);
          const blockedTasksOrdered = sortBlockedTasksNewestFirst(dev.blockedTasks);
          const oldest = dev.blockedTasks.reduce((acc, t) => {
            const ms = new Date(t?.blockedSince || '').getTime();
            if (!Number.isFinite(ms)) return acc;
            return acc == null ? ms : Math.min(acc, ms);
          }, null);
          return (
            <Paper
              key={dev.name}
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: `1px solid ${palette.border}`,
                bgcolor: palette.bg,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                  alignItems: 'flex-start',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AlertTriangle size={16} color={palette.fg} />
                    <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
                      {dev.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${dev.blockedCount} blocked`}
                      sx={{ bgcolor: palette.chipBg, color: '#fff', fontWeight: 700, height: 22 }}
                    />
                  </Box>
                  <Typography
                    sx={{ fontSize: '0.82rem', color: isDark ? '#9A9A9A' : '#546E7A', mb: 0.75 }}
                  >
                    Oldest blocked: {formatBlockedSinceAge(oldest)}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    {blockedTasksOrdered.slice(0, 3).map((t) => {
                      const reason = String(t?.blockedReason || '').trim();
                      return (
                        <Box key={t.id}>
                          <Typography
                            sx={{ fontSize: '0.84rem', color: isDark ? '#E0E0E0' : '#37474F' }}
                          >
                            {t.title}
                          </Typography>
                          {reason ? (
                            <Typography
                              sx={{
                                fontSize: '0.78rem',
                                color: isDark ? '#9A9A9A' : '#607D8B',
                                pl: 0,
                              }}
                            >
                              Reason: {reason}
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    borderColor: palette.fg,
                    color: palette.fg,
                    outline: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    '&:hover': {
                      borderColor: palette.fg,
                      bgcolor: `${palette.fg}14`,
                      color: palette.fg,
                    },
                    '&:focus': { outline: 'none' },
                    '&:focus-visible': {
                      outline: 'none',
                      borderColor: palette.fg,
                      boxShadow: `0 0 0 2px ${palette.fg}55`,
                    },
                    '&.Mui-focusVisible': {
                      outline: 'none',
                      borderColor: palette.fg,
                      boxShadow: `0 0 0 2px ${palette.fg}55`,
                    },
                    '&:active': {
                      borderColor: palette.fg,
                      color: palette.fg,
                      boxShadow: 'none',
                    },
                  }}
                >
                  View tasks
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
