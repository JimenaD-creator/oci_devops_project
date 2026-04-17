import React, { useMemo } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
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
  ReferenceLine,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { shortDevName } from '../dashboard/dashboardSprintData';
import { CHART_LEGEND_STYLE, CHART_LEGEND_ITEM_SX } from '../dashboard/dashboardTypography';

const FALLBACK_SPRINT_COLOR = '#546E7A';
const CHART_ACCENT_ICON_BG = 'rgba(199, 70, 52, 0.09)';

const CHART_H = 300;

const AXIS_TICK = { fontSize: 14, fill: '#424242' };
const AXIS_LINE = { stroke: '#BDBDBD' };
const GRID_STROKE = '#E0E0E0';
const TOOLTIP_CONTENT = { borderRadius: 8, border: '1px solid #E0E0E0', fontSize: 14, padding: '10px 12px' };

/** Donut slice colors: neutral slate (not blue/purple or status red/green). */
const DONUT_ASSIGNED = '#90A4AE';
const DONUT_COMPLETED = '#546E7A';

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
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: subtitle ? 0.75 : 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: CHART_ACCENT_ICON_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iconElement ?? null}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, color: '#1A1A1A', fontSize: '1.12rem', lineHeight: 1.3 }}>{title}</Typography>
          {subtitle ? (
            <Typography sx={{ color: '#666', display: 'block', fontSize: '0.95rem', mt: 0.35, fontWeight: 500 }}>{subtitle}</Typography>
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
 * With one sprint selected: one row comparing total tasks assigned vs total completed for that sprint.
 * With several sprints: one row per developer (same metric per sprint).
 */
function buildAssignedCompletedRows(selectedSprints) {
  if (selectedSprints.length === 1) {
    const sp = selectedSprints[0];
    const devs = sp.developers || [];
    const totalA = devs.reduce((a, d) => a + (d.assigned ?? 0), 0);
    const totalC = devs.reduce((a, d) => a + (d.completed ?? 0), 0);
    return [
      {
        name: sp.shortLabel || 'Sprint',
        _full: 'team',
        [sprintFieldKey(sp, 'a')]: totalA,
        [sprintFieldKey(sp, 'c')]: totalC,
      },
    ];
  }

  const names = new Set();
  selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      row[sprintFieldKey(sp, 'a')] = dev ? (dev.assigned ?? 0) : 0;
      row[sprintFieldKey(sp, 'c')] = dev ? dev.completed : 0;
    });
    return row;
  });
}

function buildSprintAverageRows(selectedSprints) {
  return selectedSprints.map((sp) => {
    const devs = sp.developers || [];
    const n = devs.length;
    const sumAssigned = devs.reduce((a, d) => a + (d.assigned || 0), 0);
    return {
      shortLabel: sp.shortLabel,
      /** Mean assigned workload per developer (labeled "tasks" in UI, not "assigned tasks"). */
      avgTasksPerDev: n ? Number((sumAssigned / n).toFixed(2)) : 0,
      developerCount: n,
      accentColor: sp.accentColor ?? FALLBACK_SPRINT_COLOR,
    };
  });
}

