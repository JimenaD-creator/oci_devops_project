import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Box, Typography,
  LinearProgress, Paper, Card, CardContent, IconButton, Badge,
  FormGroup, FormControlLabel, Checkbox, CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import TaskStatusDistributionChart from './TaskStatusDistributionChart';
import DashboardTopMetrics from './DashboardTopMetrics';
import DashboardDeveloperCharts from './DashboardDeveloperCharts';
import DeveloperTable from '../analytics/DeveloperTable';
import {
  fetchDashboardSprints,
  mergeTaskStatusAcrossSprints,
  aggregateSelectionMetrics,
} from './dashboardSprintData';
import { DASHBOARD_CONTENT_MAX_WIDTH, DASHBOARD_PRIMARY_ACCENT } from './dashboardConstants';
import { SECTION_TITLE_SX, SECTION_DESC_SX } from './dashboardTypography';
import ScrollReveal from './ScrollReveal';

export default function DashboardPage({ projectId: propProjectId }) {
  const [allSprints, setAllSprints] = useState([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [selectedSprintIds, setSelectedSprintIds] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  const projectId = propProjectId || localStorage.getItem('currentProjectId');

  useEffect(() => {
    if (projectId) {
      loadProjectInfo();
      handleRefresh();
    }
  }, [projectId]);

  const loadProjectInfo = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/projects/${projectId}`);
      if (response.ok) {
        const project = await response.json();
        setCurrentProject(project);
      }
    } catch (err) {
      console.error('Error loading project:', err);
    }
  };

  const handleRefresh = useCallback(() => {
    setSprintsLoading(true);
    fetchDashboardSprints(projectId)
      .then((sprints) => {
        setAllSprints(sprints);
        setSelectedSprintIds((prev) => {
          if (sprints.length > 0 && prev.length === 0) {
            const active = sprints.find((s) => s.status === 'active') ?? sprints[sprints.length - 1];
            return [Number(active.id)];
          }
          return prev;
        });
      })
      .finally(() => setSprintsLoading(false));
  }, [projectId]);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  const normalizedSelectedIds = useMemo(() => {
    if (!allSprints.length) return [];
    const valid = new Set(allSprints.map((s) => Number(s.id)));
    return [...new Set(selectedSprintIds.map(Number).filter(Number.isFinite))].filter((id) => valid.has(id));
  }, [selectedSprintIds, allSprints]);

  useEffect(() => {
    if (!allSprints.length || sprintsLoading) return;
    if (normalizedSelectedIds.length === 0) {
      const active = allSprints.find((s) => s.status === 'active') ?? allSprints[allSprints.length - 1];
      setSelectedSprintIds([Number(active.id)]);
      return;
    }
    const raw = selectedSprintIds.map(Number).filter(Number.isFinite);
    const uniqueRaw = [...new Set(raw)];
    const normSorted = [...normalizedSelectedIds].sort((a, b) => a - b).join(',');
    const uniqSorted = uniqueRaw.slice().sort((a, b) => a - b).join(',');
    const hasDuplicateEntries = raw.length !== uniqueRaw.length;
    const needsPrune = uniqSorted !== normSorted;
    if (hasDuplicateEntries || needsPrune) setSelectedSprintIds(normalizedSelectedIds);
  }, [allSprints, sprintsLoading, selectedSprintIds, normalizedSelectedIds]);

  const selectedSprints = useMemo(() => {
    const byId = new Map(allSprints.map((s) => [Number(s.id), s]));
    return normalizedSelectedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => {
        const ia = normalizedSelectedIds.indexOf(Number(a.id));
        const ib = normalizedSelectedIds.indexOf(Number(b.id));
        return ia - ib;
      });
  }, [normalizedSelectedIds, allSprints]);

  const compareMode = normalizedSelectedIds.length > 1;
  const primarySprint = selectedSprints[0];

  const { taskStatusDistribution, taskStatusTotal } = useMemo(
    () => mergeTaskStatusAcrossSprints(selectedSprints),
    [selectedSprints]
  );

  const selectionMetrics = useMemo(
    () => aggregateSelectionMetrics(selectedSprints),
    [selectedSprints]
  );

  const averageTrends = useMemo(() => {
    const chronological = [...selectedSprints].sort((a, b) => {
      const ta = new Date(a?.startDate || 0).getTime();
      const tb = new Date(b?.startDate || 0).getTime();
      return ta - tb;
    });
    const avgTasks = (sp) => {
      const devCount = Array.isArray(sp?.developers) ? sp.developers.length : 0;
      return devCount > 0 ? (Number(sp?.totalTasks) || 0) / devCount : 0;
    };
    const avgHours = (sp) => {
      const devCount = Array.isArray(sp?.developers) ? sp.developers.length : 0;
      return devCount > 0 ? (Number(sp?.totalHours) || 0) / devCount : 0;
    };
    const series = chronological.map((sp, index) => ({
      sprintLabel: sp?.shortLabel || `S${sp?.id ?? index + 1}`,
      avgTasksPerDev: Number(avgTasks(sp).toFixed(2)),
      avgHoursPerDev: Number(avgHours(sp).toFixed(2)),
    }));

    if (chronological.length < 2) {
      return { avgTasksTrend: null, avgHoursTrend: null, series };
    }
    const current = chronological[chronological.length - 1];
    const previous = chronological[chronological.length - 2];

    const tasksDelta = avgTasks(current) - avgTasks(previous);
    const hoursDelta = avgHours(current) - avgHours(previous);

    return {
      avgTasksTrend: { delta: tasksDelta },
      avgHoursTrend: { delta: hoursDelta },
      series,
    };
  }, [selectedSprints]);

  const heroProgress = useMemo(() => {
    if (!taskStatusTotal) return 0;
    const done = taskStatusDistribution.find((r) => r.key === 'DONE')?.count ?? 0;
    return Math.round((100 * done) / taskStatusTotal);
  }, [taskStatusDistribution, taskStatusTotal]);

  const projectName = currentProject?.name || (allSprints.find((s) => s.assignedProject?.name)?.assignedProject?.name) || 'Project';

  const sprintDateLabel = useMemo(() => {
    if (!primarySprint) return '';
    if (compareMode) {
      return selectedSprints
        .map((s) => (s.dateRangeEn || s.dateRange || '').trim())
        .filter(Boolean)
        .join(' · ');
    }
    return primarySprint.dateRangeEn || primarySprint.dateRange || '';
  }, [primarySprint, compareMode, selectedSprints]);

  const teamDeveloperCount = useMemo(
    () => new Set(selectedSprints.flatMap((s) => (s.developers || []).map((d) => d.name))).size,
    [selectedSprints]
  );

  const toggleSprint = (id, checked) => {
    const nid = Number(id);
    setSelectedSprintIds((prev) => {
      const nums = [...new Set(prev.map(Number).filter(Number.isFinite))];
      if (checked) return [...new Set([...nums, nid])];
      if (nums.length <= 1) return nums;
      return nums.filter((x) => x !== nid);
    });
  };

  if (sprintsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#C74634' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: DASHBOARD_CONTENT_MAX_WIDTH,
        width: '100%',
        mx: 'auto',
        pt: 0,
        px: 2,
        pb: 2,
        boxSizing: 'border-box',
      }}
    >
      <ScrollReveal>
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          mb: 1.5,
          borderRadius: 3,
          border: '1px solid #ECECEC',
          bgcolor: '#FFFFFF',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 2,
            mb: 1.5,
          }}
        >
          <Box sx={{ pr: 1, minWidth: 0, flex: 1 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 800,
                color: '#1A1A1A',
                lineHeight: 1.2,
                fontSize: { xs: '1.65rem', sm: '2rem', md: '2.25rem' },
              }}
            >
              Dashboard – {projectName}
            </Typography>
            {sprintDateLabel ? (
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 600, mt: 0.75 }}>
                {compareMode ? 'Sprint dates: ' : 'Sprint Date: '}
                {sprintDateLabel}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: '#666', fontWeight: 500, mt: 0.5 }}>
                {compareMode ? 'Multi-sprint comparison' : `${primarySprint?.name ?? 'Sprint'} overview`}
              </Typography>
            )}
          </Box>
          <IconButton sx={{ bgcolor: '#F5F5F5', flexShrink: 0 }} aria-label="Notifications">
            <Badge badgeContent={1} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1A1A1A' }}>
            {compareMode ? 'Multi-sprint comparison' : (primarySprint?.name || 'Project Progress')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <GroupIcon sx={{ fontSize: 18, color: '#757575' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#555' }}>
              {teamDeveloperCount} devs
            </Typography>
          </Box>
        </Box>
      </Paper>
      </ScrollReveal>

      <ScrollReveal delay={0.04}>
      <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
              Completion rate
            </Typography>
            <Typography variant="h6" component="span" sx={{ fontWeight: 800, color: DASHBOARD_PRIMARY_ACCENT, lineHeight: 1 }}>
              {heroProgress}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={heroProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#F0F0F0',
              '& .MuiLinearProgress-bar': { bgcolor: DASHBOARD_PRIMARY_ACCENT },
            }}
          />
        </CardContent>
      </Card>
      </ScrollReveal>

      <ScrollReveal delay={0.07}>
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC' }}>
        <FormGroup row sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {allSprints.map((sp) => {
            const sprintColor = sp.accentColor ?? '#607D8B';
            return (
              <FormControlLabel
                key={sp.id}
                control={
                  <Checkbox
                    size="small"
                    checked={selectedSprintIds.some((x) => Number(x) === Number(sp.id))}
                    onChange={(e) => toggleSprint(sp.id, e.target.checked)}
                    sx={{ '&.Mui-checked': { color: sprintColor } }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      component="span"
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: sprintColor,
                        flexShrink: 0,
                      }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{sp.name}</Typography>
                  </Box>
                }
              />
            );
          })}
        </FormGroup>
      </Paper>
      </ScrollReveal>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, overflow: 'visible' }}>
        <ScrollReveal delay={0.05}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: compareMode ? 'column' : 'row' },
            alignItems: 'stretch',
            gap: { xs: 3, md: 3 },
            width: '100%',
            minWidth: 0,
            mb: 4,
          }}
        >
          <Box
            sx={{
              flex: { md: compareMode ? 'none' : '1 1 0' },
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
            }}
          >
            <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: '#1A1A1A', mb: 0.5, textAlign: 'left', width: '100%' }}>
              Scorecards
            </Typography>
            <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, width: '100%', textAlign: 'left' }}>
              Quick totals and averages for the sprint(s) currently selected above.
            </Typography>
            <DashboardTopMetrics
              showSectionHeader={false}
              multiSprint={compareMode}
              scorecardsFourColumn={compareMode}
              totalTasks={selectionMetrics.totalTasks}
              totalHours={selectionMetrics.totalHours}
              avgTasksPerDev={selectionMetrics.avgTasksPerDev}
              avgHoursPerDev={selectionMetrics.avgHoursPerDev}
              uniqueDevCount={selectionMetrics.uniqueDevCount}
              avgTasksTrend={averageTrends.avgTasksTrend}
              avgHoursTrend={averageTrends.avgHoursTrend}
              avgTrendSeries={averageTrends.series}
            />
          </Box>

          {!compareMode ? (
            <Box
              sx={{
                flex: { md: '1 1 0' },
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                width: { xs: '100%', md: 'auto' },
              }}
            >
              <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: '#1A1A1A', mb: 0.5, textAlign: 'left', width: '100%' }}>
                Project status
              </Typography>
              <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, width: '100%', textAlign: 'left' }}>
                Where tasks sit in the workflow for the active sprint.
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, sm: 2.25 },
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: { xs: 260, md: 0 },
                  width: '100%',
                  borderRadius: 3,
                  border: '1px solid #E3F2FD',
                  borderLeft: '5px solid #1565C0',
                  background: 'linear-gradient(135deg, rgba(21,101,192,0.07) 0%, #FFFFFF 50%)',
                  boxShadow: '0 2px 10px rgba(21,101,192,0.08)',
                  boxSizing: 'border-box',
                }}
              >
                <TaskStatusDistributionChart
                  distribution={taskStatusDistribution}
                  total={taskStatusTotal}
                  embedded
                  caption="Tasks in each workflow stage for this sprint."
                />
              </Paper>
            </Box>
          ) : null}
        </Box>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
        <Box sx={{ mb: 0 }}>
          <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: '#1A1A1A', mb: 0.5 }}>
            Developer performance
          </Typography>
          <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5 }}>
            Charts for workload, hours, and productivity by developer.
          </Typography>
        </Box>
        </ScrollReveal>
        <DashboardDeveloperCharts
          developers={selectionMetrics.developers}
          selectedSprints={selectedSprints}
          compareMode={compareMode}
        />

        <ScrollReveal delay={0.05}>
        <Box sx={{ mt: 4, mb: 0 }}>
          <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: '#1A1A1A', mb: 0.5 }}>
            Developer productivity breakdown
          </Typography>
          <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5 }}>
            Detailed per-developer numbers and sprint columns when comparing.
          </Typography>
        </Box>
        </ScrollReveal>
        <ScrollReveal delay={0.06}>
        <DeveloperTable
          selectedSprints={selectedSprints}
          compareMode={compareMode}
          suppressCardTitle
        />
        </ScrollReveal>
      </Box>
    </Box>
  );
}