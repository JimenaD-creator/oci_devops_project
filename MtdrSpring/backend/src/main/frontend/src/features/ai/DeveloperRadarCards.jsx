import React, { useEffect, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Chart } from 'chart.js/auto';

const METRICS = [
  { key: 'completionRate', label: 'Completion' },
  { key: 'onTimeRate', label: 'On-time' },
  { key: 'participation', label: 'Participation' },
  { key: 'hoursLogged', label: 'Hours' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'deliveryVolume', label: 'Volume' },
];

const METRIC_DESCRIPTIONS = {
  completionRate: { label: 'Completion', description: 'Percentage of assigned tasks marked as done during this sprint.', formula: 'Tasks Done / Tasks Assigned × 100' },
  onTimeRate: { label: 'On-time', description: 'Percentage of completed tasks delivered before or on their due date.', formula: 'On-time Tasks / Tasks Done × 100' },
  participation: { label: 'Participation', description: 'How active the developer was in logging work and updating task status.', formula: 'Task Logs Submitted / Expected Logs × 100' },
  hoursLogged: { label: 'Hours', description: 'Total hours logged in this sprint, normalized relative to the team average.', formula: 'Dev Hours / Max Team Hours × 100' },
  efficiency: { label: 'Efficiency', description: 'Quality of delivery: tasks completed without rework or reopening.', formula: 'Clean Deliveries / Tasks Done × 100' },
  deliveryVolume: { label: 'Volume', description: 'Workload handled relative to the team member with the most tasks.', formula: 'Dev Tasks / Max Team Tasks × 100' },
};

function overall(dev) {
  const sum = METRICS.reduce((s, m) => s + (dev[m.key] ?? 1), 0);
  return Math.round(sum / METRICS.length);
}

function getColor(score) {
  if (score >= 75) return '#2E7D32';
  if (score >= 50) return '#F57F17';
  return '#C62828';
}

function RadarChart({ dev }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [tooltip, setTooltip] = React.useState(null);

  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const tickColor = isDark ? '#607D8B' : '#90A4AE';
  const labelColor = isDark ? '#90A4AE' : '#546E7A';

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ov = overall(dev);
    const color = getColor(ov);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: METRICS.map((m) => m.label),
        datasets: [{
          data: METRICS.map((m) => dev[m.key] ?? 1),
          backgroundColor: color + '22',
          borderColor: color,
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointRadius: 4,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          r: {
            min: 0, max: 99,
            ticks: { stepSize: 33, font: { size: 11 }, color: tickColor, backdropColor: 'transparent' },
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            pointLabels: { font: { size: 13 }, color: labelColor },
          },
        },
        onHover: (event, elements) => {
          if (!canvasRef.current) return;
          if (elements.length > 0) {
            canvasRef.current.style.cursor = 'pointer';
            const idx = elements[0].index;
            const metricKey = METRICS[idx].key;
            const info = METRIC_DESCRIPTIONS[metricKey];
            const rect = canvasRef.current.getBoundingClientRect();
            setTooltip({ label: info.label, description: info.description, formula: info.formula, value: dev[metricKey] ?? 1, x: event.native.clientX - rect.left, y: event.native.clientY - rect.top });
          } else {
            canvasRef.current.style.cursor = 'default';
            setTooltip(null);
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const metricKey = METRICS[idx].key;
            const info = METRIC_DESCRIPTIONS[metricKey];
            const rect = canvasRef.current.getBoundingClientRect();
            setTooltip((prev) => prev?.label === info.label ? null : { label: info.label, description: info.description, formula: info.formula, value: dev[metricKey] ?? 1, x: event.native.clientX - rect.left, y: event.native.clientY - rect.top });
          }
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [dev, gridColor, tickColor, labelColor]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: 260 }}>
      <canvas ref={canvasRef} role="img" aria-label={`Radar de métricas de ${dev.developerName}`} />
      {tooltip && (
        <Box sx={{
          position: 'absolute',
          left: Math.min(tooltip.x + 10, 200),
          top: Math.max(tooltip.y - 80, 0),
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          p: 1.5,
          zIndex: 10,
          maxWidth: 220,
          pointerEvents: 'none',
        }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.primary', mb: 0.5 }}>
            {tooltip.label}
            <Box component="span" sx={{ ml: 1, fontWeight: 700, color: '#2E7D32' }}>{tooltip.value}</Box>
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.75 }}>{tooltip.description}</Typography>
          <Box sx={{ bgcolor: isDark ? '#1A1C20' : '#F5F5F5', borderRadius: 1, px: 1, py: 0.5 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontFamily: 'monospace' }}>{tooltip.formula}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Avatar({ dev, color, initials }) {
  return (
    <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: color + '22', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dev.profilePicture ? (
        <img src={dev.profilePicture} alt={dev.developerName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography sx={{ fontSize: 15, fontWeight: 700, color }}>{initials}</Typography>
      )}
    </Box>
  );
}

function DevCard({ dev }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const ov = overall(dev);
  const color = getColor(ov);
  const displayName = String(dev?.developerName ?? 'Unknown').trim() || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)',
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: isDark ? '#1C1E22' : '#FAFAFA',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar dev={dev} color={color} initials={initials} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }} noWrap>
            {displayName}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {dev._done ?? 0} done · {dev._total ?? 0} assigned
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{ov}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}>overall</Typography>
        </Box>
      </Box>

      <RadarChart dev={dev} />

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mt: 0.5 }}>
        {METRICS.map((m) => (
          <Box key={m.key} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.primary' }}>{dev[m.key] ?? 1}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{m.label}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function DeveloperRadarCards({ sprintId }) {
  const [devs, setDevs] = React.useState([]);

  useEffect(() => {
    if (!sprintId) return;
    const base = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
    fetch(`${base}/api/insights/sprint/${sprintId}/developer-radar`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDevs(Array.isArray(data) ? data : []))
      .catch(() => setDevs([]));
  }, [sprintId]);

  if (devs.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600, mb: 1.5 }}>
        Scores normalized relative to team — higher is better within the sprint.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2.5 }}>
        {devs
          .filter((d) => d && String(d.developerName ?? '').trim())
          .map((d) => (
            <DevCard key={String(d.developerName).trim()} dev={d} />
          ))}
      </Box>
    </Box>
  );
}