import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Box, Typography, CircularProgress, Grid, Paper, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import { Target } from "lucide-react";
import KpiDonutChart from "../components/dashboard/KpiDonutChart";
import IndividualTable from "../components/analytics/IndividualTable";
import DeveloperTable from "../components/analytics/DeveloperTable";
import DeveloperWorkloadCharts from "../components/analytics/DeveloperWorkloadCharts";
import { fetchDashboardSprints } from "../components/dashboard/dashboardSprintData";
import { SECTION_BRAND_DARK, SECTION_ACCENT, sectionRgba } from "../components/dashboard/dashboardConstants";

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
const pageEase = [0.22, 1, 0.36, 1];

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

      const tasksUrl =
        projectKey != null
          ? `${API_BASE}/api/tasks?projectId=${encodeURIComponent(projectKey)}`
          : `${API_BASE}/api/tasks`;

      const [enrichedSprints, tasksRes] = await Promise.all([
        fetchDashboardSprints(projectKey),
        fetch(tasksUrl),
      ]);

      let sprintsData = Array.isArray(enrichedSprints) ? enrichedSprints : [];
      let tasksData = [];
      if (tasksRes.ok) {
        try {
          tasksData = await tasksRes.json();
        } catch {
          tasksData = [];
        }
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
          const start = new Date(s.startDate);
          const due = new Date(s.dueDate);
          return now >= start && now <= due;
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

  const getSelectedSprint = () => {
    return sprints.find(s => s.id === selectedSprintId);
  };

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
      const dueDate = new Date(t.dueDate);
      const finishDate = t.finishDate ? new Date(t.finishDate) : new Date();
      return finishDate <= dueDate;
    }).length;
    const onTimeDelivery = completedTasks > 0 ? Math.round((onTimeTasks / completedTasks) * 100) : 0;
    
    const totalAssignedHours = sprintTasks.reduce((sum, t) => sum + (t.assignedHours || 0), 0);
    const productivityScore = totalAssignedHours > 0 ? Math.min(100, Math.round((completionRate * totalAssignedHours) / 100)) : completionRate;
    
    return {
      completionRate,
      onTimeDelivery,
      productivityScore,
      teamParticipation: Math.round((sprint?.teamParticipation || 0) * 100),
      workloadBalance: sprint?.workloadBalance || 0,
      totalTasks,
      completedTasks,
      totalAssignedHours
    };
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
                    <MenuItem key={s.id} value={s.id}>
                      Sprint {s.id}
                    </MenuItem>
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
          sx={{ mb: 4 }}
        >
          {[
            { label: 'Completion Rate', pct: kpis.completionRate, arcColor: '#1565C0', borderColor: '#5C6BC0' },
            { label: 'On-Time Delivery', pct: kpis.onTimeDelivery, arcColor: '#FB8C00', borderColor: '#FFB74D' },
            { label: 'Team Participation', pct: kpis.teamParticipation, arcColor: '#8E24AA', borderColor: '#BA68C8' },
            { label: 'Productivity Score', pct: kpis.productivityScore, arcColor: '#2E7D32', borderColor: '#66BB6A' },
          ].map(({ label, pct, arcColor, borderColor }) => (
            <Grid item xs={12} sm={6} md={3} key={label}>
              <Paper
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
            </Grid>
          ))}
        </Grid>

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