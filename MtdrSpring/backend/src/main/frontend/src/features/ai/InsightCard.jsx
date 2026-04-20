import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { API_BASE, getErrorMessage } from './aiInsightsConstants';
import { AlertCard, WorkloadCard, PredictionCard } from './InsightCardParts';

export default function InsightCard({ sprintId, sprintLabel }) {
  const [status, setStatus] = useState('idle');
  const [insights, setInsights] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const cancelPollRef = useRef(false);

  const loadExisting = useCallback(async () => {
    if (!sprintId) return;
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setError(getErrorMessage(data.error));
          setStatus('error');
          return;
        }
        setInsights(data.insights);
        setAcknowledged(data.acknowledged ?? false);
        setStatus('loaded');
      }
    } catch {
      /* network error on initial load — stay idle */
    }
  }, [sprintId]);

  useEffect(() => {
    cancelPollRef.current = true;
    setInsights(null);
    setStatus('idle');
    setAcknowledged(false);
    setError(null);
    setPollCount(0);
    cancelPollRef.current = false;
    loadExisting();
    return () => {
      cancelPollRef.current = true;
    };
  }, [sprintId, loadExisting]);

  // Iterative loop — NOT recursive. Each iteration awaits before the next,
  // so the attempt counter increments correctly and the loop terminates at MAX_ATTEMPTS.
  const pollForResults = useCallback(async () => {
    const MAX_ATTEMPTS = 12;
    const INTERVAL_MS = 2500;
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      if (cancelPollRef.current) return;
      try {
        const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`);
        if (cancelPollRef.current) return;
        if (res.ok) {
          const data = await res.json();
          // Backend persisted an error → stop polling immediately
          if (data.error) {
            setError(getErrorMessage(data.error));
            setStatus('error');
            return;
          }
          setInsights(data.insights);
          setAcknowledged(data.acknowledged ?? false);
          setStatus('loaded');
          setPollCount(attempt + 1);
          return;
        }
        setPollCount(attempt + 1); // still 404 — keep waiting
      } catch {
        if (cancelPollRef.current) return;
        setPollCount(attempt + 1);
      }
    }
    if (!cancelPollRef.current) {
      setError('Took too long to generate. Please try again.');
      setStatus('error');
    }
  }, [sprintId]);

  const handleGenerate = async () => {
    cancelPollRef.current = true;
    setStatus('generating');
    setError(null);
    setInsights(null);
    setPollCount(0);
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/generate`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('POST failed');
      cancelPollRef.current = false;
      setStatus('polling');
      pollForResults();
    } catch {
      setError('Could not start AI analysis. Check server connection.');
      setStatus('error');
    }
  };

  const handleAcknowledge = async () => {
    try {
      await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/acknowledge`, { method: 'PATCH' });
      setAcknowledged(true);
    } catch {
      /* non-critical */
    }
  };

  const alertCounts = insights?.alerts
    ? {
        critical: insights.alerts.filter((a) => a.severity === 'critical').length,
        warning: insights.alerts.filter((a) => a.severity === 'warning').length,
      }
    : null;

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: '1px solid rgba(103,58,183,0.18)',
        borderLeft: '4px solid #673AB7',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: status === 'loaded' && expanded ? 1.5 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Sparkles size={15} color="#673AB7" />
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1A1A1A' }}>
            {sprintLabel}
          </Typography>
          {alertCounts && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {alertCounts.critical > 0 && (
                <Chip
                  label={`${alertCounts.critical} critical`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: '#C62828',
                    color: '#fff',
                    borderRadius: 1,
                  }}
                />
              )}
              {alertCounts.warning > 0 && (
                <Chip
                  label={`${alertCounts.warning} warning`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: '#E65100',
                    color: '#fff',
                    borderRadius: 1,
                  }}
                />
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {status === 'loaded' && (
            <Tooltip title="Regenerate">
              <IconButton size="small" onClick={handleGenerate} sx={{ color: '#607D8B' }}>
                <RefreshCw size={13} />
              </IconButton>
            </Tooltip>
          )}
          {status === 'loaded' && (
            <IconButton
              size="small"
              onClick={() => setExpanded((v) => !v)}
              sx={{ color: '#607D8B' }}
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Idle / Error */}
      {(status === 'idle' || status === 'error') && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: '0.78rem', color: '#607D8B' }}>
            {status === 'idle'
              ? 'No insights generated yet for this sprint.'
              : 'Could not generate insights for this sprint.'}
          </Typography>
          {error && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.25,
                bgcolor: '#FFEBEE',
                borderRadius: 1.5,
                border: '1px solid #EF9A9A',
              }}
            >
              <AlertCircle size={14} color="#C62828" style={{ marginTop: 1, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#C62828', lineHeight: 1.45 }}>
                {error}
              </Typography>
            </Box>
          )}
          <Button
            variant="contained"
            size="small"
            startIcon={<Sparkles size={13} />}
            onClick={handleGenerate}
            sx={{
              alignSelf: 'flex-start',
              bgcolor: '#673AB7',
              '&:hover': { bgcolor: '#512DA8' },
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
            }}
          >
            {status === 'error' ? 'Try again' : 'Generate'}
          </Button>
        </Box>
      )}

      {/* Generating / Polling */}
      {(status === 'generating' || status === 'polling') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <CircularProgress size={16} sx={{ color: '#673AB7' }} />
          <Typography sx={{ fontSize: '0.78rem', color: '#607D8B' }}>
            {status === 'generating'
              ? 'Sending to Gemini…'
              : `Waiting for response${pollCount > 0 ? ` (${pollCount * 2}s elapsed)` : ''}…`}
          </Typography>
        </Box>
      )}

      {/* Loaded */}
      {status === 'loaded' && insights && (
        <Collapse in={expanded}>
          {insights.summary && (
            <Box
              sx={{
                p: 1.25,
                borderRadius: 1.5,
                bgcolor: '#EDE7F6',
                border: '1px solid #CE93D8',
                mb: 1.5,
              }}
            >
              <Typography
                sx={{ fontSize: '0.8rem', color: '#37474F', lineHeight: 1.5, fontStyle: 'italic' }}
              >
                "{insights.summary}"
              </Typography>
            </Box>
          )}
          {insights.alerts?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#607D8B',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Alerts
              </Typography>
              {insights.alerts.map((a, i) => (
                <AlertCard key={i} alert={a} />
              ))}
            </Box>
          )}
          {insights.alerts?.length === 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1.5,
                p: 1.25,
                bgcolor: '#E8F5E9',
                borderRadius: 1.5,
                border: '1px solid #A5D6A7',
              }}
            >
              <CheckCircle size={14} color="#2E7D32" />
              <Typography sx={{ fontSize: '0.78rem', color: '#2E7D32', fontWeight: 600 }}>
                No alerts — sprint looks healthy!
              </Typography>
            </Box>
          )}
          {insights.workloadRecommendations?.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#607D8B',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Workload
              </Typography>
              {insights.workloadRecommendations.map((r, i) => (
                <WorkloadCard key={i} rec={r} />
              ))}
            </Box>
          )}
          {insights.productivityPrediction && (
            <Box sx={{ mb: acknowledged ? 0 : 1.5 }}>
              <Divider sx={{ mb: 1 }} />
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: '#607D8B',
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Forecast
              </Typography>
              <PredictionCard prediction={insights.productivityPrediction} />
            </Box>
          )}
          {!acknowledged && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={handleAcknowledge}
                sx={{
                  borderColor: '#673AB7',
                  color: '#673AB7',
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(103,58,183,0.06)' },
                }}
              >
                Mark as reviewed
              </Button>
            </Box>
          )}
          {acknowledged && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mt: 1,
                justifyContent: 'flex-end',
              }}
            >
              <CheckCircle size={13} color="#2E7D32" />
              <Typography sx={{ fontSize: '0.72rem', color: '#2E7D32', fontWeight: 600 }}>
                Reviewed
              </Typography>
            </Box>
          )}
        </Collapse>
      )}
    </Paper>
  );
}
