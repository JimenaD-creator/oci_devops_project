import React, { useEffect, useRef } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { Chart } from 'chart.js/auto';

const METRICS = [
  { key: 'completionRate',  label: 'Completion' },
  { key: 'onTimeRate',      label: 'On-time' },
  { key: 'participation',   label: 'Participation' },
  { key: 'hoursLogged',     label: 'Hours' },
  { key: 'efficiency',      label: 'Efficiency' },
  { key: 'deliveryVolume',  label: 'Volume' },
];

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
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const ov = overall(dev);
    const color = getColor(ov);

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: METRICS.map(m => m.label),
        datasets: [{
          data: METRICS.map(m => dev[m.key] ?? 1),
          backgroundColor: color + '22',
          borderColor: color,
          borderWidth: 2.5,
          pointBackgroundColor: color,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 99,
            ticks: {
              stepSize: 33,
              font: { size: 11 },
              color: '#90A4AE',
              backdropColor: 'transparent',
            },
            grid:        { color: 'rgba(0,0,0,0.08)' },
            angleLines:  { color: 'rgba(0,0,0,0.08)' },
            pointLabels: { font: { size: 13 }, color: '#546E7A' },
          },
        },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [dev]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: 260 }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Radar de métricas de ${dev.developerName}`}
      />
    </Box>
  );
}

function Avatar({ dev, color, initials }) {
  return (
    <Box sx={{
      width: 44, height: 44, borderRadius: '50%',
      bgcolor: color + '22',
      flexShrink: 0,
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {dev.profilePicture ? (
        <img
          src={dev.profilePicture}
          alt={dev.developerName}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <Typography sx={{ fontSize: 15, fontWeight: 700, color }}>
          {initials}
        </Typography>
      )}
    </Box>
  );
}

function DevCard({ dev }) {
  const ov    = overall(dev);
  const color = getColor(ov);
  const initials = dev.developerName
    .split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase();

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(0,0,0,0.08)',
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        p: 2.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: '#FAFAFA',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar dev={dev} color={color} initials={initials} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1A1A1A', lineHeight: 1.2 }} noWrap>
            {dev.developerName}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: '#78909C' }}>
            {dev._done ?? 0} done · {dev._total ?? 0} assigned
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>
            {ov}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#90A4AE', fontWeight: 600 }}>
            overall
          </Typography>
        </Box>
      </Box>

      {/* Radar */}
      <RadarChart dev={dev} />

      {/* Mini stats */}
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 0.75, mt: 0.5,
      }}>
        {METRICS.map(m => (
          <Box key={m.key} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#37474F' }}>
              {dev[m.key] ?? 1}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#90A4AE' }}>
              {m.label}
            </Typography>
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
    fetch(`${base}/api/insights/sprint/${sprintId}/developer-radar`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setDevs(Array.isArray(data) ? data : []))
      .catch(() => setDevs([]));
  }, [sprintId]);

  if (devs.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ fontSize: '0.8rem', color: '#90A4AE', fontWeight: 600, mb: 1.5 }}>
        Scores normalized relative to team — higher is better within the sprint.
      </Typography>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 2.5,
      }}>
        {devs.map(d => <DevCard key={d.developerName} dev={d} />)}
      </Box>
    </Box>
  );
}