function CombinedSprintAvgPills({ sprintAvgRows }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.25 }}>
      {sprintAvgRows.map((row) => (
        <Box
          key={row.shortLabel}
          sx={{
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            border: `1px solid ${row.accentColor}55`,
            bgcolor: `${row.accentColor}0F`,
            minWidth: 0,
          }}
        >
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: row.accentColor, mb: 0.35 }}>
            {row.shortLabel}
          </Typography>
          <Typography sx={{ ...CHART_LEGEND_ITEM_SX, color: '#424242', lineHeight: 1.35 }}>
            Average tasks per developer: {row.avgTasksPerDev}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function HoursWorkedEstimatedLegendKey({ selectedSprints }) {
  return (
    <Box sx={{ mb: 1, width: '100%' }}>
      <Typography
        sx={{
          ...CHART_LEGEND_ITEM_SX,
          color: '#455A64',
          fontWeight: 600,
          fontSize: '0.82rem',
          lineHeight: 1.45,
          mb: 1,
          display: 'block',
        }}
      >
        Each sprint color: solid bar = hours worked; lighter bar = estimated hours (from your task estimates).
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          ...CHART_LEGEND_ITEM_SX,
          color: '#555',
        }}
      >
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#90A4AE', opacity: 0.58 }} />
          <Box component="span">Estimated hours (lighter bar)</Box>
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#546E7A' }} />
          <Box component="span">Hours worked (solid bar)</Box>
        </Box>
        <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.75 }}>
          {selectedSprints.map((sp) => (
            <Box key={sp.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: sp.accentColor ?? FALLBACK_SPRINT_COLOR }} />
              <Box component="span" sx={{ fontWeight: 700 }}>
                {sp.shortLabel}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function AssignedCompletedLegendKey({ selectedSprints }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        alignItems: 'center',
        mb: 1,
        ...CHART_LEGEND_ITEM_SX,
        color: '#555',
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#90A4AE', opacity: 0.65 }} />
        <Box component="span">Assigned (lighter bar)</Box>
      </Box>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: '#90A4AE' }} />
        <Box component="span">Completed (solid bar)</Box>
      </Box>
      <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', gap: 0.75 }}>
        {selectedSprints.map((sp) => (
          <Box key={sp.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: sp.accentColor ?? FALLBACK_SPRINT_COLOR }} />
            <Box component="span" sx={{ fontWeight: 700 }}>
              {sp.shortLabel}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Donut: share of assigned vs completed volume; center = completion rate + avg tasks per developer.
 */
function TaskVolumeDonut({ totalAssigned, totalCompleted, devCount }) {
  const sum = totalAssigned + totalCompleted;
  const completionRate = totalAssigned > 0 ? Math.round((100 * totalCompleted) / totalAssigned) : totalCompleted > 0 ? 100 : 0;
  const avgTasksPerDev = devCount > 0 ? totalAssigned / devCount : 0;

  const data = useMemo(() => {
    if (sum <= 0) return [];
    return [
      { name: 'Assigned', value: totalAssigned, fill: DONUT_ASSIGNED },
      { name: 'Completed', value: totalCompleted, fill: DONUT_COMPLETED },
    ];
  }, [sum, totalAssigned, totalCompleted]);

  if (sum <= 0) {
    return (
      <Box
        sx={{
          width: { xs: '100%', md: 240 },
          minHeight: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed #B39DDB',
          borderRadius: 2,
          bgcolor: '#FAFAFA',
        }}
      >
        <Typography sx={{ color: '#757575', fontWeight: 600, fontSize: '0.85rem', px: 2, textAlign: 'center' }}>
          No assigned or completed volume for the selection
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        position: 'relative',
        width: { xs: '100%', md: 240 },
        height: 220,
        flexShrink: 0,
        mx: { xs: 'auto', md: 0 },
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${entry.name}-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [`${v} tasks`, name]}
            contentStyle={TOOLTIP_CONTENT}
          />
        </PieChart>
      </ResponsiveContainer>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          maxWidth: 140,
        }}
      >
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1.05 }}>
          {completionRate}%
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#616161', textTransform: 'uppercase', letterSpacing: 0.4, mt: 0.35 }}>
          avg completion
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#757575', mt: 0.4, lineHeight: 1.3 }}>
          Ø {avgTasksPerDev.toFixed(1)} tasks / developer
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, fontWeight: 700, color: DONUT_ASSIGNED }}>Assigned: {totalAssigned}</Typography>
        <Typography sx={{ ...CHART_LEGEND_ITEM_SX, fontWeight: 700, color: DONUT_COMPLETED }}>Completed: {totalCompleted}</Typography>
      </Box>
    </Box>
  );
}

