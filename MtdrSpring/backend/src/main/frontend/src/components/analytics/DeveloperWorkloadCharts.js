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
const CHART_ACCENT_ICON_BG = 'rgba(21, 101, 192, 0.09)';

const CHART_H = 300;

const AXIS_TICK = { fontSize: 14, fill: '#1565C0' };
const AXIS_LINE = { stroke: '#64B5F6' };
const GRID_STROKE = '#E1BEE7';
const TOOLTIP_CONTENT = { borderRadius: 8, border: '1px solid #90CAF9', fontSize: 14, padding: '10px 12px' };

/** Donut slice colors (no red/green). */
const DONUT_ASSIGNED = '#5C6BC0';
const DONUT_COMPLETED = '#9575CD';

function ChartPlot({ children }) {
  return (
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, height: CHART_H, overflow: 'hidden' }}>
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

function buildBarRows(selectedSprints, mode) {
  const suffix = mode === 'completed' ? 'c' : mode === 'assigned' ? 'a' : 'h';
  const names = new Set();
  selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      const key = sprintFieldKey(sp, suffix);
      if (mode === 'completed') {
        row[key] = dev ? dev.completed : 0;
      } else if (mode === 'assigned') {
        row[key] = dev ? (dev.assigned ?? 0) : 0;
      } else {
        row[key] = dev ? dev.hours : 0;
      }
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
    const sumHours = devs.reduce((a, d) => a + (d.hours || 0), 0);
    const sumAssigned = devs.reduce((a, d) => a + (d.assigned || 0), 0);
    return {
      shortLabel: sp.shortLabel,
      avgHoursPerDev: n ? Number((sumHours / n).toFixed(2)) : 0,
      /** Mean assigned workload per developer (labeled "tasks" in UI, not "assigned tasks"). */
      avgTasksPerDev: n ? Number((sumAssigned / n).toFixed(2)) : 0,
      developerCount: n,
      accentColor: sp.accentColor ?? FALLBACK_SPRINT_COLOR,
    };
  });
}

function SprintAvgLegendHours({ sprintAvgRows }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {sprintAvgRows.map((row) => (
          <Box
            key={row.shortLabel}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              border: `1.5px dashed ${row.accentColor}`,
              bgcolor: `${row.accentColor}14`,
            }}
          >
            <Box component="span" sx={{ display: 'inline-block', width: 18, borderTop: `2.5px dashed ${row.accentColor}`, flexShrink: 0 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
              <Typography sx={{ ...CHART_LEGEND_ITEM_SX, fontSize: '0.875rem', fontWeight: 600, color: row.accentColor, whiteSpace: 'nowrap' }}>
                Average hours per developer
              </Typography>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: row.accentColor, whiteSpace: 'nowrap' }}>
                {row.shortLabel}: {Number(row.avgHoursPerDev).toFixed(2)} h
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
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
    hoursRows,
    hasData,
    totalAssigned,
    totalCompleted,
    devCount,
  } = useMemo(() => {
    if (!selectedSprints?.length) {
      return {
        sprintAvgRows: [],
        combinedAssignedCompletedRows: [],
        hoursRows: [],
        hasData: false,
        totalAssigned: 0,
        totalCompleted: 0,
        devCount: 0,
      };
    }

    const sprintAvgRowsInner = buildSprintAverageRows(selectedSprints);
    const combinedData = buildAssignedCompletedRows(selectedSprints);
    const hoursData = buildBarRows(selectedSprints, 'hours');
    const hasCompleted = combinedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'c')] || 0) > 0)
    );
    const hasHours = hoursData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'h')] || 0) > 0)
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
      hoursRows: hoursData,
      hasData: n > 0 && (hasCompleted || hasHours || hasAssigned),
      totalAssigned: ta,
      totalCompleted: tc,
      devCount: n,
    };
  }, [selectedSprints]);

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
          No developer breakdown for the selected sprints (assign work via user-tasks).
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
            iconElement={<AssignmentOutlinedIcon sx={{ color: '#1565C0', fontSize: 26 }} />}
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
                            fill={accent}
                            fillOpacity={0.58}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={44}
                          />
                          <Bar
                            dataKey={sprintFieldKey(sp, 'c')}
                            name={`${sp.shortLabel} · Completed`}
                            fill={accent}
                            fillOpacity={1}
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
          title="Total worked hours by developer"
          subtitle="Hours per developer and sprint. Dashed lines mark each sprint’s average hours per developer."
          iconElement={<ScheduleIcon sx={{ color: '#1565C0', fontSize: 26 }} />}
        >
          <SprintAvgLegendHours sprintAvgRows={sprintAvgRows} />
          <ChartPlot>
            <BarChart data={hoursRows} margin={{ top: 28, right: 16, left: 4, bottom: 8 }} barGap={4} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
              <YAxis tick={AXIS_TICK} axisLine={false} width={48} label={{ value: 'Hours (completed)', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#1565C0' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} h`, 'Hours (completed)']} />
              <Legend wrapperStyle={{ ...CHART_LEGEND_STYLE }} />
              {selectedSprints.map((sp) => (
                <Bar
                  key={sp.id}
                  dataKey={sprintFieldKey(sp, 'h')}
                  name={sp.shortLabel}
                  fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ))}
              {sprintAvgRows.map((row) => (
                <ReferenceLine
                  key={`avg-hrs-${row.shortLabel}`}
                  y={row.avgHoursPerDev}
                  stroke={row.accentColor}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  strokeOpacity={0.85}
                  ifOverflow="extendDomain"
                />
              ))}
            </BarChart>
          </ChartPlot>
        </ChartCard>
      </Stack>
    </Box>
  );
}
