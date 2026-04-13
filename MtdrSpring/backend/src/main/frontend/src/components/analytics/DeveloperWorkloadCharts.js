import React, { useMemo } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { shortDevName } from '../dashboard/dashboardSprintData';

const FALLBACK_SPRINT_COLOR = '#00897B';
const ORACLE_RED = '#C74634';
const HOURS_GAUGE_BLUE = '#1E88E5';

const CHART_H = 380;
const SPRINT_AVG_H = 260;

const AXIS_TICK = { fontSize: 14, fill: '#1565C0' };
const AXIS_LINE = { stroke: '#64B5F6' };
const GRID_STROKE = '#E1BEE7';
const TOOLTIP_CONTENT = { borderRadius: 8, border: '1px solid #90CAF9', fontSize: 14, padding: '10px 12px' };

/** Full donut ring in accent color; value centered (same layout as ProductivityGaugeCard). */
function AverageGaugeRing({ value, accentColor, valueDecimals = 1, unitLabel }) {
  const v = Number(value) || 0;
  const display = valueDecimals === 0 ? String(Math.round(v)) : v.toFixed(valueDecimals);
  const data = [{ name: 'ring', value: 100 }];

  return (
    <Box sx={{ position: 'relative', width: '100%', height: 200, mt: 0.5 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={88}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={accentColor} />
          </Pie>
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
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography component="span" sx={{ fontSize: '2.35rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1 }}>
            {display}
          </Typography>
          {unitLabel ? (
            <Typography component="span" sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#616161' }}>
              {unitLabel}
            </Typography>
          ) : null}
        </Box>
      </Box>
    </Box>
  );
}

function ChartCard({ title, subtitle, iconElement, children }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: subtitle ? 0.75 : 1.5 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'rgba(199,70,52,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
  const suffix = mode === 'completed' ? 'c' : 'h';
  const names = new Set();
  selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => names.add(d.name)));
  return Array.from(names).map((name) => {
    const row = { name: shortDevName(name), _full: name };
    selectedSprints.forEach((sp) => {
      const dev = sp.developers.find((d) => d.name === name);
      const key = sprintFieldKey(sp, suffix);
      row[key] = mode === 'completed' ? (dev ? dev.completed : 0) : dev ? dev.hours : 0;
    });
    return row;
  });
}

function buildSprintAverageRows(selectedSprints) {
  return selectedSprints.map((sp) => {
    const devs = sp.developers || [];
    const n = devs.length;
    const sumCompleted = devs.reduce((a, d) => a + (d.completed || 0), 0);
    const sumHours = devs.reduce((a, d) => a + (d.hours || 0), 0);
    return {
      shortLabel: sp.shortLabel,
      avgTasksPerDev: n ? Number((sumCompleted / n).toFixed(2)) : 0,
      avgHoursPerDev: n ? Number((sumHours / n).toFixed(2)) : 0,
      developerCount: n,
      accentColor: sp.accentColor ?? FALLBACK_SPRINT_COLOR,
    };
  });
}

function SprintAvgTooltip({ active, payload, valueLabel, unitSuffix }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const val = payload[0].value;
  const valueWithUnit = unitSuffix != null && unitSuffix !== '' ? `${val} ${unitSuffix}` : val;
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid #90CAF9', p: 1.5, bgcolor: '#fff', boxShadow: '0 2px 8px rgba(21,101,192,0.12)' }}>
      <Typography sx={{ fontWeight: 700, color: '#1565C0', display: 'block', fontSize: '0.95rem' }}>
        {row.shortLabel}
      </Typography>
      <Typography sx={{ color: '#C62828', display: 'block', mt: 0.5, fontSize: '0.9rem', fontWeight: 700 }}>
        {valueLabel}: <strong>{valueWithUnit}</strong>
      </Typography>
      <Typography sx={{ color: '#6A1B9A', display: 'block', mt: 0.35, fontSize: '0.85rem', fontWeight: 600 }}>
        {row.developerCount} developer{row.developerCount === 1 ? '' : 's'} in sprint
      </Typography>
    </Box>
  );
}

export default function DeveloperWorkloadCharts({ selectedSprints = [], compareMode = false }) {
  const { sprintAvgRows, completedRows, hoursRows, hasData } = useMemo(() => {
    if (!selectedSprints?.length) {
      return {
        sprintAvgRows: [],
        completedRows: [],
        hoursRows: [],
        hasData: false,
      };
    }

    const sprintAvgRowsInner = buildSprintAverageRows(selectedSprints);
    const completedData = buildBarRows(selectedSprints, 'completed');
    const hoursData = buildBarRows(selectedSprints, 'hours');
    const hasCompleted = completedData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'c')] || 0) > 0)
    );
    const hasHours = hoursData.some((r) =>
      selectedSprints.some((sp) => (r[sprintFieldKey(sp, 'h')] || 0) > 0)
    );
    const devNames = new Set();
    selectedSprints.forEach((sp) => (sp.developers || []).forEach((d) => d.name && devNames.add(d.name)));
    const n = devNames.size;

    return {
      sprintAvgRows: sprintAvgRowsInner,
      completedRows: completedData,
      hoursRows: hoursData,
      hasData: n > 0 && (hasCompleted || hasHours),
    };
  }, [selectedSprints]);

  if (!hasData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
        <Typography sx={{ color: 'text.secondary', fontSize: '1rem' }}>
          No developer breakdown for the selected sprints (assign work via user-tasks).
        </Typography>
      </Box>
    );
  }

  const tooltipStyle = TOOLTIP_CONTENT;

  const singleAvg = sprintAvgRows[0];
  const avgTasksVal = singleAvg?.avgTasksPerDev ?? 0;
  const avgHoursVal = singleAvg?.avgHoursPerDev ?? 0;
  const avgDevCount = singleAvg?.developerCount ?? 0;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ fontWeight: 800, color: '#333', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.95rem' }}>
        {compareMode ? 'Per-sprint averages (compare across sprints)' : 'Team averages'}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {!compareMode ? (
          <>
            <Grid item xs={12} md={6}>
              <ChartCard
                title="Average completed tasks per developer"
                subtitle="Total done tasks in sprint / developers with assignments"
                iconElement={<BarChartIcon sx={{ color: ORACLE_RED, fontSize: 26 }} />}
              >
                <Box sx={{ borderTop: '1px solid #F5F5F5', mt: 1, pt: 0.5 }}>
                  <AverageGaugeRing value={avgTasksVal} accentColor={ORACLE_RED} valueDecimals={2} unitLabel="tasks" />
                  <Typography sx={{ color: '#616161', display: 'block', textAlign: 'center', mt: 1, fontSize: '0.95rem', fontWeight: 600 }}>
                    {avgDevCount} developer{avgDevCount === 1 ? '' : 's'} with assignments
                  </Typography>
                </Box>
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartCard
                title="Average worked hours per developer"
                subtitle="Total worked hours in sprint / developers with assignments"
                iconElement={<ScheduleIcon sx={{ color: HOURS_GAUGE_BLUE, fontSize: 26 }} />}
              >
                <Box sx={{ borderTop: '1px solid #F5F5F5', mt: 1, pt: 0.5 }}>
                  <AverageGaugeRing value={avgHoursVal} accentColor={HOURS_GAUGE_BLUE} valueDecimals={1} unitLabel="hours" />
                  <Typography sx={{ color: '#616161', display: 'block', textAlign: 'center', mt: 1, fontSize: '0.95rem', fontWeight: 600 }}>
                    {avgDevCount} developer{avgDevCount === 1 ? '' : 's'} with assignments
                  </Typography>
                </Box>
              </ChartCard>
            </Grid>
          </>
        ) : (
          <>
            <Grid item xs={12} md={6}>
              <ChartCard
                title="Average completed tasks per developer"
                subtitle="Total done tasks in sprint / developers with assignments"
                iconElement={<BarChartIcon sx={{ color: '#C74634', fontSize: 26 }} />}
              >
                <Box sx={{ width: '100%', height: SPRINT_AVG_H }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sprintAvgRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="shortLabel" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                      <YAxis tick={AXIS_TICK} axisLine={false} width={44} />
                      <Tooltip content={<SprintAvgTooltip valueLabel="Avg tasks / developer" unitSuffix="tasks" />} />
                      <Bar dataKey="avgTasksPerDev" name="Avg tasks / developer" radius={[4, 4, 0, 0]} maxBarSize={56}>
                        <LabelList
                          position="top"
                          offset={6}
                          fill="#424242"
                          fontSize={12}
                          fontWeight={600}
                          strokeOpacity={0}
                          formatter={(v) =>
                            v != null && v !== '' && !Number.isNaN(Number(v)) ? `${Number(v)} tasks` : ''
                          }
                        />
                        {sprintAvgRows.map((row) => (
                          <Cell key={`${row.shortLabel}-tasks`} fill={row.accentColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartCard
                title="Average real hours per developer"
                subtitle="Total worked hours in sprint / developers with assignments"
                iconElement={<ScheduleIcon sx={{ color: '#1E88E5', fontSize: 26 }} />}
              >
                <Box sx={{ width: '100%', height: SPRINT_AVG_H }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sprintAvgRows} margin={{ top: 8, right: 12, left: 4, bottom: 8 }} barCategoryGap="28%">
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                      <XAxis dataKey="shortLabel" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                      <YAxis tick={AXIS_TICK} axisLine={false} width={48} />
                      <Tooltip content={<SprintAvgTooltip valueLabel="Avg hours / developer" unitSuffix="hours" />} />
                      <Bar dataKey="avgHoursPerDev" name="Avg hours / developer" radius={[4, 4, 0, 0]} maxBarSize={56}>
                        <LabelList
                          position="top"
                          offset={6}
                          fill="#424242"
                          fontSize={12}
                          fontWeight={600}
                          strokeOpacity={0}
                          formatter={(v) =>
                            v != null && v !== '' && !Number.isNaN(Number(v))
                              ? `${Number(v).toFixed(2)} hours`
                              : ''
                          }
                        />
                        {sprintAvgRows.map((row) => (
                          <Cell key={`${row.shortLabel}-hrs`} fill={row.accentColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </ChartCard>
            </Grid>
          </>
        )}
      </Grid>

      <Typography sx={{ fontWeight: 800, color: '#333', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.95rem' }}>
        By developer (grouped by sprint)
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <ChartCard
            title="Completed tasks by developer"
            iconElement={<BarChartIcon sx={{ color: '#C74634', fontSize: 26 }} />}
          >
            <Box sx={{ width: '100%', height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completedRows} margin={{ top: 8, right: 16, left: 4, bottom: 8 }} barGap={4} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} width={40} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} tasks`, 'Completed']} />
                  <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                  {selectedSprints.map((sp) => (
                    <Bar
                      key={sp.id}
                      dataKey={sprintFieldKey(sp, 'c')}
                      name={sp.shortLabel}
                      fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        </Grid>

        <Grid item xs={12}>
          <ChartCard
            title="Total worked hours by developer"
            iconElement={<ScheduleIcon sx={{ color: '#1E88E5', fontSize: 26 }} />}
          >
            <Box sx={{ width: '100%', height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursRows} margin={{ top: 8, right: 16, left: 4, bottom: 8 }} barGap={4} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} axisLine={AXIS_LINE} interval={0} />
                  <YAxis tick={AXIS_TICK} axisLine={false} width={48} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} h`, 'Real hours']} />
                  <Legend wrapperStyle={{ fontSize: 14, fontWeight: 600 }} />
                  {selectedSprints.map((sp) => (
                    <Bar
                      key={sp.id}
                      dataKey={sprintFieldKey(sp, 'h')}
                      name={sp.shortLabel}
                      fill={sp.accentColor ?? FALLBACK_SPRINT_COLOR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
