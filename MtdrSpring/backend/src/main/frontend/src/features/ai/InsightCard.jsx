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
} from 'lucide-react';
import {
  API_BASE,
  getErrorMessage,
  isApiKeyInsightError,
  isProcessingInsight,
  isValidSprintId,
  AI_INSIGHTS_EMPTY,
} from './aiInsightsConstants';
import { computeRecommendationList } from './insightRecommendationsSync';
import { clearSprintInsightsCache, fetchSprintInsights, peekSprintInsightsCache } from './insightsApi';
import { fetchAiStatus } from './aiStatusApi';
import {
  AlertCard,
  SectionHeading,
  AlertTypesLegend,
  ActionableRecommendationsList,
  ExecutiveSummaryBlock,
  PredictionsBlock,
  BlockedAssignmentsSnapshot,
} from './InsightCardParts';
import InsightsFreshnessBanner from './InsightsFreshnessBanner';
import { detectInsightsKpiDrift, INSIGHTS_KPI_LABELS } from './insightsFreshness';

export default function InsightCard({
  sprintId,
  sprintLabel,
  showPredictionsSection = true,
  showNextSprintForecast = true,
  nextSprintLabel = null,
  nextSprintActualScore = null,
  currentSprintActualScore = null,
  currentSprintMetrics = null,
  liveTaskStatusBreakdown = null,
  productivityDeltaPoints = null,
  refreshToken = 0,
  autoGenerateOnMissing = true,
  onPersistedInsightsChange = null,
  onInsightsFetchResult = null,
  sprintDevelopers = [],
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [status, setStatus] = useState('idle');
  const [insights, setInsights] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [pollCount, setPollCount] = useState(0);
  const [pollElapsedSec, setPollElapsedSec] = useState(0);
  const pollStartMsRef = useRef(null);
  const [lastGeneratedAtMs, setLastGeneratedAtMs] = useState(null);
  const lastGeneratedAtMsRef = useRef(null);
  const cancelPollRef = useRef(false);
  const autoGenInFlightRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const lastSprintIdRef = useRef(null);
  const onPersistedInsightsChangeRef = useRef(onPersistedInsightsChange);
  onPersistedInsightsChangeRef.current = onPersistedInsightsChange;
  const onInsightsFetchResultRef = useRef(onInsightsFetchResult);
  onInsightsFetchResultRef.current = onInsightsFetchResult;

  const notifyPersistedInsightsChange = useCallback(() => {
    onPersistedInsightsChangeRef.current?.();
  }, []);

  const publishInsightsFetch = useCallback(
    (payload) => {
      onInsightsFetchResultRef.current?.({ sprintId, ...payload });
    },
    [sprintId],
  );

  const parseGeneratedAtMs = (value) => {
    const ms = new Date(value ?? '').getTime();
    return Number.isFinite(ms) ? ms : null;
  };

  const pollDelayMs = useCallback((attempt, elapsedMs) => {
    if (attempt === 0) return 400;
    if (elapsedMs < 30_000) return 800;
    return 3000;
  }, []);

  // Iterative loop — NOT recursive. Each iteration awaits before the next,
  // so the attempt counter increments correctly and the loop terminates at MAX_ATTEMPTS.
  const pollForResults = useCallback(
    async (minGeneratedAtMs = null) => {
      // Gemini can take up to ~60s per attempt (with server-side retries on 503).
      const MAX_ATTEMPTS = 60;
      pollStartMsRef.current = Date.now();
      setPollElapsedSec(0);
      for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
        const elapsedMs = Date.now() - (pollStartMsRef.current ?? Date.now());
        await new Promise((r) => setTimeout(r, pollDelayMs(attempt, elapsedMs)));
        if (cancelPollRef.current) return;
        setPollElapsedSec(Math.floor((Date.now() - (pollStartMsRef.current ?? Date.now())) / 1000));
        try {
          const { notFound, data } = await fetchSprintInsights(sprintId, {
            retries: 1,
            skipCache: true,
            cacheMs: 0,
          });
          if (cancelPollRef.current) return;
          if (!notFound && data) {
            if (isProcessingInsight(data)) {
              setPollCount(attempt + 1);
              publishInsightsFetch({ loading: true, notFound: false, data });
              continue;
            }
            if (data.error) {
              // While regenerating, DB may still hold the previous failure until async save finishes.
              if (minGeneratedAtMs != null) {
                setPollCount(attempt + 1);
                continue;
              }
              if (isApiKeyInsightError(data.error)) {
                setErrorCode(data.error);
                setError(getErrorMessage(data.error));
                setStatus('error');
                return;
              }
              setInsights(null);
              setErrorCode(null);
              setError(null);
              setStatus('idle');
              return;
            }
            const generatedAtMs = parseGeneratedAtMs(data.generatedAt);
            const hasFreshGeneration =
              minGeneratedAtMs == null ||
              (generatedAtMs != null && generatedAtMs > Number(minGeneratedAtMs));
            if (!hasFreshGeneration || data.insights == null) {
              setPollCount(attempt + 1);
              continue;
            }
            setInsights(data.insights);
            setAcknowledged(data.acknowledged ?? false);
            lastGeneratedAtMsRef.current = generatedAtMs;
            setLastGeneratedAtMs(generatedAtMs);
            setErrorCode(null);
            setError(null);
            setStatus('loaded');
            setPollCount(attempt + 1);
            notifyPersistedInsightsChange();
            publishInsightsFetch({ loading: false, notFound: false, data });
            return;
          }
          setPollCount(attempt + 1);
        } catch {
          if (cancelPollRef.current) return;
          setPollCount(attempt + 1);
        }
      }
      if (!cancelPollRef.current) {
        setErrorCode(null);
        setError(
          'Took too long to generate. Gemini may still be processing — wait a minute and click Try again, or check the server logs.',
        );
        setStatus('error');
      }
    },
    [sprintId, notifyPersistedInsightsChange, publishInsightsFetch, pollDelayMs],
  );

  const startGeneration = useCallback(async () => {
    if (!isValidSprintId(sprintId)) return;
    cancelPollRef.current = true;
    clearSprintInsightsCache(sprintId);
    setStatus('generating');
    setError(null);
    setErrorCode(null);
    setInsights(null);
    setPollCount(0);
    setPollElapsedSec(0);
    publishInsightsFetch({ loading: true, notFound: false, data: null });
    try {
      const res = await fetch(`${API_BASE}/api/insights/sprint/${sprintId}/generate`, {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data.error ?? null;
        setErrorCode(code);
        setError(getErrorMessage(code));
        setStatus('error');
        publishInsightsFetch({ loading: false, notFound: false, data: null, fetchFailed: true });
        return;
      }
      cancelPollRef.current = false;
      setStatus('polling');
      pollForResults(lastGeneratedAtMsRef.current);
    } catch {
      setErrorCode(null);
      setError('Could not start AI analysis. Check server connection.');
      setStatus('error');
      publishInsightsFetch({ loading: false, notFound: false, data: null, fetchFailed: true });
    }
  }, [sprintId, pollForResults, publishInsightsFetch]);

  const loadExisting = useCallback(async () => {
    if (!isValidSprintId(sprintId)) return { action: 'none' };

    const cached = peekSprintInsightsCache(sprintId);
    if (cached?.data?.insights) {
      const cachedData = cached.data;
      const generatedMs = parseGeneratedAtMs(cachedData.generatedAt);
      lastGeneratedAtMsRef.current = generatedMs;
      setLastGeneratedAtMs(generatedMs);
      setInsights(cachedData.insights);
      setAcknowledged(cachedData.acknowledged ?? false);
      setErrorCode(null);
      setError(null);
      setStatus('loaded');
      publishInsightsFetch({ loading: false, notFound: false, data: cachedData });
    } else {
      publishInsightsFetch({ loading: true, notFound: false, data: null });
      setStatus('checking');
    }

    try {
      const { notFound, data } = await fetchSprintInsights(sprintId);
      publishInsightsFetch({ loading: false, notFound, data });
      if (notFound || !data) {
        setInsights(null);
        setErrorCode(null);
        setError(null);
        setStatus((prev) => (prev === 'generating' || prev === 'polling' ? prev : 'idle'));
        return { action: 'autoGenerate' };
      }
      const generatedMs = parseGeneratedAtMs(data.generatedAt);
      lastGeneratedAtMsRef.current = generatedMs;
      setLastGeneratedAtMs(generatedMs);
      if (isProcessingInsight(data)) {
        setStatus('polling');
        cancelPollRef.current = false;
        pollForResults(lastGeneratedAtMsRef.current);
        return { action: 'none' };
      }
      if (data.error) {
        if (isApiKeyInsightError(data.error)) {
          try {
            const aiStatus = await fetchAiStatus();
            if (aiStatus.geminiConfigured) {
              setInsights(null);
              setErrorCode(null);
              setError(null);
              setStatus('idle');
              return { action: 'autoGenerate' };
            }
          } catch {
            /* show stored error below */
          }
          setErrorCode(data.error);
          setError(getErrorMessage(data.error));
          setStatus('error');
          return { action: 'none' };
        }
        setInsights(null);
        setErrorCode(null);
        setError(null);
        setStatus('idle');
        return { action: 'autoGenerate' };
      }
      if (data.insights == null) {
        setInsights(null);
        setErrorCode(null);
        setError(null);
        setStatus('idle');
        return { action: 'autoGenerate' };
      }
      setInsights(data.insights);
      setAcknowledged(data.acknowledged ?? false);
      setErrorCode(null);
      setError(null);
      setStatus('loaded');
      notifyPersistedInsightsChange();
      return { action: 'none' };
    } catch {
      publishInsightsFetch({ loading: false, notFound: true, data: null, fetchFailed: true });
      setStatus((prev) => (prev === 'generating' || prev === 'polling' ? prev : 'idle'));
      return { action: 'autoGenerate' };
    }
  }, [sprintId, notifyPersistedInsightsChange, publishInsightsFetch, pollForResults]);

  const maybeAutoGenerateAfterLoad = useCallback(
    async (loadAction) => {
      if (!autoGenerateOnMissing || !isValidSprintId(sprintId)) return;
      if (loadAction === 'none') return;
      if (autoGenInFlightRef.current) return;

      if (loadAction !== 'autoGenerate') return;

      autoGenInFlightRef.current = true;
      setStatus('generating');
      setError(null);
      setErrorCode(null);
      try {
        const aiStatus = await fetchAiStatus();
        if (cancelPollRef.current) return;
        if (!aiStatus.geminiConfigured) {
          const code = aiStatus.errorCode ?? 'GEMINI_API_KEY_MISSING';
          setErrorCode(code);
          setError(getErrorMessage(code) || aiStatus.message || 'AI insights are not configured.');
          setStatus('error');
          return;
        }
        await startGeneration();
      } catch (err) {
        if (!cancelPollRef.current) {
          setErrorCode(null);
          setError(
            err?.message
              ? `Could not start AI insights automatically: ${err.message}`
              : 'Could not start AI insights automatically. Check server connection and try Generate.',
          );
          setStatus('error');
        }
      } finally {
        autoGenInFlightRef.current = false;
      }
    },
    [autoGenerateOnMissing, sprintId, pollForResults, startGeneration],
  );

  useEffect(() => {
    if (!isValidSprintId(sprintId)) return;

    const sprintChanged = lastSprintIdRef.current !== sprintId;
    lastSprintIdRef.current = sprintId;

    if (!sprintChanged) {
      if (
        statusRef.current === 'generating' ||
        statusRef.current === 'polling' ||
        autoGenInFlightRef.current
      ) {
        return;
      }
      let cancelled = false;
      (async () => {
        const outcome = await loadExisting();
        if (cancelled) return;
        await maybeAutoGenerateAfterLoad(outcome?.action ?? 'none');
      })();
      return () => {
        cancelled = true;
      };
    }

    cancelPollRef.current = true;
    autoGenInFlightRef.current = false;
    setError(null);
    setErrorCode(null);
    setPollCount(0);
    setLastGeneratedAtMs(null);
    lastGeneratedAtMsRef.current = null;
    cancelPollRef.current = false;

    const cached = peekSprintInsightsCache(sprintId);
    if (cached?.data?.insights) {
      const cachedData = cached.data;
      const generatedMs = parseGeneratedAtMs(cachedData.generatedAt);
      lastGeneratedAtMsRef.current = generatedMs;
      setLastGeneratedAtMs(generatedMs);
      setInsights(cachedData.insights);
      setAcknowledged(cachedData.acknowledged ?? false);
      setErrorCode(null);
      setError(null);
      setStatus('loaded');
      publishInsightsFetch({ loading: false, notFound: false, data: cachedData });
    } else {
      setInsights(null);
      setStatus('checking');
      setAcknowledged(false);
    }

    let cancelled = false;
    (async () => {
      const outcome = await loadExisting();
      if (cancelled || cancelPollRef.current) return;
      await maybeAutoGenerateAfterLoad(outcome?.action ?? 'none');
    })();

    return () => {
      cancelled = true;
      cancelPollRef.current = true;
      autoGenInFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when sprint or refreshToken changes
  }, [sprintId, refreshToken]);

  const handleGenerate = () => startGeneration();

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

  const recommendationList = useMemo(
    () => computeRecommendationList(insights, { teamDevelopers: sprintDevelopers }),
    [insights, sprintDevelopers],
  );

  const insightsKpiDrift = useMemo(() => {
    if (status !== 'loaded' || !insights?.generationKpiSnapshot) {
      return { changed: false, labels: [] };
    }
    const drift = detectInsightsKpiDrift(
      insights.generationKpiSnapshot,
      currentSprintMetrics,
      liveTaskStatusBreakdown,
    );
    return {
      changed: drift.changed,
      labels: drift.labels?.length
        ? drift.labels
        : drift.metrics.map((key) => INSIGHTS_KPI_LABELS[key] || key),
    };
  }, [status, insights, currentSprintMetrics, liveTaskStatusBreakdown]);

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
        p: { xs: 1.5, sm: 2, md: 2.25 },
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
          <Sparkles size={20} color="#673AB7" />
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.98rem', md: '1.05rem' },
              color: 'text.primary',
            }}
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
              <span>
                <IconButton
                  onClick={handleGenerate}
                  sx={{ color: isDark ? '#9A9A9A' : '#607D8B', p: 1 }}
                >
                  <RefreshCw size={20} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {status === 'loaded' && (
            <IconButton
              onClick={() => setExpanded((v) => !v)}
              sx={{ color: isDark ? '#9A9A9A' : '#607D8B', p: 1 }}
            >
              {expanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </IconButton>
          )}
        </Box>
      </Box>

      {(status === 'loaded' && insights) || status === 'generating' || status === 'polling' ? (
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: { xs: '0.88rem', md: '0.95rem' },
            color: '#673AB7',
            mb: 1,
            mt: 0.25,
          }}
        >
          AI interpretation
        </Typography>
      ) : null}

      {status === 'checking' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
          <CircularProgress size={24} sx={{ color: '#C74634' }} />
          <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: 'text.secondary' }}>
            Loading insights…
          </Typography>
        </Box>
      )}

      {/* Idle / Error */}
      {(status === 'idle' || status === 'error') && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.5 }}>
          {status === 'idle' && (
            <Typography
              sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: 'text.secondary' }}
            >
              No insights generated yet for this sprint.
            </Typography>
          )}
          {status === 'error' && isApiKeyInsightError(errorCode) && error && (
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
          {status === 'error' && !isApiKeyInsightError(errorCode) && (
            <Typography
              sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: 'text.secondary' }}
            >
              {error || 'Could not generate insights for this sprint.'}
            </Typography>
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
              : `Waiting for Gemini${pollElapsedSec > 0 ? ` (~${pollElapsedSec}s)` : ''}…`}
          </Typography>
        </Box>
      )}

      {/* Loaded */}
      {status === 'loaded' && insights && (
        <Collapse in={expanded}>
          <InsightsFreshnessBanner
            generatedAt={
              lastGeneratedAtMs != null ? new Date(lastGeneratedAtMs).toISOString() : null
            }
            status={status}
            kpiValuesChanged={insightsKpiDrift.changed}
            changedMetricLabels={insightsKpiDrift.labels}
            onRegenerate={handleGenerate}
            regenerating={status === 'generating' || status === 'polling'}
          />
          {/* Snapshot counters */}
          <Box
            sx={{
              mb: 1.5,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: 1,
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
                  px: 1.25,
                  py: 1,
                  borderRadius: 1.5,
                  border: `1px solid ${s.border}`,
                  bgcolor: s.bg,
                  textAlign: 'center',
                }}
              >
                <Typography
                  sx={{ fontSize: '1.35rem', lineHeight: 1.1, fontWeight: 800, color: s.color }}
                >
                  {s.value}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.8rem',
                    color: isDark ? '#9A9A9A' : '#607D8B',
                    fontWeight: 600,
                    mt: 0.25,
                  }}
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
              gap: { xs: 1.25, md: 1.5 },
              mb: { xs: 2, md: 2.5 },
            }}
          >
            {/* Left column: alerts + executive summary */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
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
                    px: 1.5,
                    py: 0.75,
                    bgcolor: isDark ? '#2A1A3D' : '#F3E5F5',
                    borderBottom: `1px solid ${isDark ? 'rgba(156,39,176,0.3)' : 'rgba(156,39,176,0.18)'}`,
                  }}
                >
                  <SectionHeading icon={BarChart2} dense>
                    Automatic alerts
                  </SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
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
                  sx={{
                    px: 2,
                    py: 1.25,
                    bgcolor: isDark ? '#1A3A5C' : '#E3F2FD',
                    borderBottom: `1px solid ${isDark ? '#1A3A5C' : '#BBDEFB'}`,
                  }}
                >
                  <SectionHeading icon={FileText}>Sprint summary</SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 2, md: 2.5 } }}>
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
                          productivityDeltaPoints={productivityDeltaPoints}
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
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
                    px: 1.5,
                    py: 0.75,
                    bgcolor: isDark ? '#1A4A2A' : '#E8F5E9',
                    borderBottom: `1px solid ${isDark ? '#2E7D32' : '#C8E6C9'}`,
                  }}
                >
                  <SectionHeading icon={Lightbulb} dense>
                    Actionable recommendations
                  </SectionHeading>
                </Box>
                <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
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
                    sx={{
                      px: 1.5,
                      py: 0.75,
                      bgcolor: isDark ? '#4A3A1A' : '#FFF8E1',
                      borderBottom: `1px solid ${isDark ? '#7F6A1A' : '#FFECB3'}`,
                    }}
                  >
                    <SectionHeading icon={Sparkles} dense>
                      Predictions
                    </SectionHeading>
                  </Box>
                  <Box sx={{ p: { xs: 1.25, md: 1.5 } }}>
                    {hasPredictionsContent ? (
                      <PredictionsBlock
                        predictions={insights.predictions}
                        productivityPrediction={insights.productivityPrediction}
                        showNextSprintForecast={showNextSprintForecast}
                        nextSprintLabel={nextSprintLabel}
                        nextSprintActualScore={nextSprintActualScore}
                        currentSprintMetrics={currentSprintMetrics}
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
