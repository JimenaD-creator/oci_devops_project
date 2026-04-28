import React from 'react';
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { KPI_LABELS, alignTrendsProductivityScore } from '../ai/aiInsightsConstants';
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

const METRIC_STYLES = {
  completionRate: { title: '#1565C0', bg: '#E3F2FD', border: '#BBDEFB' },
  onTimeDelivery: { title: '#EF6C00', bg: '#FFF3E0', border: '#FFE0B2' },
  teamParticipation: { title: '#7B1FA2', bg: '#F3E5F5', border: '#E1BEE7' },
  workloadBalance: { title: '#2E7D32', bg: '#E8F5E9', border: '#C8E6C9' },
  productivityScore: { title: '#37474F', bg: '#ECEFF1', border: '#CFD8DC' },
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
  onOpenAiInsights,
}) {
  const resolvedCurrentProductivityScore = Number.isFinite(Number(currentProductivityScore))
    ? Number(currentProductivityScore)
    : Number(productivityDelta?.currentScore);
  const hasCurrentProductivityScore = Number.isFinite(resolvedCurrentProductivityScore);
  const byMetric =
    guide && guide.byMetric && typeof guide.byMetric === 'object' ? guide.byMetric : null;
  const introTextRaw = clampOver100ForDisplay(
    typeof guide?.intro === 'string' ? guide.intro.trim() : '',
  );
  const introText = hasCurrentProductivityScore
    ? alignTrendsProductivityScore(introTextRaw, resolvedCurrentProductivityScore)
    : introTextRaw;
  const alignGenericScorePhrase = (text) => {
    if (text == null || !hasCurrentProductivityScore) return text;
    const n = Math.max(0, Math.min(100, Number(resolvedCurrentProductivityScore)));
    const display = Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`;
    return String(text).replace(/(score\s*(?:of|is|:)\s*)(-?\d+(?:\.\d+)?)(?:\s*%)?/gi, `$1${display}`);
  };
  const productivityDeltaTextRaw = clampOver100ForDisplay(
    typeof productivityDelta?.text === 'string' ? productivityDelta.text.trim() : '',
    { aggressive: true },
  );
  const productivityDeltaText = hasCurrentProductivityScore
    ? alignGenericScorePhrase(
        alignTrendsProductivityScore(productivityDeltaTextRaw, resolvedCurrentProductivityScore),
      )
    : productivityDeltaTextRaw;
  const hasMetricLines =
    byMetric &&
    METRIC_KEYS.some((k) => {
      const t = byMetric[k];
      return typeof t === 'string' && t.trim() !== '';
    });
  const hasGuide = Boolean(guide) && (introText !== '' || hasMetricLines);

  return (
    <Paper
      sx={{
        p: { xs: 2, sm: 2.5 },
        mb: 4,
        borderRadius: 2,
        border: `1px solid ${sectionRgba(0.22)}`,
        borderLeft: `4px solid ${SECTION_ACCENT}`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        bgcolor: '#FAFAFF',
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
                  border: '2px solid #2E7D32',
                  bgcolor: '#C8E6C9',
                  boxShadow: '0 1px 6px rgba(46,125,50,0.2)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: '#1B5E20',
                    letterSpacing: '0.02em',
                    mb: 0.75,
                  }}
                >
                  Strong productivity gain
                </Typography>
                <Typography sx={{ fontSize: '0.88rem', color: '#1B5E20', fontWeight: 600, lineHeight: 1.55 }}>
                  Productivity score vs Sprint {productivityDelta.previousSprintId}:{' '}
                  {productivityDelta.previousScore}% → {productivityDelta.currentScore}%
                  {productivityDelta.deltaPoints != null && (
                    <> (+{productivityDelta.deltaPoints} point{productivityDelta.deltaPoints === 1 ? '' : 's'})</>
                  )}
                  {productivityDelta.relativePct != null && productivityDelta.previousScore > 0 && (
                    <> — that is a +{productivityDelta.relativePct.toFixed(0)}% change vs the previous sprint.</>
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
                border:
                  productivityDelta.tone === 'up'
                    ? '1px solid #C8E6C9'
                    : productivityDelta.tone === 'down'
                      ? '1px solid #FFCDD2'
                      : '1px solid #CFD8DC',
                bgcolor:
                  productivityDelta.tone === 'up'
                    ? '#E8F5E9'
                    : productivityDelta.tone === 'down'
                      ? '#FFEBEE'
                      : '#ECEFF1',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  color:
                    productivityDelta.tone === 'up'
                      ? '#1B5E20'
                      : productivityDelta.tone === 'down'
                        ? '#B71C1C'
                        : '#37474F',
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
          <Typography sx={{ color: '#607D8B', fontSize: '0.95rem' }}>Loading AI context…</Typography>
        </Box>
      )}

      {!loading && fetchFailed && (
        <Typography sx={{ color: '#78909C', fontSize: '0.95rem' }}>
          Could not load AI insights. Check your connection and try again.
        </Typography>
      )}

      {!loading && !fetchFailed && !hasGuide && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'flex-start' }}>
          <Typography sx={{ color: '#546E7A', fontSize: '0.95rem', lineHeight: 1.55 }}>
            No manager KPI narrative yet for this sprint. Open AI Insights, select this sprint, and run
            Generate (or Regenerate) so Gemini can store a short interpretation here.
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
                color: '#37474F',
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
              const displayText =
                key === 'productivityScore' && hasCurrentProductivityScore
                  ? alignGenericScorePhrase(
                      alignTrendsProductivityScore(sanitizedText, resolvedCurrentProductivityScore),
                    )
                  : sanitizedText;
              const title = KPI_LABELS[key] ?? key;
              const style = METRIC_STYLES[key] ?? {
                title: SECTION_ACCENT,
                bg: '#F5F5F5',
                border: '#E0E0E0',
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
                  <Typography sx={{ fontSize: '0.95rem', color: '#455A64', lineHeight: 1.55 }}>
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