export default function DeveloperWorkloadCharts({ selectedSprints = [], compareMode = false }) {
  const {
    sprintAvgRows,
    combinedAssignedCompletedRows,
    workedEstimatedRows,
    hasData,
    totalAssigned,
    totalCompleted,
    devCount,
  } = useMemo(() => {
    if (!selectedSprints?.length) {
      return {
        sprintAvgRows: [],
        combinedAssignedCompletedRows: [],
        workedEstimatedRows: [],
        hasData: false,
        totalAssigned: 0,
        totalCompleted: 0,
        devCount: 0,
      };
    }

    const sprintAvgRowsInner = buildSprintAverageRows(selectedSprints);
    const combinedData = buildAssignedCompletedRows(selectedSprints);
    const workedEstimatedRows = buildWorkedEstimatedHoursRows(selectedSprints);
    const hasCompleted = combinedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'c')] || 0) > 0)
    );
    const hasHours = workedEstimatedRows.some((r) =>
      selectedSprints.some(
        (sp) => (r[sprintFieldKey(sp, 'h')] || 0) > 0 || (r[sprintFieldKey(sp, 'e')] || 0) > 0
      )
    );
    const hasAssigned = combinedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'a')] || 0) > 0)
    );
    const devNames = new Set();
    selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => d.name && devNames.add(d.name)));
    const n = devNames.size;

    let ta = 0;
    let tc = 0;
    selectedSprints.forEach((sp) => {
      (sp.developers || []).forEach((d) => {
        ta += d.assigned ?? 0;
        tc += d.completed ?? 0;
      });
    });

    return {
      sprintAvgRows: sprintAvgRowsInner,
      combinedAssignedCompletedRows: combinedData,
      workedEstimatedRows,
      hasData: n > 0 && (hasCompleted || hasHours || hasAssigned),
      totalAssigned: ta,
      totalCompleted: tc,
      devCount: n,
    };
  }, [selectedSprints]);

  const hoursWorkedChartHeight = useMemo(() => {
    if (!workedEstimatedRows?.length || !selectedSprints?.length) return CHART_H;
    let m = 0;
    for (const r of workedEstimatedRows) {
      for (const sp of selectedSprints) {
        m = Math.max(
          m,
          Number(r[sprintFieldKey(sp, 'h')]) || 0,
          Number(r[sprintFieldKey(sp, 'e')]) || 0
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
          border: '1px dashed #ccc',
          borderRadius: 2,
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography sx={{ color: 'text.secondary', fontSize: '1rem' }}>
          No developer breakdown for the selected sprints (add task assignments to see data).
        </Typography>
      </Box>
    );
  }

  const tooltipStyle = TOOLTIP_CONTENT;

  const showAssignedCompleted = combinedAssignedCompletedRows.length > 0;

  return (
    <Box
      sx={{
        mb: 3,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={2} sx={{ width: '100%', minWidth: 0 }}>
        {showAssignedCompleted ? (
          <ChartCard
            title={compareMode ? 'Tasks assigned vs completed (by developer)' : 'Tasks assigned vs completed'}
            subtitle={
              compareMode
                ? 'Per person and sprint: lighter bars are assigned tasks, solid bars are completed. The dashed line is the team average tasks per developer.'
                : 'For this sprint: assigned vs completed totals. The dashed line is average tasks per developer. The donut shows the mix and overall completion.'
            }
            iconElement={<AssignmentOutlinedIcon sx={{ color: '#C74634', fontSize: 26 }} />}
          >
            <CombinedSprintAvgPills sprintAvgRows={sprintAvgRows} />
            <AssignedCompletedLegendKey selectedSprints={selectedSprints} />
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 2,
                alignItems: { xs: 'stretch', md: 'flex-start' },
                width: '100%',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <ChartPlot>
                  <BarChart
                    data={combinedAssignedCompletedRows}
                    margin={{ top: 28, right: 16, left: 4, bottom: 8 }}
                    barGap={2}
                    barCategoryGap={compareMode ? '20%' : '22%'}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                    <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} width={40} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v, name) => {
                        const isA = String(name).includes('Assigned');
                        return [`${v} tasks`, isA ? 'Assigned' : 'Completed'];
                      }}
                    />
                    <Legend wrapperStyle={{ ...CHART_LEGEND_STYLE }} />
                    {selectedSprints.map((sp) => {
                      const accent = sp.accentColor ?? FALLBACK_SPRINT_COLOR;
                      return (
                        <React.Fragment key={sp.id}>
                          <Bar
                            dataKey={sprintFieldKey(sp, 'a')}
                            name={`${sp.shortLabel} · Assigned`}
                            fill={hexToRgba(accent, 0.55)}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={44}
                          />
                          <Bar
                            dataKey={sprintFieldKey(sp, 'c')}
                            name={`${sp.shortLabel} · Completed`}
                            fill={accent}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={44}
                          />
                        </React.Fragment>
                      );
                    })}
                    {sprintAvgRows.map((row) => (
                      <ReferenceLine
                        key={`avg-tasks-${row.shortLabel}`}
                        y={row.avgTasksPerDev}
                        stroke={row.accentColor}
                        strokeDasharray="6 4"
                        strokeWidth={2}
                        strokeOpacity={0.9}
                        ifOverflow="extendDomain"
                      />
                    ))}
                  </BarChart>
                </ChartPlot>
              </Box>
              <TaskVolumeDonut
                totalAssigned={totalAssigned}
                totalCompleted={totalCompleted}
                devCount={devCount}
              />
            </Box>
          </ChartCard>
        ) : null}

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
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                width={48}
                label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#555' }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v, name) => {
                  const isPlanned = String(name).includes('Planned');
                  return [`${Number(v).toFixed(1)} h`, isPlanned ? 'Estimated hours' : 'Hours worked'];
                }}
              />
              <Legend wrapperStyle={{ ...CHART_LEGEND_STYLE }} />
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
      </Stack>
    </Box>
  );
}
