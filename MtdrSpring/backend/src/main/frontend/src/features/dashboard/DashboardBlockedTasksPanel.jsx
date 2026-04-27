import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Box, Paper, Typography, Chip, Button, Stack } from '@mui/material';

function severityColors(count) {
  if (count >= 4) return { bg: '#FFEBEE', border: '#EF9A9A', fg: '#B71C1C', chipBg: '#C62828' };
  if (count >= 2) return { bg: '#FFF3E0', border: '#FFCC80', fg: '#E65100', chipBg: '#EF6C00' };
  return { bg: '#FFF8E1', border: '#FFE082', fg: '#F57F17', chipBg: '#FB8C00' };
}

function blockedAgeLabel(rawDate) {
  if (!rawDate) return 'Unknown';
  const ms = new Date(rawDate).getTime();
  if (!Number.isFinite(ms)) return 'Unknown';
  const diff = Math.max(0, Date.now() - ms);
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function DashboardBlockedTasksPanel({ selectedSprints = [] }) {
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

  return (
    <Box sx={{ mb: 3 }}>
      <Typography component="h2" sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#1A1A1A', mb: 0.5 }}>
        Blocked tasks
      </Typography>
      <Typography sx={{ color: '#607D8B', fontWeight: 500, mb: 1.5 }}>
        Developers with task blockers in the selected sprint(s).
      </Typography>

      {cards.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            border: '1px dashed #CFD8DC',
            bgcolor: '#FAFAFA',
          }}
        >
          <Typography sx={{ color: '#607D8B', fontWeight: 600 }}>
            No blocked tasks flagged yet. Once developers report `is_blocked`, this section highlights impacted developers.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.25}>
          {cards.map((dev) => {
            const palette = severityColors(dev.blockedCount);
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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <AlertTriangle size={16} color={palette.fg} />
                      <Typography sx={{ fontWeight: 800, color: '#1A1A1A' }}>{dev.name}</Typography>
                      <Chip
                        size="small"
                        label={`${dev.blockedCount} blocked`}
                        sx={{ bgcolor: palette.chipBg, color: '#fff', fontWeight: 700, height: 22 }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.82rem', color: '#546E7A', mb: 0.75 }}>
                      Oldest blocked: {blockedAgeLabel(oldest)}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                      {dev.blockedTasks.slice(0, 3).map((t) => {
                        const reason = String(t?.blockedReason || '').trim();
                        return (
                          <Box key={t.id}>
                            <Typography sx={{ fontSize: '0.84rem', color: '#37474F' }}>
                              - {t.title}
                            </Typography>
                            {reason ? (
                              <Typography sx={{ fontSize: '0.78rem', color: '#607D8B', pl: 1.25 }}>
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
                    sx={{ textTransform: 'none', fontWeight: 700, borderColor: palette.fg, color: palette.fg }}
                  >
                    View tasks
                  </Button>
                </Box>
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
