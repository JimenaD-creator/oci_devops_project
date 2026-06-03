import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ScheduleIcon from '@mui/icons-material/Schedule';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { shortDevName } from '../dashboard/dashboardSprintData';
import { CHART_LEGEND_STYLE, CHART_LEGEND_ITEM_SX } from '../dashboard/dashboardTypography';

const FALLBACK_SPRINT_COLOR = '#546E7A';

const CHART_H = 300;

function getAxisTick(isDark) {
  return { fontSize: 14, fill: isDark ? '#9A9A9A' : '#424242' };
}

function getAxisLine(isDark) {
  return { stroke: isDark ? '#2A2C32' : '#BDBDBD' };
}

function getGridStroke(isDark) {
  return isDark ? '#2A2C32' : '#E0E0E0';
}

function getTooltipContent(isDark) {
  return {
    borderRadius: 8,
    border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
    fontSize: 14,
    padding: '10px 12px',
    backgroundColor: isDark ? '#1C1E22' : '#FFFFFF',
    color: isDark ? '#F0F0F0' : '#1A1A1A',
  };
}

function getChartAccentIconBg(isDark) {
  return isDark ? 'rgba(199, 70, 52, 0.15)' : 'rgba(199, 70, 52, 0.09)';
}

/** Recharts 3: use rgba fill for “light” bars — `fillOpacity` on `<Bar>` often renders like solid. */
function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return FALLBACK_SPRINT_COLOR;
  const h = hex.slice(1);
  if (h.length !== 6) return FALLBACK_SPRINT_COLOR;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return FALLBACK_SPRINT_COLOR;
  return `rgba(${r},${g},${b},${alpha})`;
}

function ChartPlot({ children, height = CHART_H }) {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, height, overflow: 'hidden' }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </Box>
  );
}

function ChartCard({ title, subtitle, iconElement, children }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: `1px solid ${isDark ? '#2A2C32' : '#EFEFEF'}`,
        boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.04)',
        bgcolor: 'background.paper',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: subtitle ? 0.75 : 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: getChartAccentIconBg(isDark),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {iconElement ?? null}
        </Box>
        <Box>
          <Typography
            sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.12rem', lineHeight: 1.3 }}
          >
            {title}
          </Typography>
          {subtitle ? (
            <Typography
              sx={{
                color: 'text.secondary',
                display: 'block',
                fontSize: '0.95rem',
                mt: 0.35,
                fontWeight: 500,
              }}
            >
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {children}
    </Paper>
  );
}

function sprintFieldKey(sp, suffix) {
  return `sp${sp.id}_${suffix}`;
}

function resolveUniqueTeamTotals(sp, uniqueTeamTotalsBySprintId) {
  if (!uniqueTeamTotalsBySprintId || sp == null || sp.id == null) return null;
  const id = sp.id;
  const raw =
    uniqueTeamTotalsBySprintId[id] ??
    uniqueTeamTotalsBySprintId[String(id)] ??
    uniqueTeamTotalsBySprintId[Number(id)];
  if (
    !raw ||
    typeof raw.assigned !== 'number' ||
    typeof raw.completed !== 'number' ||
    Number.isNaN(raw.assigned) ||
    Number.isNaN(raw.completed)
  ) {
    return null;
  }
  return raw;
}

/**
 * Per developer: hours worked vs estimated hours from task estimates.
 * Same bar pairing as “Tasks assigned vs completed” (lighter = planned, solid = worked).
 */
function buildWorkedEstimatedHoursRows(selectedSprints) {
  const names = new Set();
  selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      row[sprintFieldKey(sp, 'e')] = dev ? Number(dev.assignedHoursEstimate) || 0 : 0;
      row[sprintFieldKey(sp, 'h')] = dev ? Number(dev.hours) || 0 : 0;
    });
    return row;
  });
}

/**
 * One row per sprint: team totals for assigned vs completed (never per-developer comparison).
 *
 * @param {Record<string|number, { assigned: number, completed: number }>|undefined} uniqueTeamTotalsBySprintId
 *        When set for a sprint, uses unique task counts (multi-assignee task counts once).
 */
