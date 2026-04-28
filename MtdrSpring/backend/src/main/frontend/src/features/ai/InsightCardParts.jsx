import React from 'react';
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
} from './aiInsightsConstants';

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
  const messageText = alignAlertMessagePercent(alert.message, alert.value);
  const kpiKey = typeof alert.kpi === 'string' ? alert.kpi : '';
  const valueIsPercentKpi = KPI_ALERT_PERCENT_KEYS.has(kpiKey);
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        mb: 1.5,
      }}
    >
      <Icon size={24} color={cfg.color} style={{ marginTop: 4, flexShrink: 0 }} />
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
            <Typography sx={{ fontSize: { xs: '0.85rem', md: '0.9rem' }, color: '#607D8B', fontWeight: 600 }}>
              {KPI_LABELS[alert.kpi] ?? alert.kpi}
              {alert.value != null
                ? valueIsPercentKpi
                  ? ` — ${clampKpiPercentForDisplay(alert.value)}%`
                  : ` — ${alert.value}`
                : ''}
            </Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.5 }}>
          {messageText}
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

export function SectionHeading({ icon: Icon, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
      {Icon && <Icon size={22} color="#607D8B" aria-hidden />}
      <Typography
        sx={{
          fontSize: { xs: '1.1rem', md: '1.25rem' },
          fontWeight: 800,
          color: '#1A1A1A',
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
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return null;
  return (
    <Box
      sx={{
        mb: { xs: 2.5, md: 3.5 },
        border: '1px solid rgba(198, 40, 40, 0.35)',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: '#FFFFFF',
      }}
    >
      <Box sx={{ px: 2, py: 1.25, bgcolor: '#FFEBEE', borderBottom: '1px solid rgba(198,40,40,0.2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <AlertTriangle size={22} color="#C62828" aria-hidden style={{ flexShrink: 0 }} />
          <Typography sx={{ fontSize: { xs: '1.05rem', md: '1.2rem' }, fontWeight: 800, color: '#1A1A1A' }}>
            Blocked assignments
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: '#546E7A', fontWeight: 600, lineHeight: 1.45 }}>
          Assignments currently flagged as blocked (each assignee reported the block on their own work). Updates when
          you refresh or regenerate insights.
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
                border: '1px solid #FFCDD2',
                bgcolor: '#FFF8F8',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <AlertTriangle size={18} color="#C62828" style={{ marginTop: 2, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: '#B71C1C' }}>{name}</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#1A1A1A', mt: 0.35 }}>
                    {title || (tid != null ? `Task #${tid}` : 'Task')}
                  </Typography>
                  {reason ? (
                    <Typography sx={{ fontSize: '0.84rem', color: '#B71C1C', fontWeight: 600, mt: 0.5 }}>
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
  const rows = [
    {
      Icon: AlertCircle,
      color: SEVERITY.critical.color,
      label: 'Critical',
      desc: 'Severe issues that require immediate action.',
    },
    {
      Icon: AlertTriangle,
      color: SEVERITY.warning.color,
      label: 'Warning',
      desc: 'Situations that need attention.',
    },
    { Icon: Info, color: SEVERITY.info.color, label: 'Info', desc: 'Useful context without urgency.' },
  ];
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ mb: 2, borderRadius: 2, borderColor: 'rgba(0,0,0,0.08)', width: '100%' }}
    >
      <Table sx={{ '& td, & th': { fontSize: { xs: '0.88rem', md: '0.95rem' }, py: 1.25, px: 1.5 } }}>
        <TableHead sx={{ bgcolor: 'rgba(103,58,183,0.06)' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, width: { xs: 120, md: 140 } }}>Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const RowIcon = r.Icon;
            return (
              <TableRow key={r.label}>
                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <RowIcon size={18} color={r.color} aria-hidden />
                    {r.label}
                  </Box>
                </TableCell>
                <TableCell sx={{ color: '#455A64' }}>{r.desc}</TableCell>
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
                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}
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

export function ExecutiveSummaryBlock({ executiveSummary, fallbackSummary, taskStatusBreakdown }) {
  const es = executiveSummary;
  const hasEsContent = Boolean(es && (es.overview || es.trends || es.improvementAreas || es.nextSteps));
  const hasBreakdown = taskStatusBreakdown != null && taskStatusBreakdown.total != null;

  const statusChips =
    hasBreakdown ? (
      <Box sx={{ mb: hasEsContent || fallbackSummary ? 2 : 0 }}>
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#78909C', mb: 1 }}>
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
                bgcolor: 'rgba(57, 73, 171, 0.1)',
                color: '#283593',
                border: '1px solid rgba(57, 73, 171, 0.25)',
              }}
            />
          ))}
        </Stack>
        <Typography sx={{ fontSize: '0.75rem', color: '#90A4AE', mt: 0.75 }}>
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
          bgcolor: '#E8EAF6',
          border: '1px solid #9FA8DA',
        }}
      >
        {statusChips}
        {es.overview && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#78909C', mb: 0.5 }}>
              Overview
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
              {es.overview}
            </Typography>
          </Box>
        )}
        {es.trends && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#78909C', mb: 0.5 }}>
              Trends
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
              {es.trends}
            </Typography>
          </Box>
        )}
        {es.improvementAreas && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#78909C', mb: 0.5 }}>
              Improvement areas
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
              {es.improvementAreas}
            </Typography>
          </Box>
        )}
        {es.nextSteps && (
          <Box>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#78909C', mb: 0.5 }}>
              Next steps
            </Typography>
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
              {es.nextSteps}
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
          bgcolor: '#E8EAF6',
          border: '1px solid #9FA8DA',
        }}
      >
        {statusChips}
        {fallbackSummary ? (
          <Typography
            sx={{
              fontSize: { xs: '0.95rem', md: '1.05rem' },
              color: '#37474F',
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
        bgcolor: '#EDE7F6',
        border: '1px solid #CE93D8',
      }}
    >
      <Typography
        sx={{
          fontSize: { xs: '0.95rem', md: '1.05rem' },
          color: '#37474F',
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
  if (!rows?.length) return null;
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, borderColor: 'rgba(0,0,0,0.08)', overflow: 'auto', width: '100%' }}
    >
      <Table sx={{ width: '100%', '& td': { fontSize: { xs: '0.9rem', md: '1rem' }, verticalAlign: 'top', py: 1.5 } }}>
        <TableHead sx={{ bgcolor: 'rgba(92,107,192,0.08)' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, width: { xs: '28%', md: '22%' } }}>Developer</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Insight</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell sx={{ fontWeight: 700, color: '#3949AB' }}>{row.developerName}</TableCell>
              <TableCell sx={{ color: '#455A64', lineHeight: 1.55 }}>{row.insight}</TableCell>
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
}) {
  const hasExtended =
    predictions &&
    (predictions.productivityOutlook || predictions.risks || predictions.deliveryEstimate);
  const showScoreCard = showNextSprintForecast && productivityPrediction;
  if (!hasExtended && !productivityPrediction) return null;
  if (!hasExtended && productivityPrediction && !showNextSprintForecast) {
    return (
      <Typography sx={{ fontSize: { xs: '0.9rem', md: '0.95rem' }, color: '#78909C', fontStyle: 'italic' }}>
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
            bgcolor: '#E0F7FA',
            border: '1px solid #4DD0E1',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.75 }}>
            <LineChart size={24} color="#00838F" aria-hidden />
            <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 700, color: '#006064' }}>
              Forecast insights
            </Typography>
          </Box>
          {predictions.productivityOutlook && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Future productivity
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
                {predictions.productivityOutlook}
              </Typography>
            </Box>
          )}
          {predictions.risks && (
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Risks
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
                {predictions.risks}
              </Typography>
            </Box>
          )}
          {predictions.deliveryEstimate && (
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#00838F', mb: 0.5 }}>
                Delivery estimate
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, color: '#37474F', lineHeight: 1.55 }}>
                {predictions.deliveryEstimate}
              </Typography>
            </Box>
          )}
        </Box>
      )}
      {showScoreCard && (
        <PredictionCard
          prediction={productivityPrediction}
        />
      )}
    </Box>
  );
}

