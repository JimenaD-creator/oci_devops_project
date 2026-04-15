import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Typography,
  LinearProgress, Paper, Card, CardContent, IconButton, Badge,
  FormGroup, FormControlLabel, Checkbox, CircularProgress,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import SummaryCards from './SummaryCards';
import KPICards from './KPICards';
import SprintComparisonCharts from './SprintComparisonCharts';
import DeveloperWorkloadCharts from '../analytics/DeveloperWorkloadCharts';
import DeveloperTable from '../analytics/DeveloperTable';
import { fetchDashboardSprints } from './dashboardSprintData';
import { DASHBOARD_CONTENT_MAX_WIDTH } from './dashboardConstants';

const ORACLE_RED = '#C74634';

export default function DashboardPage() {
  const [allSprints, setAllSprints] = useState([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [selectedSprintIds, setSelectedSprintIds] = useState([]);

  useEffect(() => {
    handleRefresh();
  }, []);

  const handleRefresh = () => {
    setSprintsLoading(true);
    fetchDashboardSprints()
      .then((sprints) => {
        setAllSprints(sprints);
        if (sprints.length > 0 && selectedSprintIds.length === 0) {
          const active = sprints.find((s) => s.status === 'active') ?? sprints[sprints.length - 1];
          setSelectedSprintIds([Number(active.id)]);
        }
      })
      .finally(() => setSprintsLoading(false));
  };

  /** Unique sprint ids that exist in `allSprints` (fixes duplicate ids in state after many toggles). */
  const normalizedSelectedIds = useMemo(() => {
    if (!allSprints.length) return [];
    const valid = new Set(allSprints.map((s) => Number(s.id)));
    return [...new Set(selectedSprintIds.map(Number).filter(Number.isFinite))].filter((id) => valid.has(id));
  }, [selectedSprintIds, allSprints]);

  /** Dedupe / prune invalid ids in state (e.g. [1,1,2] or stale ids) so compareMode matches the UI. */
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

  /**
   * One sprint per id, order follows first occurrence in normalizedSelectedIds.
   */
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

  const projectName = useMemo(() => {
    const name = allSprints.find((s) => s.assignedProject?.name)?.assignedProject?.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
    return 'Project';
  }, [allSprints]);

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

  /** Promedio de `kpis.completionRate` del API (0–100) para la barra bajo el header. */
  const heroProgress = useMemo(() => {
    if (!selectedSprints.length) return 0;
    const sum = selectedSprints.reduce((a, s) => a + (s.kpis?.completionRate ?? 0), 0);
    return Math.round(sum / selectedSprints.length);
  }, [selectedSprints]);

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
        <CircularProgress sx={{ color: ORACLE_RED }} />
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

      <Card sx={{ borderRadius: 3, border: '1px solid #EFEFEF', mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>
              Completion rate
            </Typography>
            <Typography variant="h6" component="span" sx={{ fontWeight: 800, color: ORACLE_RED, lineHeight: 1 }}>
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
              '& .MuiLinearProgress-bar': { bgcolor: ORACLE_RED },
            }}
          />
        </CardContent>
      </Card>

      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #ECECEC' }}>
        <Typography variant="body2" sx={{ color: '#555', fontWeight: 600, mb: 1.25 }}>
          Select one or more sprints to view or compare metrics.
        </Typography>
        <FormGroup row sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {allSprints.map((sp) => {
            const sprintColor = sp.accentColor ?? '#607D8B';
            return (
              <FormControlLabel
                key={sp.id}
                control={(
                  <Checkbox
                    size="small"
                    checked={selectedSprintIds.some((x) => Number(x) === Number(sp.id))}
                    onChange={(e) => toggleSprint(sp.id, e.target.checked)}
                    sx={{ '&.Mui-checked': { color: sprintColor } }}
                  />
                )}
                label={(
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
                )}
              />
            );
          })}
        </FormGroup>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, overflow: 'visible' }}>
        {!compareMode ? (
          <SummaryCards
            totalHoursDisplay={Number(primarySprint?.totalHours || 0).toFixed(1)}
            taskStatusDistribution={primarySprint?.taskStatusDistribution ?? []}
            taskStatusTotal={primarySprint?.taskStatusTotal ?? 0}
          />
        ) : (
          <Box sx={{ mb: 3 }}>
            <SprintComparisonCharts selectedSprints={selectedSprints} />
          </Box>
        )}

        {selectedSprints.length > 0 ? (
          <Box sx={{ mb: { xs: 2, sm: 3 }, width: '100%', minWidth: 0 }}>
            <KPICards compareMode={compareMode} selectedSprints={selectedSprints} />
          </Box>
        ) : null}

        <Box sx={{ mt: { xs: 3, sm: 4 }, width: '100%', minWidth: 0 }}>
          <DeveloperWorkloadCharts selectedSprints={selectedSprints} compareMode={compareMode} />
        </Box>

        <Box sx={{ mt: 3 }}>
          <DeveloperTable selectedSprints={selectedSprints} compareMode={compareMode} />
        </Box>
      </Box>
    </Box>
  );
}
