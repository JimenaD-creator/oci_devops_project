import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from "@mui/material";
import { Target } from "lucide-react";
import KpiDonutChart from './KpiDonutChart';
import IndividualTable from './IndividualTable';
import DeveloperTable from './DeveloperTable';
import DeveloperWorkloadCharts from './DeveloperWorkloadCharts';
import { fetchDashboardSprints } from '../dashboard/dashboardSprintData';
import { SECTION_BRAND_DARK, SECTION_ACCENT, sectionRgba } from '../dashboard/constants/dashboardConstants';
//import KPIInsightsPanel from './KPIInsightsPanel';

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
const pageEase = [0.22, 1, 0.36, 1];

const KPI_ANALYTICS_CARD_TOOLTIPS = {
  'Completion Rate': 'Share of tasks in this sprint that are marked Done, out of all tasks in the sprint.',
  'On-Time Delivery': 'Among tasks already completed, the percentage that were finished on or before their due date.',
  'Team Participation': 'How logged hours compare to planned hours on tasks in this sprint.',
  'Workload Balance': 'How evenly tasks are distributed among team members. 100% = perfectly balanced.',
};

const tooltipSlotProps = {
  tooltip: {
    sx: { maxWidth: 300, fontSize: '0.8125rem', lineHeight: 1.5, fontWeight: 500, py: 1, px: 1.25 },
  },
};