export function PredictionCard({ prediction }) {
  const rawScore = Number(prediction?.predictedScore);
  const clampedScore = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  const TrendIcon =
    prediction.trend === 'up' ? TrendingUp : prediction.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    prediction.trend === 'up' ? '#2E7D32' : prediction.trend === 'down' ? '#C62828' : '#607D8B';
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        bgcolor: '#F1F8E9',
        border: '1px solid #A5D6A7',
        display: 'flex',
        gap: { xs: 2, md: 3 },
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 72 }}>
        <Typography sx={{ fontSize: { xs: '2.25rem', md: '2.5rem' }, fontWeight: 800, color: trendColor, lineHeight: 1 }}>
          {clampedScore}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: '#607D8B', fontWeight: 600 }}>
          % predicted
        </Typography>
        <TrendIcon size={24} color={trendColor} style={{ marginTop: 6 }} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, fontWeight: 700, color: '#1B5E20', mb: 0.5 }}>
          Next sprint forecast
          {prediction.confidence && (
            <span style={{ fontWeight: 400, color: '#607D8B', marginLeft: 8 }}>
              ({prediction.confidence} confidence)
            </span>
          )}
        </Typography>
        <Typography sx={{ fontSize: { xs: '0.95rem', md: '1.02rem' }, color: '#37474F', lineHeight: 1.55 }}>
          {prediction.reasoning}
        </Typography>
      </Box>
    </Box>
  );
}
