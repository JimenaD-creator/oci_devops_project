import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Box, Typography, Button, Paper, CircularProgress, Divider,
  Collapse, IconButton, Tooltip, FormControl, InputLabel, Select, MenuItem, Chip,
} from '@mui/material';
import {
  Sparkles, AlertTriangle, AlertCircle, Info, TrendingUp, TrendingDown,
  Minus, Users, CheckCircle, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fetchDashboardSprints } from '../dashboard/dashboardSprintData';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
const pageEase = [0.22, 1, 0.36, 1];

const ERROR_MESSAGES = {
  QUOTA_EXCEEDED:      'The AI quota for today has been reached. Please try again tomorrow or use a different API key.',
  API_KEY_MISSING:     'Gemini API key is not configured on the server. Contact your administrator.',
  MODEL_NOT_FOUND:     'The AI model is unavailable. Contact your administrator.',
  SPRINT_NOT_FOUND:    'This sprint was not found in the database.',
  NO_PROJECT_ASSIGNED: 'This sprint has no project assigned. Assign a project before generating insights.',
  GENERATION_FAILED:   'AI generation failed unexpectedly. Please try again.',
};
function getErrorMessage(code) {
  return ERROR_MESSAGES[code] ?? `Generation failed: ${code}`;
}

const SEVERITY = {
  critical: { color: '#C62828', bg: '#FFEBEE', border: '#EF9A9A', label: 'Critical', Icon: AlertCircle },
  warning:  { color: '#E65100', bg: '#FFF3E0', border: '#FFCC80', label: 'Warning',  Icon: AlertTriangle },
  info:     { color: '#01579B', bg: '#E3F2FD', border: '#90CAF9', label: 'Info',     Icon: Info },
};
const KPI_LABELS = {
  completionRate: 'Completion Rate', onTimeDelivery: 'On-Time Delivery',
  teamParticipation: 'Team Participation', workloadBalance: 'Workload Balance',
  productivityScore: 'Productivity Score',
};

function AlertCard({ alert }) {
  const cfg = SEVERITY[alert.severity] ?? SEVERITY.info;
  const { Icon } = cfg;
  return (
    <Box sx={{ display:'flex', gap:1.5, p:1.5, borderRadius:1.5, bgcolor:cfg.bg, border:`1px solid ${cfg.border}`, mb:1 }}>
      <Icon size={16} color={cfg.color} style={{ marginTop:2, flexShrink:0 }} />
      <Box sx={{ flex:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.25 }}>
          <Chip label={cfg.label} size="small"
            sx={{ height:18, fontSize:'0.65rem', fontWeight:700, bgcolor:cfg.color, color:'#fff', borderRadius:1 }} />
          {alert.kpi && (
            <Typography sx={{ fontSize:'0.7rem', color:'#607D8B', fontWeight:600 }}>
              {KPI_LABELS[alert.kpi] ?? alert.kpi}{alert.value != null ? ` — ${alert.value}%` : ''}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize:'0.8rem', color:'#37474F', lineHeight:1.45 }}>{alert.message}</Typography>
      </Box>
    </Box>
  );
}

function WorkloadCard({ rec }) {
  return (
    <Box sx={{ p:1.5, borderRadius:1.5, bgcolor:'#F3E5F5', border:'1px solid #CE93D8', mb:1, display:'flex', gap:1.5 }}>
      <Users size={16} color="#7B1FA2" style={{ marginTop:2, flexShrink:0 }} />
      <Box>
        <Typography sx={{ fontSize:'0.78rem', fontWeight:700, color:'#4A148C', mb:0.25 }}>
          Move ~{rec.tasksToMove} task{rec.tasksToMove !== 1 ? 's' : ''}
          {rec.from ? ` from ${rec.from}` : ''}{rec.to ? ` → ${rec.to}` : ''}
        </Typography>
        <Typography sx={{ fontSize:'0.76rem', color:'#6A1B9A', lineHeight:1.4 }}>{rec.reason}</Typography>
      </Box>
    </Box>
  );
}

