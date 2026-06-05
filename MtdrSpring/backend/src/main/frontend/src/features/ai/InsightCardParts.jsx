import { developerInsightDisplayText } from './developerInsightDisplay';
import {
  Box,
  Typography,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  LineChart,
} from 'lucide-react';
import {
  KPI_LABELS,
  RECOMMENDATION_CATEGORY_LABELS,
  KPI_ALERT_PERCENT_KEYS,
  alignAlertMessagePercent,
  clampKpiPercentForDisplay,
  clampTrendsPercentLikeValues,
  alignKpiMetricsInText,
  alignKpiProseForMetric,
  alignCompletionRatePercentLabels,
  stripContradictoryOnTimeDecline,
  reconcileOnTimeDeliveryConcernProse,
  alignProductivityScoreProse,
  alignProductivityTrendDelta,
  resolveProductivityPredictionDisplay,
  formatProductivityForecastDeltaLine,
} from './aiInsightsConstants';

const getSeverity = (severityKey, isDark) => {
  const severities = {
    critical: {
      color: '#C62828',
      bg: isDark ? '#4A1A1A' : '#FFEBEE',
      border: isDark ? '#7F3030' : '#EF9A9A',
      label: 'Critical',
      Icon: AlertCircle,
    },
    warning: {
      color: '#E65100',
      bg: isDark ? '#4A2A1A' : '#FFF3E0',
      border: isDark ? '#7F4A1A' : '#FFCC80',
      label: 'Warning',
      Icon: AlertTriangle,
    },
    info: {
      color: '#01579B',
      bg: isDark ? '#1A3A5C' : '#E3F2FD',
      border: isDark ? '#1A4A6C' : '#90CAF9',
      label: 'Info',
      Icon: Info,
    },
  };
  return severities[severityKey] ?? severities.info;
};

export function AlertCard({ alert, currentSprintMetrics = null }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const cfg = getSeverity(alert.severity, isDark);
  const { Icon } = cfg;
  const kpiKey = typeof alert.kpi === 'string' ? alert.kpi : '';
  const normalizedKpiMetric =
    currentSprintMetrics && currentSprintMetrics[kpiKey] != null
      ? clampKpiPercentForDisplay(currentSprintMetrics[kpiKey])
      : null;
  const effectiveAlertValue = normalizedKpiMetric != null ? normalizedKpiMetric : alert.value;
  let messageText = alert.message;
  if (currentSprintMetrics) {
    messageText = alignKpiMetricsInText(messageText, currentSprintMetrics);
    if (kpiKey && currentSprintMetrics[kpiKey] != null) {
      messageText = alignKpiProseForMetric(messageText, kpiKey, currentSprintMetrics);
    }
  }
  messageText = alignAlertMessagePercent(messageText, effectiveAlertValue);
  if (currentSprintMetrics?.onTimeDelivery != null) {
    messageText = stripContradictoryOnTimeDecline(messageText, currentSprintMetrics.onTimeDelivery);
    messageText = reconcileOnTimeDeliveryConcernProse(
      messageText,
      currentSprintMetrics.onTimeDelivery,
    );
  }
  const valueIsPercentKpi = KPI_ALERT_PERCENT_KEYS.has(kpiKey);
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        p: { xs: 1.25, md: 1.5 },
        borderRadius: 2,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        mb: 1,
      }}
    >
      <Icon size={20} color={cfg.color} style={{ marginTop: 2, flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Chip
            label={cfg.label}
            sx={{
              height: 30,
              fontSize: '0.85rem',
              fontWeight: 700,
              bgcolor: cfg.color,
              color: '#fff',
              borderRadius: 1,
            }}
          />
          {alert.kpi && (
            <Typography
              sx={{
                fontSize: { xs: '0.85rem', md: '0.9rem' },
                color: isDark ? '#9A9A9A' : '#607D8B',
                fontWeight: 600,
              }}
            >
              {KPI_LABELS[alert.kpi] ?? alert.kpi}
              {effectiveAlertValue != null
                ? valueIsPercentKpi
                  ? ` — ${clampKpiPercentForDisplay(effectiveAlertValue)}%`
                  : ` — ${effectiveAlertValue}`
                : ''}
            </Typography>
          )}
        </Box>
        <Typography
          sx={{
            fontSize: { xs: '0.95rem', md: '1.05rem' },
            color: isDark ? '#E0E0E0' : '#37474F',
            lineHeight: 1.5,
          }}
        >
          {messageText}
        </Typography>
      </Box>
    </Box>
  );
}