function buildAssignedCompletedRows(selectedSprints, uniqueTeamTotalsBySprintId) {
  if (!selectedSprints?.length) return [];
  return selectedSprints.map((sp) => {
    const uniqueTotals = resolveUniqueTeamTotals(sp, uniqueTeamTotalsBySprintId);
    const devs = sp.developers || [];
    const totalA = uniqueTotals
      ? uniqueTotals.assigned
      : devs.reduce((a, d) => a + (d.assigned ?? 0), 0);
    const totalC = uniqueTotals
      ? uniqueTotals.completed
      : devs.reduce((a, d) => a + (d.completed ?? 0), 0);
    const label =
      sp.shortLabel || (typeof sp.name === 'string' && sp.name.trim()) || `Sprint ${sp.id}`;
    return {
      name: label,
      _full: `sprint-${sp.id}`,
      [sprintFieldKey(sp, 'a')]: totalA,
      [sprintFieldKey(sp, 'c')]: totalC,
    };
  });
}

function HoursWorkedEstimatedLegendKey({ selectedSprints }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mb: 1, width: '100%' }}>
      <Typography
        sx={{
          ...CHART_LEGEND_ITEM_SX,
          color: isDark ? '#9A9A9A' : '#455A64',
          fontWeight: 600,
          fontSize: '0.82rem',
          lineHeight: 1.45,
          mb: 1,
          display: 'block',
        }}
      >
        Each sprint color: solid bar = hours worked; lighter bar = estimated hours (from your task
        estimates).
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          ...CHART_LEGEND_ITEM_SX,
          color: isDark ? '#9A9A9A' : '#555',
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#90A4AE', opacity: 0.58 }}
          />
          <Box component="span">Estimated hours (lighter bar)</Box>
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#546E7A' }} />
          <Box component="span">Hours worked (solid bar)</Box>
        </Box>
        <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.75 }}>
          {selectedSprints.map((sp) => (
            <Box key={sp.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '2px',
                  bgcolor: sp.accentColor ?? FALLBACK_SPRINT_COLOR,
                }}
              />
              <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                {sp.shortLabel}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default function DeveloperWorkloadCharts({
  selectedSprints = [],
  /** If false, hides the hours bar chart (e.g. when that view is already on the dashboard). */
  showHoursChart = true,
  /**
   * Per sprint id: unique task totals for the team row (assigned / completed).
   * Use when per-developer counts double-count shared tasks.
   */
  uniqueTeamTotalsBySprintId,
  /** Optional custom height for assigned vs completed chart. */
  assignedCompletedHeight,
  /** Optional max width for assigned vs completed chart container. */
  assignedCompletedMaxWidth,
  /** When true, removes bottom margin on the root so a sibling card can align height in a grid row. */
  suppressOuterMargin = false,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { combinedAssignedCompletedRows, workedEstimatedRows, hasData } = useMemo(() => {
    if (!selectedSprints?.length) {
      return {
        combinedAssignedCompletedRows: [],
        workedEstimatedRows: [],
        hasData: false,
      };
    }

    const combinedData = buildAssignedCompletedRows(selectedSprints, uniqueTeamTotalsBySprintId);
    const workedEstimatedRows = buildWorkedEstimatedHoursRows(selectedSprints);
    const hasCompleted = combinedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'c')] || 0) > 0),
    );
    const hasHours = workedEstimatedRows.some((r) =>
      selectedSprints.some(
        (sp) => (r[sprintFieldKey(sp, 'h')] || 0) > 0 || (r[sprintFieldKey(sp, 'e')] || 0) > 0,
      ),
    );
    const hasAssigned = combinedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'a')] || 0) > 0),
    );
    const devNames = new Set();
    selectedSprints.forEach((sp) =>
      (sp.developers || []).forEach((d) => d.name && devNames.add(d.name)),
    );
    const n = devNames.size;

    const hasAssignedCompletedChart = hasCompleted || hasAssigned;
    const hasData = showHoursChart
      ? n > 0 && (hasCompleted || hasHours || hasAssigned)
      : hasAssignedCompletedChart;

    return {
      combinedAssignedCompletedRows: combinedData,
      workedEstimatedRows,
      hasData,
    };
  }, [selectedSprints, showHoursChart, uniqueTeamTotalsBySprintId]);

  const hoursWorkedChartHeight = useMemo(() => {
    if (!workedEstimatedRows?.length || !selectedSprints?.length) return CHART_H;
    let m = 0;
    for (const r of workedEstimatedRows) {
      for (const sp of selectedSprints) {
        m = Math.max(
          m,
          Number(r[sprintFieldKey(sp, 'h')]) || 0,
          Number(r[sprintFieldKey(sp, 'e')]) || 0,
        );
      }
    }
    return Math.min(520, Math.max(300, Math.round(240 + 0.55 * m)));
  }, [workedEstimatedRows, selectedSprints]);

  if (!hasData) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          border: `1px dashed ${isDark ? '#2A2C32' : '#ccc'}`,
          borderRadius: 2,
          bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'transparent',
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography sx={{ color: 'text.secondary', fontSize: '1rem' }}>
          No task assignment data for the selected sprint(s).
        </Typography>
      </Box>
    );
  }

  const tooltipStyle = getTooltipContent(isDark);
  const axisTick = getAxisTick(isDark);
  const axisLine = getAxisLine(isDark);
  const gridStroke = getGridStroke(isDark);
  const showAssignedCompleted = combinedAssignedCompletedRows.length > 0;

  return (
    <Box
      sx={{
        mb: suppressOuterMargin ? 0 : 3,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
        {showAssignedCompleted ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: assignedCompletedMaxWidth ? assignedCompletedMaxWidth + 120 : '100%',
              mx: 'auto',
            }}
          >
            <ChartCard
              title="Tasks assigned vs completed"
              iconElement={<AssignmentOutlinedIcon sx={{ color: '#C74634', fontSize: 26 }} />}
            >
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: '100%', maxWidth: assignedCompletedMaxWidth ?? '100%' }}>
                  <ChartPlot height={assignedCompletedHeight ?? CHART_H}>
                    <BarChart
                      data={combinedAssignedCompletedRows}
                      margin={{ top: 14, right: 12, left: 2, bottom: 0 }}
                      barGap={2}
                      barCategoryGap="22%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="name" tick={axisTick} axisLine={axisLine} interval={0} />
                      <YAxis allowDecimals={false} tick={axisTick} axisLine={false} width={40} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v, name) => {
                          const isA = String(name).includes('Assigned');
                          return [`${v} tasks`, isA ? 'Assigned' : 'Completed'];
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          ...CHART_LEGEND_STYLE,
                          color: isDark ? '#F0F0F0' : '#1A1A1A',
                        }}
                      />
                      {selectedSprints.map((sp) => {
                        const accent = sp.accentColor ?? FALLBACK_SPRINT_COLOR;
                        return (
                          <React.Fragment key={sp.id}>
                            <Bar
                              dataKey={sprintFieldKey(sp, 'a')}
                              name={`${sp.shortLabel} · Assigned`}
                              fill={hexToRgba(accent, 0.55)}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={34}
                            />
                            <Bar
                              dataKey={sprintFieldKey(sp, 'c')}
                              name={`${sp.shortLabel} · Completed`}
                              fill={accent}
                              radius={[4, 4, 0, 0]}
                              maxBarSize={34}
                            />
                          </React.Fragment>
                        );
                      })}
                    </BarChart>
                  </ChartPlot>
                </Box>
              </Box>
            </ChartCard>
          </Box>
        ) : null}

        {showHoursChart ? (
          <ChartCard
            title="Hours worked vs estimated hours"
            subtitle="Lighter bars show estimated hours from task estimates; solid bars show hours worked."
            iconElement={<ScheduleIcon sx={{ color: '#C74634', fontSize: 26 }} />}
          >
            <HoursWorkedEstimatedLegendKey selectedSprints={selectedSprints} />
            <ChartPlot height={hoursWorkedChartHeight}>
              <BarChart
                data={workedEstimatedRows}
                margin={{ top: 28, right: 16, left: 4, bottom: 8 }}
                barGap={2}
                barCategoryGap="22%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={axisTick} axisLine={axisLine} interval={0} />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  width={48}
                  label={{
                    value: 'Hours',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 12,
                    fill: isDark ? '#9A9A9A' : '#555',
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => {
                    const isPlanned =
                      String(name).includes('Planned') || String(name).includes('Estimated');
                    return [
                      `${Number(v).toFixed(1)} h`,
                      isPlanned ? 'Estimated hours' : 'Hours worked',
                    ];
                  }}
                />
                <Legend
                  wrapperStyle={{ ...CHART_LEGEND_STYLE, color: isDark ? '#F0F0F0' : '#1A1A1A' }}
                />
                {selectedSprints.map((sp) => {
                  const accent = sp.accentColor ?? FALLBACK_SPRINT_COLOR;
                  return (
                    <React.Fragment key={`hrs-${sp.id}`}>
                      <Bar
                        dataKey={sprintFieldKey(sp, 'e')}
                        name={`${sp.shortLabel} · Estimated hours`}
                        fill={hexToRgba(accent, 0.48)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={44}
                      />
                      <Bar
                        dataKey={sprintFieldKey(sp, 'h')}
                        name={`${sp.shortLabel} · Hours worked`}
                        fill={accent}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={44}
                      />
                    </React.Fragment>
                  );
                })}
              </BarChart>
            </ChartPlot>
          </ChartCard>
        ) : null}
      </Stack>
    </Box>
  );
}