function PredictionCard({ prediction }) {
  const TrendIcon = prediction.trend === 'up' ? TrendingUp : prediction.trend === 'down' ? TrendingDown : Minus;
  const trendColor = prediction.trend === 'up' ? '#2E7D32' : prediction.trend === 'down' ? '#C62828' : '#607D8B';
  return (
    <Box sx={{ p:1.75, borderRadius:1.5, bgcolor:'#F1F8E9', border:'1px solid #A5D6A7', display:'flex', gap:2, alignItems:'flex-start' }}>
      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:56 }}>
        <Typography sx={{ fontSize:'1.8rem', fontWeight:800, color:trendColor, lineHeight:1 }}>
          {prediction.predictedScore}
        </Typography>
        <Typography sx={{ fontSize:'0.65rem', color:'#607D8B', fontWeight:600 }}>% predicted</Typography>
        <TrendIcon size={18} color={trendColor} style={{ marginTop:4 }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize:'0.78rem', fontWeight:700, color:'#1B5E20', mb:0.25 }}>
          Next Sprint Forecast
          {prediction.confidence && (
            <span style={{ fontWeight:400, color:'#607D8B', marginLeft:6 }}>({prediction.confidence} confidence)</span>
          )}
        </Typography>
        <Typography sx={{ fontSize:'0.77rem', color:'#37474F', lineHeight:1.45 }}>{prediction.reasoning}</Typography>
      </Box>
    </Box>
  );
}

