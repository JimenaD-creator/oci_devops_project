import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
} from 'lucide-react';
import { KPI_LABELS } from './aiInsightsConstants';

const SEVERITY = {
  critical: {
    color: '#C62828',
    bg: '#FFEBEE',
    border: '#EF9A9A',
    label: 'Critical',
    Icon: AlertCircle,
  },
  warning: {
    color: '#E65100',
    bg: '#FFF3E0',
    border: '#FFCC80',
    label: 'Warning',
    Icon: AlertTriangle,
  },
  info: { color: '#01579B', bg: '#E3F2FD', border: '#90CAF9', label: 'Info', Icon: Info },
};

export function AlertCard({ alert }) {
  const cfg = SEVERITY[alert.severity] ?? SEVERITY.info;
  const { Icon } = cfg;
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        mb: 1,
      }}
    >
      <Icon size={16} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Chip
            label={cfg.label}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: cfg.color,
              color: '#fff',
              borderRadius: 1,
            }}
          />
          {alert.kpi && (
            <Typography sx={{ fontSize: '0.7rem', color: '#607D8B', fontWeight: 600 }}>
              {KPI_LABELS[alert.kpi] ?? alert.kpi}
              {alert.value != null ? ` — ${alert.value}%` : ''}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: '#37474F', lineHeight: 1.45 }}>
          {alert.message}
        </Typography>
      </Box>
    </Box>
  );
}

export function WorkloadCard({ rec }) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: '#F3E5F5',
        border: '1px solid #CE93D8',
        mb: 1,
        display: 'flex',
        gap: 1.5,
      }}
    >
      <Users size={16} color="#7B1FA2" style={{ marginTop: 2, flexShrink: 0 }} />
      <Box>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#4A148C', mb: 0.25 }}>
          Move ~{rec.tasksToMove} task{rec.tasksToMove !== 1 ? 's' : ''}
          {rec.from ? ` from ${rec.from}` : ''}
          {rec.to ? ` → ${rec.to}` : ''}
        </Typography>
        <Typography sx={{ fontSize: '0.76rem', color: '#6A1B9A', lineHeight: 1.4 }}>
          {rec.reason}
        </Typography>
      </Box>
    </Box>
  );
}

export function PredictionCard({ prediction }) {
  const TrendIcon =
    prediction.trend === 'up' ? TrendingUp : prediction.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    prediction.trend === 'up' ? '#2E7D32' : prediction.trend === 'down' ? '#C62828' : '#607D8B';
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 1.5,
        bgcolor: '#F1F8E9',
        border: '1px solid #A5D6A7',
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 56 }}>
        <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: trendColor, lineHeight: 1 }}>
          {prediction.predictedScore}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: '#607D8B', fontWeight: 600 }}>
          % predicted
        </Typography>
        <TrendIcon size={18} color={trendColor} style={{ marginTop: 4 }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1B5E20', mb: 0.25 }}>
          Next Sprint Forecast
          {prediction.confidence && (
            <span style={{ fontWeight: 400, color: '#607D8B', marginLeft: 6 }}>
              ({prediction.confidence} confidence)
            </span>
          )}
        </Typography>
        <Typography sx={{ fontSize: '0.77rem', color: '#37474F', lineHeight: 1.45 }}>
          {prediction.reasoning}
        </Typography>
      </Box>
    </Box>
  );
}
