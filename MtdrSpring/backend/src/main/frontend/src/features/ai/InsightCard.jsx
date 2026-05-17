import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { useTheme } from '@mui/material/styles';
import {
  Sparkles,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BarChart2,
  FileText,
  Lightbulb,
  Users,
} from 'lucide-react';
import { API_BASE, getErrorMessage, AI_INSIGHTS_EMPTY } from './aiInsightsConstants';
import {
  AlertCard,
  SectionHeading,
  AlertTypesLegend,
  ActionableRecommendationsList,
  ExecutiveSummaryBlock,
  PredictionsBlock,
  BlockedAssignmentsSnapshot,
} from './InsightCardParts';

function normalizeRecommendationKey(rec) {
  const cat = String(rec?.category ?? '')
    .trim()
    .toLowerCase();
  const text = String(rec?.text ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return `${cat}::${text}`;
}

/**
 * Merges Gemini `actionableRecommendations` with structured `workloadRecommendations`.
 * Avoids duplicate "Workload redistribution": Gemini often already emits that category while
 * the API also returns workload rows — we prefer structured rows and drop matching AI lines.
 */
function computeRecommendationList(ins) {
  if (!ins) return [];
  const actionables = [...(ins.actionableRecommendations ?? [])];
  const workloadRows = [...(ins.workloadRecommendations ?? [])];
  const structuredWorkload = workloadRows.map((r) => {
    const from = r.from ? String(r.from).trim() : '';
    const to = r.to ? String(r.to).trim() : '';
    const n = r.tasksToMove;
    const rs = typeof r.reason === 'string' ? r.reason.trim() : '';
    const hasMove = from && to && n != null && Number.isFinite(Number(n));
    const head = hasMove ? `Move ~${n} task(s) from ${from} to ${to}` : `Move ~${n ?? '?'} task(s)`;
    const text = rs ? `${head}: ${rs}` : `${head}.`;
    return {
      category: 'workload_redistribution',
      text,
    };
  });

  const dropAiWorkloadDuplicates = structuredWorkload.length > 0;
  const merged = [
    ...(dropAiWorkloadDuplicates
      ? actionables.filter(
          (r) => String(r?.category ?? '').toLowerCase() !== 'workload_redistribution',
        )
      : actionables),
    ...structuredWorkload,
  ];

  const seen = new Set();
  const out = [];
  for (const rec of merged) {
    if (!rec || typeof rec.text !== 'string' || !rec.text.trim()) continue;
    const key = normalizeRecommendationKey(rec);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}

export default function InsightCard({
  sprintId,
  sprintLabel,
  showPredictionsSection = true,
  showNextSprintForecast = true,
  nextSprintLabel = null,
  nextSprintActualScore = null,
  currentSprintActualScore = null,
  currentSprintMetrics = null,
  refreshToken = 0,
  onOpenTeam = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  
  const [status, setStatus] = useState('idle');
  const [insights, setInsights] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [lastGeneratedAtMs, setLastGeneratedAtMs] = useState(null);
  const cancelPollRef = useRef(false);

  const parseGeneratedAtMs = (value) => {
    const ms = new Date(value ?? '').getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const loadExisting = useCallback(async () => {
    if (!sprintId) return;
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setLastGeneratedAtMs(parseGeneratedAtMs(data.generatedAt));
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
    setLastGeneratedAtMs(null);
    cancelPollRef.current = false;
    loadExisting();
    return () => {
      cancelPollRef.current = true;
    };
  }, [sprintId, loadExisting]);

  useEffect(() => {
    if (!sprintId || refreshToken === 0) return;
    loadExisting();
  }, [refreshToken, sprintId, loadExisting]);

  // Iterative loop — NOT recursive. Each iteration awaits before the next,
  // so the attempt counter increments correctly and the loop terminates at MAX_ATTEMPTS.
  const pollForResults = useCallback(
    async (minGeneratedAtMs = null) => {
      const MAX_ATTEMPTS = 12;
      const INTERVAL_MS = 2500;
      for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
        await new Promise((r) => setTimeout(r, INTERVAL_MS));
        if (cancelPollRef.current) return;
        try {
          const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}`, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          });
          if (cancelPollRef.current) return;
          if (res.ok) {
            const data = await res.json();
            // Backend persisted an error → stop polling immediately
            if (data.error) {
              setError(getErrorMessage(data.error));
              setStatus('error');
              return;
            }
            const generatedAtMs = parseGeneratedAtMs(data.generatedAt);
            const hasFreshGeneration =
              minGeneratedAtMs == null ||
              (generatedAtMs != null && generatedAtMs > Number(minGeneratedAtMs));
            if (!hasFreshGeneration) {
              setPollCount(attempt + 1);
              continue;
            }
            setInsights(data.insights);
            setAcknowledged(data.acknowledged ?? false);
            setLastGeneratedAtMs(generatedAtMs);
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
    },
    [sprintId],
  );

  const handleGenerate = async () => {
    cancelPollRef.current = true;
    setStatus('generating');
    setError(null);
    setInsights(null);
    setPollCount(0);
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/generate`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('POST failed');
      cancelPollRef.current = false;
      setStatus('polling');
      pollForResults(lastGeneratedAtMs);
    } catch {
      setError('Could not start AI analysis. Check server connection.');
      setStatus('error');
    }
  };

  const handleAcknowledge = async () => {
    try {
      await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/acknowledge`, {
        method: 'PATCH',
        cache: 'no-store',
      });
      setAcknowledged(true);
    } catch {
      /* non-critical */
    }
  };

  const alertCounts = insights?.alerts
    ? {
        critical: insights.alerts.filter((a) => a.severity === 'critical').length,
        warning: insights.alerts.filter((a) => a.severity === 'warning').length,
        info: insights.alerts.filter((a) => a.severity === 'info').length,
      }
    : null;

  const recommendationList = useMemo(() => computeRecommendationList(insights), [insights]);

  const hasExtendedPredictions =
    insights?.predictions &&
    (insights.predictions.productivityOutlook ||
      insights.predictions.risks ||
      insights.predictions.deliveryEstimate);
  const hasPredictionsContent =
    insights && (Boolean(hasExtendedPredictions) || Boolean(insights.productivityPrediction));

  return (
    <Paper
      sx={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        p: { xs: 2.5, sm: 3.5, md: 4.5 },
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(103,58,183,0.3)' : 'rgba(103,58,183,0.18)'}`,
        borderLeft: '4px solid #673AB7',
        boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
        bgcolor: 'background.paper',
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
          <Sparkles size={22} color="#673AB7" />
          <Typography
            sx={{ fontWeight: 700, fontSize: { xs: '1.05rem', md: '1.2rem' }, color: 'text.primary' }}
          >
            {sprintLabel}
          </Typography>
          {alertCounts && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {alertCounts.critical > 0 && (
                <Chip
                  label={`${alertCounts.critical} critical`}
                  sx={{
                    height: 26,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    bgcolor: '#C62828',
                    color: '#fff',
                    borderRadius: 1,
                  }}
                />
              )}
              {alertCounts.warning > 0 && (
                <Chip
                  label={`${alertCounts.warning} warning(s)`}
                  sx={{
                    height: 26,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    bgcolor: '#E65100',
                    color: '#fff',
                    borderRadius: 1,
                  }}
                />
              )}
              {alertCounts.info > 0 && (
                <Chip
                  label={`${alertCounts.info} info`}
                  sx={{
                    height: 26,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    bgcolor: '#1565C0',
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
              <IconButton onClick={handleGenerate} sx={{ color: isDark ? '#9A9A9A' : '#607D8B', p: 1 }}>
                <RefreshCw size={20} />
              </IconButton>
            </Tooltip>
          )}
          {status === 'loaded' && (
            <IconButton onClick={() => setExpanded((v) => !v)} sx={{ color: isDark ? '#9A9A9A' : '#607D8B', p: 1 }}>
              {expanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Idle / Error */}
      {(status === 'idle' || status === 'error') && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
          <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: 'text.secondary' }}>
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
                bgcolor: isDark ? '#4A1A1A' : '#FFEBEE',
                borderRadius: 1.5,
                border: `1px solid ${isDark ? '#7F3030' : '#EF9A9A'}`,
              }}
            >
              <AlertCircle size={14} color="#C62828" style={{ marginTop: 1, flexShrink: 0 }} />
              <Typography
                sx={{
                  fontSize: { xs: '0.9rem', md: '0.95rem' },
                  color: '#C62828',
                  lineHeight: 1.45,
                }}
              >
                {error}
              </Typography>
            </Box>
          )}
          <Button
            variant="contained"
            startIcon={<Sparkles size={18} />}
            onClick={handleGenerate}
            sx={{
              alignSelf: 'flex-start',
              bgcolor: '#673AB7',
              '&:hover': { bgcolor: '#512DA8' },
              borderRadius: 1.5,
              textTransform: 'none',
              fontWeight: 700,
              fontSize: { xs: '0.9rem', md: '1rem' },
              py: 1.25,
              px: 2.5,
            }}
          >
            {status === 'error' ? 'Try again' : 'Generate'}
          </Button>
        </Box>
      )}

      {/* Generating / Polling */}
      {(status === 'generating' || status === 'polling') && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <CircularProgress size={24} sx={{ color: '#C74634' }} />
          <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: 'text.secondary' }}>
            {status === 'generating'
              ? 'Sending to Gemini…'
              : `Waiting for response${pollCount > 0 ? ` (${pollCount * 2}s elapsed)` : ''}…`}
          </Typography>
        </Box>
      )}

      {/* Loaded */}
      {status === 'loaded' && insights && (
        <Collapse in={expanded}>
          {/* Snapshot counters */}
          <Box
            sx={{
              mb: { xs: 2.5, md: 3.5 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
            }}
          >
            {[
              {
                label: 'Critical alerts',
                value: alertCounts?.critical ?? 0,
                color: '#B71C1C',
                bg: isDark ? '#4A1A1A' : '#FFEBEE',
                border: isDark ? '#7F3030' : '#FFCDD2',
              },
              {
                label: 'Warnings',
                value: alertCounts?.warning ?? 0,
                color: '#E65100',
                bg: isDark ? '#4A2A1A' : '#FFF3E0',
                border: isDark ? '#7F4A1A' : '#FFE0B2',
              },
              {
                label: 'Recommendations',
                value: recommendationList.length,
                color: '#2E7D32',
                bg: isDark ? '#1A4A2A' : '#E8F5E9',
                border: isDark ? '#2E7D32' : '#C8E6C9',
              },
            ].map((s) => (
              <Box
                key={s.label}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  border: `1px solid ${s.border}`,
                  bgcolor: s.bg,
                  textAlign: 'center',
                }}
              >
                <Typography
                  sx={{ fontSize: '1.7rem', lineHeight: 1.1, fontWeight: 800, color: s.color }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.8rem', color: isDark ? '#9A9A9A' : '#607D8B', fontWeight: 600, mt: 0.25 }}
                >
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <BlockedAssignmentsSnapshot rows={insights.blockedAssignments} />

          {/* Main two-column dashboard-like layout */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
              gap: { xs: 2, md: 2.5 },
              mb: { xs: 3, md: 4 },
            }}
          >
            {/* Left column: alerts + executive summary */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    bgcolor: isDark ? '#2A1A3D' : '#F3E5F5',
                    borderBottom: `1px solid ${isDark ? 'rgba(156,39,176,0.3)' : 'rgba(156,39,176,0.18)'}`,
                  }}
                >
                  <SectionHeading icon={BarChart2}>Automatic alerts</SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                  <AlertTypesLegend />
                  {insights.alerts?.length > 0 ? (
                    insights.alerts.map((a, i) => (
                      <AlertCard key={i} alert={a} currentSprintMetrics={currentSprintMetrics} />
                    ))
                  ) : (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: { xs: 2, md: 2.5 },
                        bgcolor: isDark ? '#1A4A2A' : '#E8F5E9',
                        borderRadius: 1.5,
                        border: `1px solid ${isDark ? '#2E7D32' : '#A5D6A7'}`,
                      }}
                    >
                      <CheckCircle size={20} color="#2E7D32" />
                      <Typography
                        sx={{
                          fontSize: { xs: '0.95rem', md: '1.05rem' },
                          color: '#2E7D32',
                          fontWeight: 600,
                        }}
                      >
                        No alerts — this sprint looks healthy.
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              <Box
                sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{ px: 2, py: 1.25, bgcolor: isDark ? '#1A3A5C' : '#E3F2FD', borderBottom: `1px solid ${isDark ? '#1A3A5C' : '#BBDEFB'}` }}
                >
                  <SectionHeading icon={FileText}>Sprint summary</SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                  {(() => {
                    const es = insights.executiveSummary;
                    const hasExecFields =
                      es && (es.overview || es.trends || es.improvementAreas || es.nextSteps);
                    const tsb = insights.taskStatusBreakdown;
                    const hasTaskStatus = tsb != null && tsb.total != null;
                    const showSummaryBlock =
                      Boolean(hasExecFields) || hasTaskStatus || Boolean(insights.summary);
                    if (showSummaryBlock) {
                      return (
                        <ExecutiveSummaryBlock
                          executiveSummary={insights.executiveSummary}
                          fallbackSummary={hasExecFields ? null : insights.summary}
                          taskStatusBreakdown={tsb}
                          currentSprintActualScore={currentSprintActualScore}
                          currentSprintMetrics={currentSprintMetrics}
                        />
                      );
                    }
                    return (
                      <Typography
                        sx={{
                          fontSize: { xs: '0.95rem', md: '1rem' },
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      >
                        {AI_INSIGHTS_EMPTY.executive}
                      </Typography>
                    );
                  })()}
                </Box>
              </Box>
            </Box>

            {/* Right column: recommendations + predictions */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box
                sx={{
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: 'background.paper',
                }}
              >
                <Box
                  sx={{ px: 2, py: 1.25, bgcolor: isDark ? '#1A4A2A' : '#E8F5E9', borderBottom: `1px solid ${isDark ? '#2E7D32' : '#C8E6C9'}` }}
                >
                  <SectionHeading icon={Lightbulb}>Actionable recommendations</SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                  {recommendationList.length > 0 ? (
                    <ActionableRecommendationsList items={recommendationList} />
                  ) : (
                    <Typography
                      sx={{
                        fontSize: { xs: '0.95rem', md: '1rem' },
                        color: 'text.secondary',
                        fontStyle: 'italic',
                      }}
                    >
                      {AI_INSIGHTS_EMPTY.recommendations}
                    </Typography>
                  )}
                </Box>
              </Box>
              {/* Predictions: only for active sprint (or latest if no active) — see AIInsightsPage */}
              {showPredictionsSection && (
                <Box
                  sx={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                  }}
                >
                  <Box
                    sx={{ px: 2, py: 1.25, bgcolor: isDark ? '#4A3A1A' : '#FFF8E1', borderBottom: `1px solid ${isDark ? '#7F6A1A' : '#FFECB3'}` }}
                  >
                    <SectionHeading icon={Sparkles}>Predictions</SectionHeading>
                  </Box>
                  <Box sx={{ p: { xs: 1.5, md: 2 } }}>
                    {hasPredictionsContent ? (
                      <PredictionsBlock
                        predictions={insights.predictions}
                        productivityPrediction={insights.productivityPrediction}
                        showNextSprintForecast={showNextSprintForecast}
                        nextSprintLabel={nextSprintLabel}
                        nextSprintActualScore={nextSprintActualScore}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: { xs: '0.95rem', md: '1rem' },
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      >
                        {AI_INSIGHTS_EMPTY.predictions}
                      </Typography>
                    )}
                    <Typography
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1.5, fontSize: '0.85rem' }}
                    >
                      Per sprint — outlook, risks, and delivery estimate from the latest AI run.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Link to Team (metrics & radars) */}
          {typeof onOpenTeam === 'function' && (
            <Box sx={{ mb: { xs: 2, md: 3 } }}>
              <Divider sx={{ mb: 2, borderColor: isDark ? '#2A2C32' : '#E0E0E0' }} />
              <Button
                variant="contained"
                size="medium"
                startIcon={<Users size={22} color="#fff" strokeWidth={2.25} />}
                onClick={() => onOpenTeam(sprintId)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: { xs: '0.95rem', sm: '1rem' },
                  minHeight: 48,
                  py: 1.25,
                  px: 2.75,
                  borderRadius: 2,
                  bgcolor: '#E53935',
                  color: '#fff',
                  boxShadow: isDark ? '0 2px 8px rgba(229, 57, 53, 0.35)' : '0 2px 8px rgba(229, 57, 53, 0.45)',
                  transition:
                    'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                  '&:hover': {
                    bgcolor: '#C62828',
                    boxShadow: isDark ? '0 4px 14px rgba(198, 40, 40, 0.45)' : '0 4px 14px rgba(198, 40, 40, 0.55)',
                    transform: 'translateY(-1px)',
                  },
                  '&:active': {
                    transform: 'translateY(0)',
                    boxShadow: isDark ? '0 2px 6px rgba(198, 40, 40, 0.4)' : '0 2px 6px rgba(198, 40, 40, 0.5)',
                  },
                  '& .MuiButton-startIcon': { color: '#fff', mr: 1 },
                }}
              >
                Open Team
              </Button>
            </Box>
          )}
          {!acknowledged && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.25 }}>
              <Button
                variant="outlined"
                onClick={handleAcknowledge}
                sx={{
                  borderColor: '#673AB7',
                  color: '#673AB7',
                  borderRadius: 1.5,
                  textTransform: 'none',
                  fontSize: { xs: '0.9rem', md: '0.95rem' },
                  fontWeight: 600,
                  py: 1,
                  px: 2,
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
              <Typography sx={{ fontSize: '0.9rem', color: '#2E7D32', fontWeight: 600 }}>
                Reviewed
              </Typography>
            </Box>
          )}
        </Collapse>
      )}
    </Paper>
  );
}