function InsightCard({ sprintId, sprintLabel }) {
  const [status, setStatus]             = useState('idle');
  const [insights, setInsights]         = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded]         = useState(true);
  const [error, setError]               = useState(null);
  const [pollCount, setPollCount]       = useState(0);
  const cancelPollRef = useRef(false);

  const loadExisting = useCallback(async () => {
    if (!sprintId) return;
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.error) { setError(getErrorMessage(data.error)); setStatus('error'); return; }
        setInsights(data.insights);
        setAcknowledged(data.acknowledged ?? false);
        setStatus('loaded');
      }
    } catch { /* network error on initial load — stay idle */ }
  }, [sprintId]);

  useEffect(() => {
    cancelPollRef.current = true;
    setInsights(null); setStatus('idle'); setAcknowledged(false); setError(null); setPollCount(0);
    cancelPollRef.current = false;
    loadExisting();
    return () => { cancelPollRef.current = true; };
  }, [sprintId, loadExisting]);

  // Iterative loop — NOT recursive. Each iteration awaits before the next,
  // so the attempt counter increments correctly and the loop terminates at MAX_ATTEMPTS.
  const pollForResults = useCallback(async () => {
    const MAX_ATTEMPTS = 12;
    const INTERVAL_MS  = 2500;
    for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise(r => setTimeout(r, INTERVAL_MS));
      if (cancelPollRef.current) return;
      try {
        const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`);
        if (cancelPollRef.current) return;
        if (res.ok) {
          const data = await res.json();
          // Backend persisted an error → stop polling immediately
          if (data.error) { setError(getErrorMessage(data.error)); setStatus('error'); return; }
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
    if (!cancelPollRef.current) { setError('Took too long to generate. Please try again.'); setStatus('error'); }
  }, [sprintId]);

  const handleGenerate = async () => {
    cancelPollRef.current = true;
    setStatus('generating'); setError(null); setInsights(null); setPollCount(0);
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/generate`, { method: 'POST' });
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
    } catch { /* non-critical */ }
  };

  const alertCounts = insights?.alerts ? {
    critical: insights.alerts.filter(a => a.severity === 'critical').length,
    warning:  insights.alerts.filter(a => a.severity === 'warning').length,
  } : null;

  return (
    <Paper sx={{ p:2.5, borderRadius:2, border:'1px solid rgba(103,58,183,0.18)', borderLeft:'4px solid #673AB7', boxShadow:'0 2px 10px rgba(0,0,0,0.05)' }}>
      {/* Header */}
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb: status==='loaded' && expanded ? 1.5 : 0 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
          <Sparkles size={15} color="#673AB7" />
          <Typography sx={{ fontWeight:700, fontSize:'0.85rem', color:'#1A1A1A' }}>{sprintLabel}</Typography>
          {alertCounts && (
            <Box sx={{ display:'flex', gap:0.5 }}>
              {alertCounts.critical > 0 && <Chip label={`${alertCounts.critical} critical`} size="small"
                sx={{ height:18, fontSize:'0.65rem', fontWeight:700, bgcolor:'#C62828', color:'#fff', borderRadius:1 }} />}
              {alertCounts.warning > 0 && <Chip label={`${alertCounts.warning} warning`} size="small"
                sx={{ height:18, fontSize:'0.65rem', fontWeight:700, bgcolor:'#E65100', color:'#fff', borderRadius:1 }} />}
            </Box>
          )}
        </Box>
        <Box sx={{ display:'flex', gap:0.5, alignItems:'center' }}>
          {status === 'loaded' && (
            <Tooltip title="Regenerate">
              <IconButton size="small" onClick={handleGenerate} sx={{ color:'#607D8B' }}><RefreshCw size={13} /></IconButton>
            </Tooltip>
          )}
          {status === 'loaded' && (
            <IconButton size="small" onClick={() => setExpanded(v => !v)} sx={{ color:'#607D8B' }}>
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Idle / Error */}
      {(status === 'idle' || status === 'error') && (
        <Box sx={{ display:'flex', flexDirection:'column', gap:1, mt:0.5 }}>
          <Typography sx={{ fontSize:'0.78rem', color:'#607D8B' }}>
            {status === 'idle' ? 'No insights generated yet for this sprint.' : 'Could not generate insights for this sprint.'}
          </Typography>
          {error && (
            <Box sx={{ display:'flex', alignItems:'flex-start', gap:1, p:1.25, bgcolor:'#FFEBEE', borderRadius:1.5, border:'1px solid #EF9A9A' }}>
              <AlertCircle size={14} color="#C62828" style={{ marginTop:1, flexShrink:0 }} />
              <Typography sx={{ fontSize:'0.75rem', color:'#C62828', lineHeight:1.45 }}>{error}</Typography>
            </Box>
          )}
          <Button variant="contained" size="small" startIcon={<Sparkles size={13} />} onClick={handleGenerate}
            sx={{ alignSelf:'flex-start', bgcolor:'#673AB7', '&:hover':{ bgcolor:'#512DA8' }, borderRadius:1.5, textTransform:'none', fontWeight:700, fontSize:'0.78rem' }}>
            {status === 'error' ? 'Try again' : 'Generate'}
          </Button>
        </Box>
      )}

      {/* Generating / Polling */}
      {(status === 'generating' || status === 'polling') && (
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, py:0.5 }}>
          <CircularProgress size={16} sx={{ color:'#673AB7' }} />
          <Typography sx={{ fontSize:'0.78rem', color:'#607D8B' }}>
            {status === 'generating' ? 'Sending to Gemini…' : `Waiting for response${pollCount > 0 ? ` (${pollCount * 2}s elapsed)` : ''}…`}
          </Typography>
        </Box>
      )}

      {/* Loaded */}
      {status === 'loaded' && insights && (
        <Collapse in={expanded}>
          {insights.summary && (
            <Box sx={{ p:1.25, borderRadius:1.5, bgcolor:'#EDE7F6', border:'1px solid #CE93D8', mb:1.5 }}>
              <Typography sx={{ fontSize:'0.8rem', color:'#37474F', lineHeight:1.5, fontStyle:'italic' }}>
                "{insights.summary}"
              </Typography>
            </Box>
          )}
          {insights.alerts?.length > 0 && (
            <Box sx={{ mb:1.5 }}>
              <Typography sx={{ fontSize:'0.7rem', fontWeight:700, color:'#607D8B', mb:0.75, textTransform:'uppercase', letterSpacing:'0.05em' }}>Alerts</Typography>
              {insights.alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
            </Box>
          )}
          {insights.alerts?.length === 0 && (
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5, p:1.25, bgcolor:'#E8F5E9', borderRadius:1.5, border:'1px solid #A5D6A7' }}>
              <CheckCircle size={14} color="#2E7D32" />
              <Typography sx={{ fontSize:'0.78rem', color:'#2E7D32', fontWeight:600 }}>No alerts — sprint looks healthy!</Typography>
            </Box>
          )}
          {insights.workloadRecommendations?.length > 0 && (
            <Box sx={{ mb:1.5 }}>
              <Divider sx={{ mb:1 }} />
              <Typography sx={{ fontSize:'0.7rem', fontWeight:700, color:'#607D8B', mb:0.75, textTransform:'uppercase', letterSpacing:'0.05em' }}>Workload</Typography>
              {insights.workloadRecommendations.map((r, i) => <WorkloadCard key={i} rec={r} />)}
            </Box>
          )}
          {insights.productivityPrediction && (
            <Box sx={{ mb: acknowledged ? 0 : 1.5 }}>
              <Divider sx={{ mb:1 }} />
              <Typography sx={{ fontSize:'0.7rem', fontWeight:700, color:'#607D8B', mb:0.75, textTransform:'uppercase', letterSpacing:'0.05em' }}>Forecast</Typography>
              <PredictionCard prediction={insights.productivityPrediction} />
            </Box>
          )}
          {!acknowledged && (
            <Box sx={{ display:'flex', justifyContent:'flex-end', mt:1.25 }}>
              <Button size="small" variant="outlined" onClick={handleAcknowledge}
                sx={{ borderColor:'#673AB7', color:'#673AB7', borderRadius:1.5, textTransform:'none', fontSize:'0.72rem', fontWeight:600, '&:hover':{ bgcolor:'rgba(103,58,183,0.06)' } }}>
                Mark as reviewed
              </Button>
            </Box>
          )}
          {acknowledged && (
            <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mt:1, justifyContent:'flex-end' }}>
              <CheckCircle size={13} color="#2E7D32" />
              <Typography sx={{ fontSize:'0.72rem', color:'#2E7D32', fontWeight:600 }}>Reviewed</Typography>
            </Box>
          )}
        </Collapse>
      )}
    </Paper>
  );
}