export function WorkloadCard({ rec }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: isDark ? '#2A1A3D' : '#F3E5F5',
        border: `1px solid ${isDark ? '#7B1FA2' : '#CE93D8'}`,
        mb: 1,
        display: 'flex',
        gap: 1.5,
      }}
    >
      <Users size={16} color="#7B1FA2" style={{ marginTop: 2, flexShrink: 0 }} />
      <Box>
        <Typography
          sx={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: isDark ? '#CE93D8' : '#4A148C',
            mb: 0.25,
          }}
        >
          Move ~{rec.tasksToMove} task{rec.tasksToMove !== 1 ? 's' : ''}
          {rec.from ? ` from ${rec.from}` : ''}
          {rec.to ? ` → ${rec.to}` : ''}
        </Typography>
        <Typography
          sx={{ fontSize: '0.76rem', color: isDark ? '#CE93D8' : '#6A1B9A', lineHeight: 1.4 }}
        >
          {rec.reason}
        </Typography>
      </Box>
    </Box>
  );
}

export function SectionHeading({ icon: Icon, children, dense = false }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: dense ? 0 : 2, flexWrap: 'wrap' }}
    >
      {Icon && <Icon size={dense ? 18 : 22} color={isDark ? '#9A9A9A' : '#607D8B'} aria-hidden />}
      <Typography
        sx={{
          fontSize: dense ? { xs: '0.92rem', md: '0.98rem' } : { xs: '1.1rem', md: '1.25rem' },
          fontWeight: 800,
          color: 'text.primary',
          letterSpacing: '-0.02em',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

/**
 * Live blocked assignments merged into enriched sprint insights (GET). Assignee = developer who reported the block.
 */
export function BlockedAssignmentsSnapshot({ rows }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return (
    <Box
      sx={{
        mb: 1.5,
        border: `1px solid ${isDark ? 'rgba(198, 40, 40, 0.5)' : 'rgba(198, 40, 40, 0.35)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: isDark ? '#4A1A1A' : '#FFEBEE',
          borderBottom: `1px solid ${isDark ? 'rgba(198,40,40,0.3)' : 'rgba(198,40,40,0.2)'}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <AlertTriangle size={22} color="#C62828" aria-hidden style={{ flexShrink: 0 }} />
          <Typography
            sx={{
              fontSize: { xs: '1.05rem', md: '1.2rem' },
              fontWeight: 800,
              color: 'text.primary',
            }}
          >
            Blocked assignments
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: isDark ? '#9A9A9A' : '#546E7A',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          Assignments currently flagged as blocked (each assignee reported the block on their own
          work). Updates when you refresh or regenerate insights.
        </Typography>
      </Box>
      <Stack spacing={1.25} sx={{ p: { xs: 1.5, md: 2 } }}>
        {list.map((row, i) => {
          const name = row.reportedByDeveloperName ?? row.reported_by_developer_name ?? 'Developer';
          const title = row.taskTitle ?? row.task_title ?? '';
          const tid = row.taskId ?? row.task_id;
          const reason = row.blockedReason ?? row.blocked_reason ?? '';
          return (
            <Paper
              key={`${name}-${tid}-${i}`}
              elevation={0}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                border: `1px solid ${isDark ? '#7F3030' : '#FFCDD2'}`,
                bgcolor: isDark ? '#2A1A1A' : '#FFF8F8',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <AlertTriangle size={18} color="#C62828" style={{ marginTop: 2, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: '#B71C1C' }}>
                    {name}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 700, fontSize: '0.88rem', color: 'text.primary', mt: 0.35 }}
                  >
                    {title || (tid != null ? `Task #${tid}` : 'Task')}
                  </Typography>
                  {reason ? (
                    <Typography
                      sx={{ fontSize: '0.84rem', color: '#B71C1C', fontWeight: 600, mt: 0.5 }}
                    >
                      {reason}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}

/** Reference for what Critical / Warning / Info mean in the AI panel (no sample quotes). */
export function AlertTypesLegend() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const rows = [
    {
      Icon: AlertCircle,
      color: getSeverity('critical', isDark).color,
      label: 'Critical',
      desc: 'Severe issues that require immediate action.',
    },
    {
      Icon: AlertTriangle,
      color: getSeverity('warning', isDark).color,
      label: 'Warning',
      desc: 'Situations that need attention.',
    },
    {
      Icon: Info,
      color: getSeverity('info', isDark).color,
      label: 'Info',
      desc: 'Useful context without urgency.',
    },
  ];
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        mb: 2,
        borderRadius: 2,
        borderColor: isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)',
        width: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Table
        sx={{ '& td, & th': { fontSize: { xs: '0.88rem', md: '0.95rem' }, py: 1.25, px: 1.5 } }}
      >
        <TableHead sx={{ bgcolor: isDark ? 'rgba(103,58,183,0.12)' : 'rgba(103,58,183,0.06)' }}>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 700,
                width: { xs: 120, md: 140 },
                color: isDark ? '#F0F0F0' : '#1A1A1A',
              }}
            >
              Type
            </TableCell>
            <TableCell sx={{ fontWeight: 700, color: isDark ? '#F0F0F0' : '#1A1A1A' }}>
              Description
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const RowIcon = r.Icon;
            return (
              <TableRow key={r.label}>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: isDark ? '#F0F0F0' : '#1A1A1A',
                  }}
                >
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <RowIcon size={18} color={r.color} aria-hidden />
                    {r.label}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: isDark ? '#9A9A9A' : '#455A64' }}>{r.desc}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Bulleted list of actionable recommendations (category + text) */
export function ActionableRecommendationsList({ items }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!items?.length) return null;
  return (
    <Box
      component="ul"
      sx={{
        m: 0,
        pl: { xs: 2.5, md: 3 },
        listStyleType: 'disc',
        '& li': { mb: 1.5, pl: 0.25 },
      }}
    >
      {items.map((rec, i) => {
        const label = RECOMMENDATION_CATEGORY_LABELS[rec.category] ?? rec.category;
        return (
          <Box key={i} component="li" sx={{ display: 'list-item' }}>
            <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1 }}>
              <Chip
                label={label}
                sx={{
                  height: 28,
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  bgcolor: '#F57F17',
                  color: '#fff',
                  borderRadius: 1,
                  verticalAlign: 'middle',
                }}
              />
              <Typography
                component="span"
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  color: isDark ? '#E0E0E0' : '#37474F',
                  lineHeight: 1.55,
                }}
              >
                {rec.text}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function ExecutiveSummaryBlock({
  executiveSummary,
  fallbackSummary,
  taskStatusBreakdown,
  currentSprintActualScore = null,
  currentSprintMetrics = null,
  productivityDeltaPoints = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const es = executiveSummary;
  const alignedMetrics = currentSprintMetrics ?? {
    productivityScore: currentSprintActualScore,
  };
  const alignEsBlock = (raw) => {
    if (!raw) return null;
    const clamped = clampTrendsPercentLikeValues(raw);
    const withKpis = alignKpiMetricsInText(clamped, alignedMetrics);
    let out =
      currentSprintActualScore != null
        ? alignProductivityScoreProse(withKpis, currentSprintActualScore)
        : withKpis;
    if (alignedMetrics?.onTimeDelivery != null) {
      out = stripContradictoryOnTimeDecline(out, alignedMetrics.onTimeDelivery);
      out = reconcileOnTimeDeliveryConcernProse(out, alignedMetrics.onTimeDelivery);
    }
    if (productivityDeltaPoints != null) {
      out = alignProductivityTrendDelta(out, productivityDeltaPoints);
    }
    return out;
  };
  const trendsText = alignEsBlock(es?.trends);
  const overviewText = alignEsBlock(es?.overview);
  const improvementAreasText = alignEsBlock(es?.improvementAreas);
  const nextStepsText = alignEsBlock(es?.nextSteps);
  const hasEsContent = Boolean(
    es && (overviewText || trendsText || improvementAreasText || nextStepsText),
  );
  const hasBreakdown = taskStatusBreakdown != null && taskStatusBreakdown.total != null;

  const statusChips = hasBreakdown ? (
    <Box sx={{ mb: hasEsContent || fallbackSummary ? 1.25 : 0 }}>
      <Typography
        sx={{
          fontSize: '0.8rem',
          fontWeight: 700,
          color: isDark ? '#9A9A9A' : '#78909C',
          mb: 0.75,
        }}
      >
        Task status
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
        {[
          { label: 'To do', value: Number(taskStatusBreakdown.toDo) || 0 },
          { label: 'In progress', value: Number(taskStatusBreakdown.inProgress) || 0 },
          { label: 'In review', value: Number(taskStatusBreakdown.inReview) || 0 },
          { label: 'Done', value: Number(taskStatusBreakdown.done) || 0 },
          ...(Number(taskStatusBreakdown.unknown) > 0
            ? [{ label: 'Other / unknown', value: Number(taskStatusBreakdown.unknown) || 0 }]
            : []),
        ].map(({ label, value }) => (
          <Chip
            key={label}
            size="small"
            label={`${label}: ${value}`}
            sx={{
              fontWeight: 700,
              bgcolor: isDark ? 'rgba(57, 73, 171, 0.2)' : 'rgba(57, 73, 171, 0.1)',
              color: isDark ? '#90CAF9' : '#283593',
              border: `1px solid ${isDark ? 'rgba(57, 73, 171, 0.4)' : 'rgba(57, 73, 171, 0.25)'}`,
            }}
          />
        ))}
      </Stack>
      <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#9A9A9A' : '#90A4AE', mt: 0.75 }}>
        Total tasks in sprint: {Number(taskStatusBreakdown.total) || 0}
      </Typography>
    </Box>
  ) : null;

  if (hasEsContent) {
    return (
      <Box
        sx={{
          p: { xs: 2, md: 2.75 },
          borderRadius: 2,
          bgcolor: isDark ? '#1A1C2E' : '#E8EAF6',
          border: `1px solid ${isDark ? '#3949AB' : '#9FA8DA'}`,
        }}
      >
        {statusChips}
        {overviewText && (
          <Box sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#9A9A9A' : '#78909C',
                mb: 0.5,
              }}
            >
              Overview
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                color: isDark ? '#E0E0E0' : '#37474F',
                lineHeight: 1.55,
              }}
            >
              {overviewText}
            </Typography>
          </Box>
        )}
        {trendsText && (
          <Box sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#9A9A9A' : '#78909C',
                mb: 0.5,
              }}
            >
              Trends
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                color: isDark ? '#E0E0E0' : '#37474F',
                lineHeight: 1.55,
              }}
            >
              {trendsText}
            </Typography>
          </Box>
        )}
        {improvementAreasText && (
          <Box sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#9A9A9A' : '#78909C',
                mb: 0.5,
              }}
            >
              Improvement areas
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                color: isDark ? '#E0E0E0' : '#37474F',
                lineHeight: 1.55,
              }}
            >
              {improvementAreasText}
            </Typography>
          </Box>
        )}
        {nextStepsText && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: isDark ? '#9A9A9A' : '#78909C',
                mb: 0.5,
              }}
            >
              Next steps
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: '0.95rem', md: '1.05rem' },
                color: isDark ? '#E0E0E0' : '#37474F',
                lineHeight: 1.55,
              }}
            >
              {nextStepsText}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }
  if (hasBreakdown) {
    return (
      <Box
        sx={{
          p: { xs: 2, md: 2.75 },
          borderRadius: 2,
          bgcolor: isDark ? '#1A1C2E' : '#E8EAF6',
          border: `1px solid ${isDark ? '#3949AB' : '#9FA8DA'}`,
        }}
      >
        {statusChips}
        {fallbackSummary ? (
          <Typography
            sx={{
              fontSize: { xs: '0.95rem', md: '1.05rem' },
              color: isDark ? '#E0E0E0' : '#37474F',
              lineHeight: 1.55,
              fontStyle: 'italic',
            }}
          >
            "{fallbackSummary}"
          </Typography>
        ) : null}
      </Box>
    );
  }
  if (!fallbackSummary) return null;
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        bgcolor: isDark ? '#2A1A3D' : '#EDE7F6',
        border: `1px solid ${isDark ? '#7B1FA2' : '#CE93D8'}`,
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: '0.95rem', md: '1.05rem' },
          color: isDark ? '#E0E0E0' : '#37474F',
          lineHeight: 1.55,
          fontStyle: 'italic',
        }}
      >
        "{fallbackSummary}"
      </Typography>
    </Box>
  );
}

