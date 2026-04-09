import React, { useMemo } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SpeedIcon from '@mui/icons-material/Speed';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  buildGroupedCompletedData,
  buildGroupedHoursData,
  buildGroupedWorkloadData,
  shortDevName,
} from '../dashboard/dashboardSprintData';

export const FALLBACK_DEVELOPER_CHART_DATA = [
  { name: 'Carlos', completed: 6, hours: 32.5, workload: 80 },
  { name: 'María', completed: 8, hours: 45.0, workload: 100 },
  { name: 'Juan', completed: 5, hours: 20.0, workload: 60 },
  { name: 'Laura', completed: 6, hours: 31.0, workload: 70 },
];

export function aggregateDeveloperStats(items) {
  if (!items?.length) return null;
  const map = {};
  for (const item of items) {
    const dev = item.developer || item.assignee;
    if (!dev) continue;
    if (!map[dev]) map[dev] = { name: shortDevName(dev), completed: 0, hours: 0, workload: 0 };
    if (item.done) map[dev].completed += 1;
    const h = item.hoursLogged ?? item.hours;
    if (h != null && !Number.isNaN(Number(h))) map[dev].hours += Number(h);
  }
  const rows = Object.values(map);
  return rows.length ? rows : null;
}

function sprintDevelopersToChartRows(sprint) {
  if (!sprint?.developers?.length) return FALLBACK_DEVELOPER_CHART_DATA;
  return sprint.developers.map((d) => ({
    name: shortDevName(d.name),
    completed: d.completed,
    hours: d.hours,
    workload: d.workload ?? 0,
  }));
}

/** Fixed plot height so ResponsiveContainer does not collapse and overlap following content (incl. legend). */
const CHART_H = 340;

function ChartCard({ title, icon: Icon, children }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #EFEFEF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: 'rgba(199,70,52,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {Icon ? <Icon sx={{ color: '#C74634', fontSize: 22 }} /> : null}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

function ChartSizeBox({ children }) {
  return (
    <Box sx={{ width: '100%', height: CHART_H, minHeight: CHART_H, position: 'relative' }}>{children}</Box>
  );
}

function VerticalBarsCompleted({ data, grouped, selectedSprints }) {
  return (
    <ChartSizeBox>
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: grouped ? 4 : 8 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={{ stroke: '#E0E0E0' }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }} />
        {grouped ? (
          <>
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
            {selectedSprints.map((sp) => (
              <Bar
                key={sp.id}
                dataKey={`${sp.shortLabel}_c`}
                name={sp.name}
                fill={sp.accentColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </>
        ) : (
          <Bar dataKey="completed" name="Completed" fill="#C74634" radius={[4, 4, 0, 0]} maxBarSize={36} />
        )}
      </BarChart>
    </ResponsiveContainer>
    </ChartSizeBox>
  );
}

function VerticalBarsHours({ data, grouped, selectedSprints }) {
  return (
    <ChartSizeBox>
      <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: grouped ? 4 : 8 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={{ stroke: '#E0E0E0' }} />
        <YAxis tick={{ fontSize: 11 }} axisLine={false} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }}
          formatter={(v) => [`${v} h`, '']}
        />
        {grouped ? (
          <>
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
            {selectedSprints.map((sp) => (
              <Bar
                key={sp.id}
                dataKey={`${sp.shortLabel}_h`}
                name={sp.name}
                fill={sp.accentColor}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </>
        ) : (
          <Bar dataKey="hours" name="Hours" fill="#1E88E5" radius={[4, 4, 0, 0]} maxBarSize={36} />
        )}
      </BarChart>
    </ResponsiveContainer>
    </ChartSizeBox>
  );
}

function VerticalBarsWorkload({ data, grouped, selectedSprints }) {
  return (
    <ChartSizeBox>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: grouped ? 4 : 8 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={{ stroke: '#E0E0E0' }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[0, 100]} axisLine={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }}
            formatter={(v) => [`${v}%`, '']}
          />
          {grouped ? (
            <>
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="square" />
              {selectedSprints.map((sp) => (
                <Bar
                  key={sp.id}
                  dataKey={`${sp.shortLabel}_w`}
                  name={sp.name}
                  fill={sp.accentColor}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              ))}
            </>
          ) : (
            <Bar dataKey="workload" name="Workload" fill="#FB8C00" radius={[4, 4, 0, 0]} maxBarSize={36} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartSizeBox>
  );
}

/**
 * @param {'both' | 'completed' | 'hours' | 'workload'} [props.which='both']
 */
export default function DeveloperWorkloadCharts({
  data,
  items,
  comparisonMode = false,
  selectedSprints = [],
  which = 'both',
}) {
  const { completedData, hoursData, workloadData, grouped } = useMemo(() => {
    const multi = comparisonMode && selectedSprints.length > 1;
    if (multi) {
      return {
        completedData: buildGroupedCompletedData(selectedSprints),
        hoursData: buildGroupedHoursData(selectedSprints),
        workloadData: buildGroupedWorkloadData(selectedSprints),
        grouped: true,
      };
    }
    if (selectedSprints.length === 1) {
      const rows = sprintDevelopersToChartRows(selectedSprints[0]);
      return { completedData: rows, hoursData: rows, workloadData: rows, grouped: false };
    }
    if (data?.length) {
      return { completedData: data, hoursData: data, workloadData: data, grouped: false };
    }
    const fromItems = aggregateDeveloperStats(items);
    const rows = fromItems?.length ? fromItems : FALLBACK_DEVELOPER_CHART_DATA;
    return { completedData: rows, hoursData: rows, workloadData: rows, grouped: false };
  }, [comparisonMode, selectedSprints, data, items]);

  if (which !== 'both') {
    return (
      <Box sx={{ width: '100%' }}>
        {which === 'completed' && (
          <ChartCard title="Completed tasks per developer" icon={BarChartIcon}>
            <VerticalBarsCompleted data={completedData} grouped={grouped} selectedSprints={selectedSprints} />
          </ChartCard>
        )}
        {which === 'hours' && (
          <ChartCard title="Hours worked per developer" icon={ScheduleIcon}>
            <VerticalBarsHours data={hoursData} grouped={grouped} selectedSprints={selectedSprints} />
          </ChartCard>
        )}
        {which === 'workload' && (
          <ChartCard title="Workload index per developer" icon={SpeedIcon}>
            <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 1 }}>
              Relative load (0–100) from sprint planning data.
            </Typography>
            <VerticalBarsWorkload data={workloadData} grouped={grouped} selectedSprints={selectedSprints} />
          </ChartCard>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Completed tasks per developer" icon={BarChartIcon}>
            <VerticalBarsCompleted data={completedData} grouped={grouped} selectedSprints={selectedSprints} />
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Hours worked per developer" icon={ScheduleIcon}>
            <VerticalBarsHours data={hoursData} grouped={grouped} selectedSprints={selectedSprints} />
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