function ProductivityScoreCard({ completionRate, onTimeDelivery, teamParticipation, workloadBalance }) {
  const score = Math.round(
    (completionRate * 0.4) + (onTimeDelivery * 0.3) + (teamParticipation * 0.2) + (workloadBalance * 0.1)
  );

  const components = [
    { label: 'Completion rate', value: completionRate, weight: '×0.4', color: '#1565C0' },
    { label: 'On-time delivery', value: onTimeDelivery, weight: '×0.3', color: '#FB8C00' },
    { label: 'Team participation', value: teamParticipation, weight: '×0.2', color: '#8E24AA' },
    { label: 'Workload balance', value: workloadBalance, weight: '×0.1', color: '#1D9E75' },
  ];

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 2,
        border: `1px solid ${sectionRgba(0.22)}`,
        borderLeft: '4px solid #2E7D32',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        mb: 4,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#455A64', fontWeight: 700, display: 'block' }}>
            Productivity Score
          </Typography>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: '#1A1A1A', lineHeight: 1.1 }}>
            {score}<span style={{ fontSize: '1rem', fontWeight: 500, color: '#607D8B' }}>%</span>
          </Typography>
        </Box>
        <KpiDonutChart
          pct={score}
          displayValue={`${score}%`}
          displaySuffix=""
          arcColor="#2E7D32"
          height={90}
          innerRadius={28}
          outerRadius={40}
          width={90}
          maxWidth={90}
          valueFontSize="0.85rem"
        />
      </Box>

      <Box sx={{ height: 8, bgcolor: '#F0F0F0', borderRadius: 99, mb: 2, overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            width: `${score}%`,
            bgcolor: '#2E7D32',
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </Box>

      <Grid container spacing={1.5}>
        {components.map(({ label, value, weight, color }) => (
          <Grid item xs={6} key={label}>
            <Box sx={{ bgcolor: '#F8F9FA', borderRadius: 1.5, p: 1.25 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#607D8B', fontWeight: 600 }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#90A4AE' }}>{weight}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, height: 5, bgcolor: '#E0E0E0', borderRadius: 99, overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', width: `${Math.min(100, value)}%`, bgcolor: color, borderRadius: 99 }} />
                </Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A1A1A', minWidth: 30, textAlign: 'right' }}>
                  {Math.round(value)}%
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Typography sx={{ fontSize: '0.7rem', color: '#90A4AE', textAlign: 'center', mt: 1.5 }}>
        Weighted average — completion (40%), on-time (30%), participation (20%), balance (10%)
      </Typography>
    </Paper>
  );
}

export default function KPIAnalytics({ projectId }) {
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSprintId, setSelectedSprintId] = useState(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const pid =
        projectId != null && String(projectId).trim() !== ''
          ? String(projectId).trim()
          : (typeof localStorage !== 'undefined'
              ? String(localStorage.getItem('currentProjectId') || '').trim()
              : '');
      const projectKey = pid || null;

      const tasksUrl = projectKey != null
        ? `${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectKey)}`
        : `${API_BASE}/api/tasks`;

      const [enrichedSprints, tasksRes] = await Promise.all([
        fetchDashboardSprints(projectKey),
        fetch(tasksUrl),
      ]);

      let sprintsData = Array.isArray(enrichedSprints) ? enrichedSprints : [];
      let tasksData = [];
      if (tasksRes.ok) {
        try { tasksData = await tasksRes.json(); } catch { tasksData = []; }
      }

      if (pid) {
        sprintsData = sprintsData.filter((s) => String(s.assignedProject?.id) === String(pid));
        const sprintIds = new Set(sprintsData.map((s) => s.id));
        tasksData = tasksData.filter(
          (t) => t.assignedSprint?.id != null && sprintIds.has(t.assignedSprint.id)
        );
      }

      setSprints(sprintsData);
      setTasks(tasksData);

      setSelectedSprintId((prev) => {
        if (sprintsData.length === 0) return null;
        if (prev != null && sprintsData.some((s) => s.id === prev)) return prev;
        const activeSprint = sprintsData.find((s) => {
          const now = new Date();
          return now >= new Date(s.startDate) && now <= new Date(s.dueDate);
        });
        return activeSprint?.id ?? sprintsData[0]?.id ?? null;
      });
    } catch (error) {
      console.error('Error loading KPI data:', error);
      setSprints([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedSprint = () => sprints.find(s => s.id === selectedSprintId);

  const getSprintTasks = () => {
    const sprint = getSelectedSprint();
    if (!sprint) return [];
    return tasks.filter(t => t.assignedSprint?.id === sprint.id);
  };

const calculateKPIs = () => {
    const sprint = getSelectedSprint();
    const sprintTasks = getSprintTasks();
    const totalTasks = sprintTasks.length;
    const completedTasks = sprintTasks.filter(t => t.status === 'DONE').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const onTimeTasks = sprintTasks.filter(t => {
      if (t.status !== 'DONE') return false;
      return new Date(t.finishDate ?? new Date()) <= new Date(t.dueDate);
    }).length;
    const onTimeDelivery = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0;

    const teamParticipation = sprint?.kpis?.teamParticipation ?? 0;
    const workloadBalance = Math.round((sprint?.kpis?.workloadBalance ?? 0) * 100);

    return { completionRate, onTimeDelivery, teamParticipation, workloadBalance, totalTasks, completedTasks };
};

  const kpis = calculateKPIs();
  const currentSprint = getSelectedSprint();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: SECTION_ACCENT }} />
      </Box>
    );
  }

  return (
    <>
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
        sx={{ maxWidth: 1200, width: "100%" }}
      >
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.34, ease: pageEase }}
          sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: SECTION_BRAND_DARK, letterSpacing: "-0.5px" }}>KPI Analytics</Typography>
            <Typography variant="body2" sx={{ color: "#607D8B", mt: 0.5, fontWeight: 600 }}>
              {currentSprint ? `Sprint ${currentSprint.id} selected` : 'No sprint selected'}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            {sprints.length > 0 && (
              <FormControl
                size="small"
                sx={{
                  minWidth: { xs: "100%", sm: 220 },
                  '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#FFFFFF' },
                  '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': { borderColor: sectionRgba(0.32) },
                  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: sectionRgba(0.48) },
                  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2, borderColor: SECTION_ACCENT },
                  '& .MuiInputLabel-root.Mui-focused': { color: SECTION_ACCENT },
                }}
              >
                <InputLabel id="kpi-analytics-sprint-filter">Sprint</InputLabel>
                <Select
                  labelId="kpi-analytics-sprint-filter"
                  value={selectedSprintId || ''}
                  label="Sprint"
                  onChange={(e) => setSelectedSprintId(Number(e.target.value))}
                >
                  {sprints.map((s) => (
                    <MenuItem key={s.id} value={s.id}>Sprint {s.id}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: sectionRgba(0.08), border: `1px solid ${sectionRgba(0.22)}`, borderRadius: 2, px: 2, py: 1 }}>
              <Target size={16} color={SECTION_ACCENT} aria-hidden />
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: SECTION_BRAND_DARK }}>Goal: +20% productivity</Typography>
            </Box>
          </Box>
        </Box>

        <Grid
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.34, ease: pageEase }}
          container
          spacing={3}
          sx={{ mb: 3 }}
        >
          {[
            { label: 'Completion Rate', pct: kpis.completionRate, arcColor: '#1565C0', borderColor: '#5C6BC0' },
            { label: 'On-Time Delivery', pct: kpis.onTimeDelivery, arcColor: '#FB8C00', borderColor: '#FFB74D' },
            { label: 'Team Participation', pct: kpis.teamParticipation, arcColor: '#8E24AA', borderColor: '#BA68C8' },
            { label: 'Workload Balance', pct: kpis.workloadBalance, arcColor: '#1D9E75', borderColor: '#4DB6AC' },
          ].map(({ label, pct, arcColor, borderColor }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Tooltip
                title={KPI_ANALYTICS_CARD_TOOLTIPS[label] ?? ''}
                arrow
                enterDelay={280}
                describeChild
                componentsProps={tooltipSlotProps}
              >
                <Paper
                  component="div"
                  tabIndex={0}
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderRadius: 2,
                    border: `1px solid ${sectionRgba(0.22)}`,
                    borderLeft: `4px solid ${borderColor}`,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    minHeight: 232,
                    boxSizing: 'border-box',
                    cursor: 'help',
                    outline: 'none',
                    '&:focus-visible': { boxShadow: `0 0 0 2px #FFFFFF, 0 0 0 4px ${SECTION_ACCENT}` },
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#455A64', fontWeight: 700, display: 'block', mb: 0.5 }}>
                    {label}
                  </Typography>
                  <KpiDonutChart
                    pct={pct}
                    displayValue={`${Math.round(pct)}%`}
                    displaySuffix=""
                    arcColor={arcColor}
                    height={{ xs: 150, sm: 160 }}
                    innerRadius={50}
                    outerRadius={68}
                    width={{ xs: '100%', sm: '100%' }}
                    maxWidth={260}
                    valueFontSize={{ xs: '1.5rem', sm: '1.65rem' }}
                  />
                </Paper>
              </Tooltip>
            </Grid>
          ))}
        </Grid>

        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.34, ease: pageEase }}
        >
          <ProductivityScoreCard
            completionRate={kpis.completionRate}
            onTimeDelivery={kpis.onTimeDelivery}
            teamParticipation={kpis.teamParticipation}
            workloadBalance={kpis.workloadBalance}
          />
        </Box>
        

        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.36, ease: pageEase }}
        >
          <DeveloperWorkloadCharts
            selectedSprints={sprints.filter((s) => s.id === selectedSprintId)}
            compareMode={false}
          />
          <DeveloperTable selectedSprints={sprints.filter(s => s.id === selectedSprintId)} compareMode={false} />
          <IndividualTable />
        </Box>
      </Box>
    </>
  );
}