export function DeveloperInsightsTable({ rows }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!rows?.length) return null;
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: isDark ? '#2A2C32' : 'rgba(0,0,0,0.08)',
        overflow: 'auto',
        width: '100%',
        bgcolor: 'background.paper',
      }}
    >
      <Table
        sx={{
          width: '100%',
          '& td': { fontSize: { xs: '0.9rem', md: '1rem' }, verticalAlign: 'top', py: 1.5 },
        }}
      >
        <TableHead sx={{ bgcolor: isDark ? 'rgba(92,107,192,0.15)' : 'rgba(92,107,192,0.08)' }}>
          <TableRow>
            <TableCell
              sx={{
                fontWeight: 700,
                width: { xs: '28%', md: '22%' },
                color: isDark ? '#F0F0F0' : '#1A1A1A',
              }}
            >
              Developer
            </TableCell>
            <TableCell sx={{ fontWeight: 700, color: isDark ? '#F0F0F0' : '#1A1A1A' }}>
              Insight
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell sx={{ fontWeight: 700, color: isDark ? '#90CAF9' : '#3949AB' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <span>{row.developerName}</span>
                  {row.overloaded === true && (
                    <Chip
                      label="Overloaded"
                      size="small"
                      sx={{
                        alignSelf: 'flex-start',
                        height: 22,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        bgcolor: isDark ? '#4A1A1A' : '#FFEBEE',
                        color: '#C62828',
                      }}
                    />
                  )}
                </Box>
              </TableCell>
              <TableCell sx={{ color: isDark ? '#E0E0E0' : '#455A64', lineHeight: 1.55 }}>
                {developerInsightDisplayText(row)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PredictionsBlock({
  predictions,
  productivityPrediction,
  showNextSprintForecast = true,
  nextSprintLabel = null,
  nextSprintActualScore = null,
  currentSprintMetrics = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasExtended =
    predictions &&
    (predictions.productivityOutlook || predictions.risks || predictions.deliveryEstimate);
  const showScoreCard = showNextSprintForecast && productivityPrediction;
  if (!hasExtended && !productivityPrediction) return null;
  if (!hasExtended && productivityPrediction && !showNextSprintForecast) {
    return (
      <Typography
        sx={{
          fontSize: { xs: '0.9rem', md: '0.95rem' },
          color: isDark ? '#9A9A9A' : '#78909C',
          fontStyle: 'italic',
        }}
      >
        The next sprint score forecast is hidden for this sprint.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {hasExtended && (
        <Box
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 2,
            bgcolor: isDark ? '#1A3A4A' : '#E0F7FA',
            border: `1px solid ${isDark ? '#4DD0E1' : '#4DD0E1'}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
            <LineChart size={24} color="#00838F" aria-hidden />
            <Typography
              sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 700, color: '#006064' }}
            >
              Forecast insights
            </Typography>
          </Box>
          {predictions.productivityOutlook && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Future productivity
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  color: isDark ? '#E0E0E0' : '#37474F',
                  lineHeight: 1.55,
                }}
              >
                {predictions.productivityOutlook}
              </Typography>
            </Box>
          )}
          {predictions.risks && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Risks
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  color: isDark ? '#E0E0E0' : '#37474F',
                  lineHeight: 1.55,
                }}
              >
                {predictions.risks}
              </Typography>
            </Box>
          )}
          {predictions.deliveryEstimate && (
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Delivery estimate
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.05rem' },
                  color: isDark ? '#E0E0E0' : '#37474F',
                  lineHeight: 1.55,
                }}
              >
                {predictions.deliveryEstimate}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {showScoreCard && (
        <PredictionCard
          prediction={productivityPrediction}
          nextSprintLabel={nextSprintLabel}
          nextSprintActualScore={nextSprintActualScore}
          currentSprintMetrics={currentSprintMetrics}
        />
      )}
    </Box>
  );
}

export function PredictionCard({
  prediction,
  nextSprintLabel = null,
  nextSprintActualScore = null,
  currentSprintMetrics = null,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const resolved = resolveProductivityPredictionDisplay(prediction, currentSprintMetrics);
  const clampedScore = resolved.predictedScore;
  const forecastDeltaLine = formatProductivityForecastDeltaLine(resolved);
  const reasoningRaw = prediction?.reasoning ?? '';
  const reasoningAligned =
    currentSprintMetrics && reasoningRaw
      ? alignCompletionRatePercentLabels(
          alignKpiMetricsInText(reasoningRaw, currentSprintMetrics),
          currentSprintMetrics,
        )
      : reasoningRaw;
  const TrendIcon =
    resolved.trend === 'up' ? TrendingUp : resolved.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    resolved.trend === 'up' ? '#2E7D32' : resolved.trend === 'down' ? '#C62828' : '#607D8B';

  // Mostrar comparación si tenemos el score real del siguiente sprint
  const showComparison = nextSprintActualScore != null && Number.isFinite(nextSprintActualScore);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        bgcolor: isDark ? '#1A4A2A' : '#F1F8E9',
        border: `1px solid ${isDark ? '#2E7D32' : '#A5D6A7'}`,
        display: 'flex',
        gap: { xs: 2, md: 3 },
        alignItems: 'flex-start',
        flexDirection: { xs: 'column', sm: 'row' },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
        <Typography
          sx={{
            fontSize: { xs: '2.25rem', md: '2.5rem' },
            fontWeight: 800,
            color: trendColor,
            lineHeight: 1,
          }}
        >
          {clampedScore}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.8rem',
            color: isDark ? '#9A9A9A' : '#607D8B',
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          % productivity
          <Box component="span" sx={{ display: 'block', fontSize: '0.68rem', fontWeight: 500 }}>
            predicted
          </Box>
        </Typography>
        <TrendIcon size={24} color={trendColor} style={{ marginTop: 6 }} />
        {forecastDeltaLine ? (
          <Typography
            sx={{
              fontSize: '0.68rem',
              color: isDark ? '#9A9A9A' : '#607D8B',
              fontWeight: 600,
              textAlign: 'center',
              mt: 0.75,
              maxWidth: 120,
              lineHeight: 1.35,
            }}
          >
            {forecastDeltaLine}
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          sx={{
            fontSize: { xs: '0.95rem', md: '1.05rem' },
            fontWeight: 700,
            color: isDark ? '#81C784' : '#1B5E20',
            mb: 0.5,
          }}
        >
          Next sprint forecast
          {prediction.confidence && (
            <span style={{ fontWeight: 400, color: isDark ? '#9A9A9A' : '#607D8B', marginLeft: 8 }}>
              ({prediction.confidence} confidence)
            </span>
          )}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: '0.95rem', md: '1.02rem' },
            color: isDark ? '#E0E0E0' : '#37474F',
            lineHeight: 1.55,
          }}
        >
          {reasoningAligned}
        </Typography>
        {showComparison && (
          <Box sx={{ mt: 1.5, pt: 1, borderTop: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}` }}>
            <Typography
              sx={{ fontSize: '0.85rem', color: isDark ? '#9A9A9A' : '#607D8B', fontWeight: 600 }}
            >
              Actual score for {nextSprintLabel || 'next sprint'}:{' '}
              {Math.round(nextSprintActualScore)}%
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
