import React, { useMemo } from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { shortDevName } from '../dashboard/dashboardSprintData';

const COLORS = ['#C74634', '#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#607D8B'];
const CHART_H = 340;

function ChartCard({ title, iconElement, children }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid #EFEFEF', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', width: '100%', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'rgba(199,70,52,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {iconElement ?? null}
        </Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>{title}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

export default function DeveloperWorkloadCharts({ selectedSprints = [] }) {
  const chartData = useMemo(() => {
    if (!selectedSprints?.length) return [];
    const devMap = {};
    selectedSprints.forEach(sprint => {
      (sprint.developers || []).forEach(dev => {
        const name = dev.name;
        if (!name) return;
        if (!devMap[name]) {
          devMap[name] = { name: shortDevName(name), completed: 0, hours: 0 };
        }
        devMap[name].completed += (dev.completed || 0);
        devMap[name].hours += (dev.hours || 0);
      });
    });
    return Object.values(devMap).filter(d => d.completed > 0 || d.hours > 0);
  }, [selectedSprints]);

  if (chartData.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed #ccc', borderRadius: 2 }}>
        <Typography variant="body2" color="textSecondary">No hay asignaciones reales para los sprints seleccionados.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ChartCard title="Tareas Completadas por Dev" iconElement={<BarChartIcon sx={{ color: '#C74634', fontSize: 22 }} />}>
            <Box sx={{ width: '100%', height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="completed" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} tareas`, 'Completadas']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <ChartCard title="Horas Trabajadas por Dev" iconElement={<ScheduleIcon sx={{ color: '#1E88E5', fontSize: 22 }} />}>
            <Box sx={{ width: '100%', height: CHART_H }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="hours" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    label={({ name, value }) => `${name}: ${value}h`}>
                    {chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}h`, 'Horas']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}