export default function AIInsightsPage({ projectId }) {
  const [sprints, setSprints]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  useEffect(() => {
    const pid = projectId != null && String(projectId).trim() !== ''
      ? String(projectId).trim()
      : (typeof localStorage !== 'undefined' ? String(localStorage.getItem('currentProjectId') || '').trim() : '');
    if (!pid) { setLoading(false); return; }
    fetchDashboardSprints(pid)
      .then(data => {
        const filtered = Array.isArray(data) ? data.filter(s => String(s.assignedProject?.id) === String(pid)) : [];
        setSprints(filtered);
        if (filtered.length > 0) {
          const active = filtered.find(s => { const now = new Date(); return now >= new Date(s.startDate) && now <= new Date(s.dueDate); });
          setSelectedSprintId(active?.id ?? filtered[filtered.length - 1]?.id ?? null);
        }
      })
      .catch(() => setSprints([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const selectedSprint = sprints.find(s => s.id === selectedSprintId);

  if (loading) return (
    <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'60vh' }}>
      <CircularProgress sx={{ color:'#673AB7' }} />
    </Box>
  );

  return (
    <Box component={motion.div} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
      transition={{ duration:0.35, ease:pageEase }} sx={{ maxWidth:900, width:'100%' }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:4, flexWrap:'wrap', gap:2 }}>
        <Box>
          <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.5 }}>
            <Sparkles size={22} color="#673AB7" />
            <Typography variant="h4" sx={{ fontWeight:800, color:'#1A1A1A', letterSpacing:'-0.5px' }}>AI Insights</Typography>
          </Box>
          <Typography variant="body2" sx={{ color:'#607D8B', fontWeight:600 }}>
            Gemini-powered sprint analysis — alerts, workload recommendations, and productivity forecasts
          </Typography>
        </Box>
        {sprints.length > 0 && (
          <FormControl size="small" sx={{ minWidth:200, '& .MuiOutlinedInput-root':{ borderRadius:2, bgcolor:'#FFFFFF' } }}>
            <InputLabel>Sprint</InputLabel>
            <Select value={selectedSprintId || ''} label="Sprint" onChange={e => setSelectedSprintId(Number(e.target.value))}>
              {sprints.map(s => <MenuItem key={s.id} value={s.id}>Sprint {s.id}</MenuItem>)}
            </Select>
          </FormControl>
        )}
      </Box>
      {sprints.length === 0 && (
        <Paper sx={{ p:4, textAlign:'center', borderRadius:2 }}>
          <Typography color="textSecondary">No sprints found for this project.</Typography>
        </Paper>
      )}
      {selectedSprint && (
        <InsightCard key={selectedSprint.id} sprintId={selectedSprint.id} sprintLabel={`Sprint ${selectedSprint.id}`} />
      )}
    </Box>
  );
}