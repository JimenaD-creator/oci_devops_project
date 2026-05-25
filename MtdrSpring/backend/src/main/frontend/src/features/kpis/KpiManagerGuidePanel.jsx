import React from 'react';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Sparkles } from 'lucide-react';
import {
  KPI_LABELS,
  alignKpiMetricsInText,
  alignKpiProseForMetric,
  alignProductivityScoreProse,
  buildFallbackKpiManagerGuide,
  normalizeWorkloadBalanceGuideText,
} from '../ai/aiInsightsConstants';
import {
  buildProductivityKpiAnalyticsGuideLine,
  finalizeProductivityManagerGuideText,
  formatProductivityScoreDisplay,
  resolveSprintTimelineContext,
  softenProductivityGuideForSprintPhase,
  stripProductivityGuideInstructionEcho,
  stripProductivityLowScoreExcuses,
} from './productivityScoreUtils';
import {
  SECTION_BRAND_DARK,
  SECTION_ACCENT,
  sectionRgba,
} from '../dashboard/constants/dashboardConstants';

const METRIC_KEYS = [
  'completionRate',
  'onTimeDelivery',
  'teamParticipation',
  'workloadBalance',
  'productivityScore',
];

const METRIC_STYLES_LIGHT = {
  completionRate: { title: '#1565C0', bg: '#E3F2FD', border: '#BBDEFB' },
  onTimeDelivery: { title: '#EF6C00', bg: '#FFF3E0', border: '#FFE0B2' },
  teamParticipation: { title: '#7B1FA2', bg: '#F3E5F5', border: '#E1BEE7' },
  workloadBalance: { title: '#2E7D32', bg: '#E8F5E9', border: '#C8E6C9' },
  productivityScore: { title: '#37474F', bg: '#ECEFF1', border: '#CFD8DC' },
};

const METRIC_STYLES_DARK = {
  completionRate: { title: '#64B5F6', bg: '#1A3A5C', border: '#2A4A6C' },
  onTimeDelivery: { title: '#FFB74D', bg: '#4A2A1A', border: '#6A4A2A' },
  teamParticipation: { title: '#CE93D8', bg: '#2A1A3D', border: '#3A2A4D' },
  workloadBalance: { title: '#81C784', bg: '#1A4A2A', border: '#2A5A3A' },
  productivityScore: { title: '#90A4AE', bg: '#2A2C32', border: '#3A3C42' },
};

function clampOver100ForDisplay(rawText, options = {}) {
  const text = typeof rawText === 'string' ? rawText : '';
  if (!text) return '';
  const aggressive = Boolean(options.aggressive);

  // Always cap explicit percentages (e.g., 228% -> 100%).
  let out = text.replace(/(\d+(?:\.\d+)?)\s*%/g, (m, n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 100) return m;
    return '100%';
  });

  // For score-heavy narratives, also cap bare numeric values above 100.
  if (aggressive) {
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, (m, n) => {
      const v = Number(n);
      if (!Number.isFinite(v) || v <= 100) return m;
      return '100';
    });
  }

  return out;
}

/**
 * Manager-facing KPI interpretation from persisted AI insights (`kpiManagerGuide`).
 */
