import React, { useState, useEffect } from "react";
import { Box, Typography, CircularProgress, Grid, Paper, Chip } from "@mui/material";
import { Calendar, Target, TrendingUp, CheckCircle, Timer, Users } from "lucide-react";
import KPIComparisonCards from "../components/analytics/KPIComparisonCards";
import IndividualTable from "../components/analytics/IndividualTable";
import DeveloperTable from "../components/analytics/DeveloperTable";

const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';
const ORACLE_RED = '#C74634';

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
      const sprintsUrl = projectId ? `${API_BASE}/api/sprints?projectId=${projectId}` : `${API_BASE}/api/sprints`;
      const [sprintsRes, tasksRes] = await Promise.all([
        fetch(sprintsUrl),
        fetch(`${API_BASE}/api/tasks`)
      ]);
      let sprintsData = await sprintsRes.json();
      const tasksData = await tasksRes.json();
      
      if (projectId) {
        sprintsData = sprintsData.filter(s => s.assignedProject?.id == projectId);
      }
      
      setSprints(sprintsData);
      setTasks(tasksData);
      if (sprintsData.length > 0 && !selectedSprintId) {
        const activeSprint = sprintsData.find(s => {
          const now = new Date();
          const start = new Date(s.startDate);
          const due = new Date(s.dueDate);
          return now >= start && now <= due;
        });
        setSelectedSprintId(activeSprint?.id || sprintsData[0]?.id);
      }
    } catch (error) {
      console.error('Error loading KPI data:', error);
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
        <CircularProgress sx={{ color: ORACLE_RED }} />
      </Box>
    );
  }

  return (
    <>
      <style>
        {`
          .kpi-progress-card {
            background-color: white;
            border-radius: 12px;
            border: 1px solid #F3F4F6;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            padding: 20px;
            margin-bottom: 24px;
          }
          .progress-info { display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }
          @media (min-width: 640px) { .progress-info { flex-direction: row; align-items: center; } }
          .progress-percentage { font-size: 36px; font-weight: 700; color: #C74634; margin: 0; }
          .progress-track { width: 100%; height: 12px; background-color: #F3F4F6; border-radius: 9999px; overflow: hidden; margin-top: 12px; }
          .progress-fill { height: 100%; background: linear-gradient(to right, #C74634, #e05a4a); border-radius: 9999px; transition: width 1s ease-in-out; }
          .progress-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; color: #6F6F6F; }
        `}
      </style>

      <Box sx={{ maxWidth: 1200, width: "100%" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#1A1A1A", letterSpacing: "-0.5px" }}>KPI Analytics</Typography>
            <Typography variant="body2" sx={{ color: "#999", mt: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
              <Calendar size={14} aria-hidden />
              {currentSprint ? `${new Date(currentSprint.startDate).toLocaleDateString()} – ${new Date(currentSprint.dueDate).toLocaleDateString()}` : 'No sprint selected'}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {sprints.length > 0 && (
              <select value={selectedSprintId || ''} onChange={(e) => setSelectedSprintId(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${ORACLE_RED}`, background: 'white', fontWeight: 600 }}>
                {sprints.map(s => <option key={s.id} value={s.id}>Sprint {s.id} - {new Date(s.startDate).toLocaleDateString()}</option>)}
              </select>
            )}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: "rgba(199, 70, 52, 0.1)", border: "1px solid rgba(199, 70, 52, 0.2)", borderRadius: 2, px: 2, py: 1 }}>
              <Target size={16} color="#C74634" aria-hidden />
              <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", color: "#C74634" }}>Goal: +20% productivity</Typography>
            </Box>
          </Box>
        </Box>

        <div className="kpi-progress-card">
          <div className="progress-info">
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#2E2E2E", margin: "0 0 4px 0" }}>Overall Productivity</h2>
              <p style={{ fontSize: "14px", color: "#6F6F6F", margin: 0 }}>Sprint {currentSprint?.id} · {kpis.totalTasks} tasks, {kpis.completedTasks} completed</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p className="progress-percentage">{kpis.productivityScore}%</p>
              <p style={{ fontSize: "12px", color: "#6F6F6F", margin: 0 }}>Productivity Score</p>
            </div>
          </div>
          <div style={{ marginTop: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "500", color: "#6F6F6F" }}>Progress toward +20% goal</span>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#C74634" }}>{Math.min(100, Math.round((kpis.productivityScore / 120) * 100))}% complete</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((kpis.productivityScore / 120) * 100))}%` }} />
            </div>
            <div className="progress-labels">
              <span>Baseline (Sprint 1)</span>
              <span style={{ fontWeight: "600", color: "#C74634" }}>Actual: {kpis.productivityScore}%</span>
              <span>Goal: 120%</span>
            </div>
          </div>
        </div>

        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px solid #EFEFEF' }}>
              <CheckCircle size={24} color={ORACLE_RED} style={{ marginBottom: 8 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: ORACLE_RED }}>{kpis.completionRate}%</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>Completion Rate</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px solid #EFEFEF' }}>
              <Timer size={24} color={ORACLE_RED} style={{ marginBottom: 8 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: ORACLE_RED }}>{kpis.onTimeDelivery}%</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>On-Time Delivery</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px solid #EFEFEF' }}>
              <Users size={24} color={ORACLE_RED} style={{ marginBottom: 8 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: ORACLE_RED }}>{kpis.teamParticipation}%</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>Team Participation</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', borderRadius: 2, border: '1px solid #EFEFEF' }}>
              <TrendingUp size={24} color={ORACLE_RED} style={{ marginBottom: 8 }} />
              <Typography variant="h4" sx={{ fontWeight: 800, color: ORACLE_RED }}>{kpis.productivityScore}%</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>Productivity Score</Typography>
            </Paper>
          </Grid>
        </Grid>

        <KPIComparisonCards sprints={sprints} tasks={tasks} />
        <DeveloperTable selectedSprints={sprints.filter(s => s.id === selectedSprintId)} compareMode={false} />
        <IndividualTable />
      </Box>
    </>
  );
}