export default function KpiManagerGuidePanel({
  sprintLabel,
  guide,
  loading,
  fetchFailed,
  productivityDelta,
  currentProductivityScore = null,
  currentSprintKpis = {},
  currentSprint = null,
  onOpenAiInsights,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const METRIC_STYLES = isDark ? METRIC_STYLES_DARK : METRIC_STYLES_LIGHT;

  const resolvedCurrentProductivityScore = Number.isFinite(Number(currentProductivityScore))
    ? Math.round(Number(currentProductivityScore))
    : Number.isFinite(Number(productivityDelta?.currentScore))
      ? Math.round(Number(productivityDelta.currentScore))
      : null;
  const hasCurrentProductivityScore = Number.isFinite(resolvedCurrentProductivityScore);
  const sprintTimeline = resolveSprintTimelineContext(currentSprint);
  const productivityDisplay = hasCurrentProductivityScore
    ? formatProductivityScoreDisplay(resolvedCurrentProductivityScore)
    : '';
  const fallbackGuide = buildFallbackKpiManagerGuide(currentSprintKpis, currentSprint);
  const effectiveGuide =
    guide && (guide.intro || guide.byMetric) ? guide : fallbackGuide;
  const byMetric =
    effectiveGuide?.byMetric && typeof effectiveGuide.byMetric === 'object'
      ? effectiveGuide.byMetric
      : null;
  const introTextRaw = clampOver100ForDisplay(
    typeof effectiveGuide?.intro === 'string' ? effectiveGuide.intro.trim() : '',
  );
  const alignedIntroText = alignKpiMetricsInText(introTextRaw, {
    completionRate: currentSprintKpis.completionRate,
    onTimeDelivery: currentSprintKpis.onTimeDelivery,
    teamParticipation: currentSprintKpis.teamParticipation,
    workloadBalance: currentSprintKpis.workloadBalance,
    productivityScore: resolvedCurrentProductivityScore,
  });
  const introText = hasCurrentProductivityScore
    ? alignProductivityScoreProse(alignedIntroText, resolvedCurrentProductivityScore)
    : alignedIntroText;
  const productivityDeltaTextRaw = clampOver100ForDisplay(
    typeof productivityDelta?.text === 'string' ? productivityDelta.text.trim() : '',
    { aggressive: true },
  );
  const productivityDeltaTextAligned = alignKpiMetricsInText(productivityDeltaTextRaw, {
    completionRate: currentSprintKpis.completionRate,
    onTimeDelivery: currentSprintKpis.onTimeDelivery,
    teamParticipation: currentSprintKpis.teamParticipation,
    workloadBalance: currentSprintKpis.workloadBalance,
    productivityScore: resolvedCurrentProductivityScore,
  });
  const productivityDeltaText = hasCurrentProductivityScore
    ? alignProductivityScoreProse(productivityDeltaTextAligned, resolvedCurrentProductivityScore)
    : productivityDeltaTextAligned;
  const hasMetricLines =
    byMetric &&
    METRIC_KEYS.some((k) => {
      const t = byMetric[k];
      return typeof t === 'string' && t.trim() !== '';
    });
  const hasGuide = introText !== '' || hasMetricLines;

  // Colores para el delta de productividad
  const deltaColors = {
    up: {
      bg: isDark ? '#1A4A2A' : '#E8F5E9',
      border: isDark ? '#2E7D32' : '#C8E6C9',
      text: isDark ? '#81C784' : '#1B5E20',
    },
    down: {
      bg: isDark ? '#4A1A1A' : '#FFEBEE',
      border: isDark ? '#C62828' : '#FFCDD2',
      text: isDark ? '#EF9A9A' : '#B71C1C',
    },
    neutral: {
      bg: isDark ? '#2A2C32' : '#ECEFF1',
      border: isDark ? '#3A3C42' : '#CFD8DC',
      text: isDark ? '#9A9A9A' : '#37474F',
    },
  };
  const strongGainColors = {
    bg: isDark ? '#1A4A2A' : '#C8E6C9',
    border: isDark ? '#2E7D32' : '#2E7D32',
    text: isDark ? '#81C784' : '#1B5E20',
    highlight: isDark ? '#A5D6A7' : '#1B5E20',
  };

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 4,
        borderRadius: 2,
        border: `1px solid ${sectionRgba(0.22)}`,
        borderLeft: `4px solid ${SECTION_ACCENT}`,
        boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(0,0,0,0.05)',
        bgcolor: isDark ? '#1C1E22' : '#FAFAFF',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Sparkles size={22} color={SECTION_ACCENT} aria-hidden />
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 800, color: SECTION_BRAND_DARK, letterSpacing: '-0.02em' }}
        >
          What these KPIs mean (AI)
        </Typography>
      </Box>

      {!loading && !fetchFailed && productivityDelta?.text && (
        <>
          {productivityDelta.isStrongProductivityGain &&
            productivityDelta.tone === 'up' &&
            productivityDelta.previousSprintId != null && (
              <Box
                sx={{
                  mb: 2,
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `2px solid ${strongGainColors.border}`,
                  bgcolor: strongGainColors.bg,
                  boxShadow: isDark ? '0 1px 6px rgba(0,0,0,0.3)' : '0 1px 6px rgba(46,125,50,0.2)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: strongGainColors.text,
                    letterSpacing: '0.02em',
                    mb: 0.75,
                  }}
                >
                  Strong productivity gain
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.88rem',
                    color: strongGainColors.text,
                    fontWeight: 600,
                    lineHeight: 1.55,
                  }}
                >
                  Productivity score vs Sprint {productivityDelta.previousSprintId}:{' '}
                  {formatProductivityScoreDisplay(productivityDelta.previousScore)} →{' '}
                  {productivityDisplay ||
                    formatProductivityScoreDisplay(productivityDelta.currentScore)}
                  {productivityDelta.deltaPoints != null && (
                    <>
                      {' '}
                      (+{productivityDelta.deltaPoints} point
                      {productivityDelta.deltaPoints === 1 ? '' : 's'})
                    </>
                  )}
                  {productivityDelta.relativePct != null && productivityDelta.previousScore > 0 && (
                    <>
                      {' '}
                      — that is a +{productivityDelta.relativePct.toFixed(0)}% change vs the
                      previous sprint.
                    </>
                  )}
                </Typography>
              </Box>
            )}
          {!(productivityDelta.isStrongProductivityGain && productivityDelta.tone === 'up') && (
            <Box
              sx={{
                mb: 2,
                p: 1.25,
                borderRadius: 1.5,
                border: `1px solid ${deltaColors[productivityDelta.tone]?.border || deltaColors.neutral.border}`,
                bgcolor: deltaColors[productivityDelta.tone]?.bg || deltaColors.neutral.bg,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  color: deltaColors[productivityDelta.tone]?.text || deltaColors.neutral.text,
                  fontWeight: 700,
                  lineHeight: 1.5,
                }}
              >
                {productivityDeltaText}
              </Typography>
            </Box>
          )}
        </>
      )}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
          <CircularProgress size={22} sx={{ color: '#C74634' }} />
          <Typography sx={{ color: isDark ? '#9A9A9A' : '#607D8B', fontSize: '0.95rem' }}>
            Loading AI context…
          </Typography>
        </Box>
      )}

      {!loading && fetchFailed && (
        <Typography sx={{ color: isDark ? '#9A9A9A' : '#78909C', fontSize: '0.95rem' }}>
          Could not load AI insights. Check your connection and try again.
        </Typography>
      )}

      {!loading && !fetchFailed && !hasGuide && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-start' }}>
          <Typography
            sx={{ color: isDark ? '#9A9A9A' : '#546E7A', fontSize: '0.95rem', lineHeight: 1.55 }}
          >
            No manager KPI narrative yet for this sprint. Open AI Insights, select this sprint, and
            run Generate (or Regenerate) so Gemini can store a short interpretation here.
          </Typography>
          {typeof onOpenAiInsights === 'function' && (
            <Button
              variant="outlined"
              onClick={onOpenAiInsights}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderColor: SECTION_ACCENT,
                color: SECTION_ACCENT,
                '&:hover': { borderColor: SECTION_ACCENT, bgcolor: sectionRgba(0.08) },
              }}
            >
              Open AI Insights
            </Button>
          )}
        </Box>
      )}

      {!loading && !fetchFailed && hasGuide && (
        <Box>
          {introText !== '' && (
            <Typography
              sx={{
                fontSize: { xs: '1rem', sm: '1.05rem' },
                color: isDark ? '#E0E0E0' : '#37474F',
                lineHeight: 1.6,
                fontWeight: 600,
                mb: hasMetricLines ? 2.5 : 0,
              }}
            >
              {introText}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {METRIC_KEYS.map((key) => {
              const text = byMetric ? byMetric[key] : null;
              if (typeof text !== 'string' || !text.trim()) return null;
              const sanitizedText = clampOver100ForDisplay(text.trim(), {
                aggressive: key === 'teamParticipation' || key === 'productivityScore',
              });
              const alignedText = alignKpiMetricsInText(sanitizedText, {
                completionRate: currentSprintKpis.completionRate,
                onTimeDelivery: currentSprintKpis.onTimeDelivery,
                teamParticipation: currentSprintKpis.teamParticipation,
                workloadBalance: currentSprintKpis.workloadBalance,
                productivityScore: resolvedCurrentProductivityScore,
              });
              const metricsForAlign = {
                ...currentSprintKpis,
                productivityScore: resolvedCurrentProductivityScore,
              };
              let displayText = alignKpiProseForMetric(alignedText, key, metricsForAlign);
              if (key === 'productivityScore') {
                displayText = stripProductivityGuideInstructionEcho(displayText);
                displayText = stripProductivityLowScoreExcuses(displayText, sprintTimeline);
                displayText = softenProductivityGuideForSprintPhase(displayText, sprintTimeline);
                if (!displayText.trim() && hasCurrentProductivityScore) {
                  displayText = buildProductivityKpiAnalyticsGuideLine(
                    resolvedCurrentProductivityScore,
                    currentSprint,
                  );
                } else if (hasCurrentProductivityScore) {
                  displayText = finalizeProductivityManagerGuideText(
                    displayText,
                    resolvedCurrentProductivityScore,
                    currentSprint,
                  );
                }
              }
              if (key === 'workloadBalance') {
                displayText = normalizeWorkloadBalanceGuideText(
                  displayText,
                  currentSprintKpis.workloadBalance,
                );
              }
              const title = KPI_LABELS[key] ?? key;
              const style = METRIC_STYLES[key] ?? {
                title: SECTION_ACCENT,
                bg: isDark ? '#2A2C32' : '#F5F5F5',
                border: isDark ? '#3A3C42' : '#E0E0E0',
              };
              return (
                <Box
                  key={key}
                  sx={{
                    p: { xs: 1.25, sm: 1.5 },
                    borderRadius: 1.75,
                    border: `1px solid ${style.border}`,
                    bgcolor: style.bg,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: style.title,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      mb: 0.5,
                    }}
                  >
                    {title}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.95rem',
                      color: isDark ? '#E0E0E0' : '#455A64',
                      lineHeight: 1.55,
                    }}
                  >
                    {displayText}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
