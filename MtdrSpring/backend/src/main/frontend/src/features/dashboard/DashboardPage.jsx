import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Card,
  CardContent,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Popover,
  Stack,
  Button,
  Alert,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TaskStatusDistributionChart from './TaskStatusDistributionChart';
import DashboardTopMetrics from './DashboardTopMetrics';
import DashboardDeveloperCharts from './DashboardDeveloperCharts';
import DeveloperTable from '../kpis/DeveloperTable';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { getLastTasksMutatedAt } from '../../utils/taskSyncEvents';
import {
  getCachedBundleSnapshot,
  mergeTaskStatusAcrossSprints,
  aggregateSelectionMetrics,
  sprintDbIdSortKey,
  buildBlockedTaskNotificationItems,
  formatBlockedSinceAge,
  SPRINT_CHART_COLORS,
  buildDeveloperAverageTrendSeries,
} from './dashboardSprintData';
import {
  DASHBOARD_CONTENT_MAX_WIDTH,
  DASHBOARD_BLOCK_GAP,
  completionRateProgressColor,
  SECTION_BRAND_DARK,
} from './constants/dashboardConstants';
import { SECTION_TITLE_SX, SECTION_DESC_SX } from './dashboardTypography';
import ScrollReveal from './ScrollReveal';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { ORACLE_RED_ACTION } from '../sprints/constants/sprintConstants';
import {
  fetchProjectById,
  fetchProjectDevelopers,
  getCachedProjectDevelopersSnapshot,
} from './projectApi';
import {
  collectDeveloperNamesForSelection,
  countTeamDevelopers,
} from '../../utils/teamRosterUtils';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { resolveLoadErrorMessage } from '../../utils/auth';

/** Oracle red used for block-notification emphasis on the dashboard bell. */
const BLOCK_NOTIF_RED = '#C74126';
const AVATAR_PALETTE_LIGHT = [
  { bg: '#EEEDFE', color: '#3C3489' },
  { bg: '#E6F1FB', color: '#0C447C' },
  { bg: '#EAF3DE', color: '#27500A' },
  { bg: '#FAEEDA', color: '#633806' },
  { bg: '#FBEAF0', color: '#72243E' },
  { bg: '#E1F5EE', color: '#085041' },
];

const AVATAR_PALETTE_DARK = [
  { bg: '#2D2A4A', color: '#B39DDB' },
  { bg: '#1A3A5C', color: '#90CAF9' },
  { bg: '#1A4A2A', color: '#A5D6A7' },
  { bg: '#4A2A1A', color: '#FFCC80' },
  { bg: '#4A1A2A', color: '#F48FB1' },
  { bg: '#1A4A4A', color: '#80CBC4' },
];

export default function DashboardPage({
  projectId: propProjectId,
  onNavigateToTasks,
  isPageActive = true,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const AVATAR_PALETTE = isDark ? AVATAR_PALETTE_DARK : AVATAR_PALETTE_LIGHT;
  const {
    sprints: sharedSprints,
    loading: sharedLoading,
    refreshing: sharedRefreshing,
    dataUpdatedAt,
    error: dataError,
    taskCount: sharedTaskCount,
    ensureLoaded,
    invalidateAndRefresh,
  } = useProjectData();

  const [allSprints, setAllSprints] = useState([]);
  /** Sprint ids (strings) selected for dashboard metrics — one or more. */
  const [selectedSprintIds, setSelectedSprintIds] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [selectedDeveloperName, setSelectedDeveloperName] = useState('all');
  const [blockedNotifAnchor, setBlockedNotifAnchor] = useState(null);
  const [seenBlockedKeysCsv, setSeenBlockedKeysCsv] = useState('');

  const projectId = propProjectId || localStorage.getItem('currentProjectId');
  const prevProjectIdRef = useRef(projectId);
  const wasPageActiveRef = useRef(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }
    let cancelled = false;

    const devSnap = getCachedProjectDevelopersSnapshot(projectId);
    if (devSnap) {
      setProjectDevelopers(devSnap.developers);
    }

    Promise.all([
      fetchProjectById(projectId).catch(() => null),
      fetchProjectDevelopers(projectId).catch(() => []),
    ]).then(([project, developers]) => {
      if (cancelled) return;
      if (project) setCurrentProject(project);
      setProjectDevelopers(Array.isArray(developers) ? developers : []);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setAllSprints([]);
      return;
    }
    const projectChanged = prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;

    const sprints = Array.isArray(sharedSprints) ? sharedSprints : [];
    setAllSprints(sprints);

    if (!sharedLoading && sprints.length > 0) {
      const sorted = [...sprints].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b));
      setSelectedSprintIds((prev) => {
        if (!projectChanged && prev.length > 0) {
          const valid = prev.filter((id) => sorted.some((s) => String(s.id) === String(id)));
          if (valid.length > 0) return valid;
        }
        const picked = pickDefaultSelectedSprint(sorted);
        const defaultId = picked?.id ?? sorted[0]?.id;
        return defaultId != null ? [String(defaultId)] : [];
      });
    } else if (sprints.length === 0 && !sharedLoading) {
      setSelectedSprintIds([]);
    }
  }, [projectId, sharedSprints, sharedLoading]);

  useEffect(() => {
    setSeenBlockedKeysCsv('');
  }, [projectId]);

  useEffect(() => {
    if (!isPageActive || !projectId) return;

    const becameActive = isPageActive && !wasPageActiveRef.current;
    wasPageActiveRef.current = isPageActive;
    if (!becameActive) return;

    const lastMut = getLastTasksMutatedAt();
    if (lastMut > dataUpdatedAt) {
      invalidateAndRefresh({ silent: true }).catch(() => {});
      return;
    }

    if (sharedSprints.length === 0 && !sharedLoading && !sharedRefreshing) {
      const cached = getCachedBundleSnapshot(projectId);
      ensureLoaded({ silent: Boolean(cached) }).catch(() => {});
    }
  }, [
    isPageActive,
    projectId,
    dataUpdatedAt,
    sharedSprints.length,
    sharedLoading,
    ensureLoaded,
    invalidateAndRefresh,
  ]);

  const sortedSprintsForFilter = useMemo(
    () => [...allSprints].sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b)),
    [allSprints],
  );

  const getSprintFilterLabel = useCallback(
    (sprintId) => {
      const sprint = allSprints.find((s) => Number(s.id) === Number(sprintId));
      if (sprint?.shortLabel) return sprint.shortLabel;
      if (typeof sprint?.name === 'string' && sprint.name.trim()) return sprint.name.trim();
      const index = sortedSprintsForFilter.findIndex((s) => Number(s.id) === Number(sprintId));
      return index >= 0 ? `Sprint ${index}` : `Sprint ${sprintId}`;
    },
    [allSprints, sortedSprintsForFilter],
  );

  const selectedSprints = useMemo(() => {
    if (!sortedSprintsForFilter.length || !selectedSprintIds.length) return [];
    const idSet = new Set(selectedSprintIds.map(String));
    return sortedSprintsForFilter.filter((s) => idSet.has(String(s.id)));
  }, [sortedSprintsForFilter, selectedSprintIds]);

  const developerNames = useMemo(
    () => collectDeveloperNamesForSelection(selectedSprints, projectDevelopers),
    [selectedSprints, projectDevelopers],
  );

  useEffect(() => {
    if (selectedDeveloperName !== 'all' && !developerNames.includes(selectedDeveloperName)) {
      setSelectedDeveloperName('all');
    }
  }, [selectedDeveloperName, developerNames]);

  const selectedDeveloperNameForMetrics =
    selectedDeveloperName === 'all' ? null : selectedDeveloperName;

  const compareMode = selectedSprints.length > 1;
  const primarySprint = selectedSprints[0];

  const allSprintsSelected = useMemo(
    () =>
      sortedSprintsForFilter.length > 0 &&
      sortedSprintsForFilter.every((s) => selectedSprintIds.includes(String(s.id))),
    [sortedSprintsForFilter, selectedSprintIds],
  );

  const someSprintsSelected = selectedSprintIds.length > 0 && !allSprintsSelected;

  const orderSprintIds = useCallback(
    (ids) => {
      const set = new Set(ids.map(String));
      return sortedSprintsForFilter.map((s) => String(s.id)).filter((id) => set.has(id));
    },
    [sortedSprintsForFilter],
  );

  const handleSelectAllSprints = useCallback(() => {
    setSelectedSprintIds(sortedSprintsForFilter.map((s) => String(s.id)));
  }, [sortedSprintsForFilter]);

  const handleSelectDefaultSprintOnly = useCallback(() => {
    const picked = pickDefaultSelectedSprint(sortedSprintsForFilter);
    const id = picked?.id ?? sortedSprintsForFilter[0]?.id;
    if (id != null) setSelectedSprintIds([String(id)]);
  }, [sortedSprintsForFilter]);

  const handleAllSprintsToggle = useCallback(
    (checked) => {
      if (checked) {
        handleSelectAllSprints();
      } else {
        handleSelectDefaultSprintOnly();
      }
    },
    [handleSelectAllSprints, handleSelectDefaultSprintOnly],
  );

  const toggleSprintId = useCallback(
    (idStr) => {
      setSelectedSprintIds((prev) => {
        const set = new Set(prev.map(String));
        if (set.has(idStr)) {
          if (set.size <= 1) return prev;
          set.delete(idStr);
        } else {
          set.add(idStr);
        }
        return orderSprintIds([...set]);
      });
    },
    [orderSprintIds],
  );

  const { taskStatusDistribution, taskStatusTotal } = useMemo(
    () => mergeTaskStatusAcrossSprints(selectedSprints),
    [selectedSprints],
  );
  const selectionMetrics = useMemo(
    () =>
      aggregateSelectionMetrics(
        selectedSprints,
        projectDevelopers,
        selectedDeveloperNameForMetrics,
      ),
    [selectedSprints, projectDevelopers, selectedDeveloperNameForMetrics],
  );

  /** Unfiltered totals — used for team avg tasks/hours scorecards even when one developer is selected. */
  const teamSelectionMetrics = useMemo(
    () => aggregateSelectionMetrics(selectedSprints, projectDevelopers, null),
    [selectedSprints, projectDevelopers],
  );

  const teamDeveloperCountForAverages = useMemo(() => {
    const rosterCount = countTeamDevelopers(projectDevelopers);
    if (rosterCount > 0) return rosterCount;
    return teamSelectionMetrics.uniqueDevCount || 0;
  }, [projectDevelopers, teamSelectionMetrics.uniqueDevCount]);

  const developerCountForAverages = useMemo(() => {
    if (selectedDeveloperNameForMetrics) return 1;
    return teamDeveloperCountForAverages;
  }, [selectedDeveloperNameForMetrics, teamDeveloperCountForAverages]);

  const averageTrends = useMemo(
    () => buildDeveloperAverageTrendSeries(selectedSprints),
    [selectedSprints],
  );

  const avgTasksPerTeamDev = useMemo(() => {
    if (!teamDeveloperCountForAverages) return teamSelectionMetrics.avgTasksPerDev;
    return teamSelectionMetrics.totalTasks / teamDeveloperCountForAverages;
  }, [
    teamSelectionMetrics.totalTasks,
    teamSelectionMetrics.avgTasksPerDev,
    teamDeveloperCountForAverages,
  ]);

  const avgHoursPerTeamDev = useMemo(() => {
    if (!teamDeveloperCountForAverages) return teamSelectionMetrics.avgHoursPerDev;
    return teamSelectionMetrics.totalHours / teamDeveloperCountForAverages;
  }, [
    teamSelectionMetrics.totalHours,
    teamSelectionMetrics.avgHoursPerDev,
    teamDeveloperCountForAverages,
  ]);

  const heroProgress = useMemo(() => {
    if (!taskStatusTotal) return 0;
    const done = taskStatusDistribution.find((r) => r.key === 'DONE')?.count ?? 0;
    return Math.round((100 * done) / taskStatusTotal);
  }, [taskStatusDistribution, taskStatusTotal]);

  const completionRateColor = useMemo(
    () => completionRateProgressColor(heroProgress),
    [heroProgress],
  );

  const projectName =
    currentProject?.name ||
    allSprints.find((s) => s.assignedProject?.name)?.assignedProject?.name ||
    'Project';

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

  const blockedNotificationItems = useMemo(
    () => buildBlockedTaskNotificationItems(selectedSprints),
    [selectedSprints],
  );
  const hasBlockedNotifications = blockedNotificationItems.length > 0;
  const blockedNotifOpen = Boolean(blockedNotifAnchor);

  const seenBlockedKeySet = useMemo(() => {
    if (!seenBlockedKeysCsv) return new Set();
    return new Set(seenBlockedKeysCsv.split('|').filter(Boolean));
  }, [seenBlockedKeysCsv]);

  const hasUnreadBlockedNotifications = useMemo(
    () => blockedNotificationItems.some((n) => !seenBlockedKeySet.has(n.key)),
    [blockedNotificationItems, seenBlockedKeySet],
  );
  const showBlockedNotifPulse = hasUnreadBlockedNotifications && !blockedNotifOpen;
  const unreadCount = blockedNotificationItems.filter((n) => !seenBlockedKeySet.has(n.key)).length;

  const handleBlockedNotifClose = useCallback(() => {
    setBlockedNotifAnchor(null);
    setSeenBlockedKeysCsv((prev) => {
      if (blockedNotificationItems.length === 0) return '';
      const next = new Set(prev ? prev.split('|').filter(Boolean) : []);
      blockedNotificationItems.forEach((n) => next.add(n.key));
      return [...next].sort().join('|');
    });
  }, [blockedNotificationItems]);

  if (!projectId) {
    return (
      <Box sx={{ p: 3, maxWidth: DASHBOARD_CONTENT_MAX_WIDTH, mx: 'auto' }}>
        <Alert severity="warning">
          No hay proyecto seleccionado. Si eres manager, usa &quot;Cambiar proyecto&quot;. Si acabas
          de iniciar sesión, cierra sesión y vuelve a entrar.
        </Alert>
      </Box>
    );
  }

  if (sharedLoading && sharedSprints.length === 0) {
    return <PageLoadingSpinner />;
  }

  const loadErrorMessage = dataError
    ? resolveLoadErrorMessage(
        dataError,
        dataError?.message
          ? `Error al cargar datos: ${dataError.message}`
          : 'No se pudieron cargar los datos.',
      )
    : null;

  const shouldShowEmptyDashboardView =
    !loadErrorMessage && (allSprints.length === 0 || sharedTaskCount === 0);

  if (loadErrorMessage) {
    return (
      <Box sx={{ p: 3, maxWidth: DASHBOARD_CONTENT_MAX_WIDTH, mx: 'auto' }}>
        <Alert severity="error">{loadErrorMessage}</Alert>
      </Box>
    );
  }

  if (shouldShowEmptyDashboardView) {
    return (
      <Box
        sx={{
          maxWidth: DASHBOARD_CONTENT_MAX_WIDTH,
          width: '100%',
          mx: 'auto',
          minHeight: { xs: 'calc(100vh - 160px)', md: 'calc(100vh - 190px)' },
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: isDark ? '#F0F0F0' : SECTION_BRAND_DARK,
            letterSpacing: '-0.5px',
            mb: 3,
            px: 2,
            pt: 3,
          }}
        >
          Dashboard
        </Typography>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: 2,
            pb: 3,
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
              textAlign: 'center',
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', mb: 1 }}>
              No information to display yet
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto', mb: 3 }}>
              There are no sprints or tasks to visualize in this project. Create a sprint and add
              tasks to view the dashboard.
            </Typography>
            {typeof onNavigateToTasks === 'function' ? (
              <Button
                variant="contained"
                size="large"
                onClick={onNavigateToTasks}
                sx={{
                  bgcolor: ORACLE_RED_ACTION,
                  fontWeight: 700,
                  px: 3,
                  '&:hover': { bgcolor: '#A3321F' },
                }}
              >
                Go to Tasks
              </Button>
            ) : null}
          </Paper>
        </Box>
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
        position: 'relative',
      }}
    >
      {sharedRefreshing ? (
        <LinearProgress
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            mb: 1,
            borderRadius: 1,
            bgcolor: isDark ? '#2A2C32' : '#F0F0F0',
            '& .MuiLinearProgress-bar': {
              bgcolor: ORACLE_RED_ACTION,
            },
          }}
        />
      ) : null}
      <ScrollReveal>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.75, sm: 2 },
            mb: 1.25,
            borderRadius: 3,
            border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
            bgcolor: 'background.paper',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 2,
              mb: 1,
            }}
          >
            <Box sx={{ pr: 1, minWidth: 0, flex: 1 }}>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  color: 'text.primary',
                  lineHeight: 1.2,
                  fontSize: { xs: '1.4rem', sm: '1.65rem', md: '1.85rem' },
                }}
              >
                Dashboard – {projectName}
              </Typography>
              {sprintDateLabel ? (
                <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
                  {compareMode ? (
                    <>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>
                        Sprint dates:{' '}
                      </Box>
                      <Box component="span" sx={{ color: isDark ? '#E0E0E0' : '#424242' }}>
                        {sprintDateLabel}
                      </Box>
                    </>
                  ) : (
                    <>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>
                        Sprint Date:{' '}
                      </Box>
                      {primarySprint?.name ? (
                        <Box
                          component="span"
                          sx={{ color: isDark ? '#9A9A9A' : '#666', fontWeight: 700 }}
                        >
                          {primarySprint.name}
                        </Box>
                      ) : null}
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>
                        {primarySprint?.name ? ` · ${sprintDateLabel}` : sprintDateLabel}
                      </Box>
                    </>
                  )}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 500 }}>
                  {compareMode ? (
                    <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>
                      Multi-sprint comparison
                    </Box>
                  ) : (
                    <>
                      <Box
                        component="span"
                        sx={{ color: isDark ? '#9A9A9A' : '#666', fontWeight: 700 }}
                      >
                        {primarySprint?.name ?? 'Sprint'}
                      </Box>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>
                        {' '}
                        overview
                      </Box>
                    </>
                  )}
                </Typography>
              )}
            </Box>

            {/* ── Notification bell ── */}
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <IconButton
                size="large"
                onClick={(e) => setBlockedNotifAnchor(e.currentTarget)}
                aria-label={
                  hasUnreadBlockedNotifications
                    ? 'Task block notifications (unread)'
                    : 'Task block notifications'
                }
                aria-haspopup="true"
                aria-expanded={blockedNotifOpen}
                sx={{
                  borderRadius: '10px',
                  ...(blockedNotifOpen
                    ? {
                        bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                        color: BLOCK_NOTIF_RED,
                        border: `1px solid ${isDark ? '#3A3C42' : '#E0E0E0'}`,
                        boxShadow: 'none',
                        '&:hover': { bgcolor: isDark ? '#3A3C42' : '#EEEEEE' },
                      }
                    : showBlockedNotifPulse
                      ? {
                          bgcolor: alpha(BLOCK_NOTIF_RED, isDark ? 0.2 : 0.1),
                          color: BLOCK_NOTIF_RED,
                          '@keyframes notifPulse': {
                            '0%, 100%': { boxShadow: '0 0 0 2px rgba(199,65,38,0.3)' },
                            '50%': { boxShadow: '0 0 0 7px rgba(199,65,38,0.08)' },
                          },
                          animation: 'notifPulse 2.4s ease-in-out infinite',
                          '&:hover': { bgcolor: alpha(BLOCK_NOTIF_RED, isDark ? 0.28 : 0.16) },
                        }
                      : {
                          bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                          '&:hover': { bgcolor: isDark ? '#3A3C42' : '#EEEEEE' },
                        }),
                }}
              >
                <NotificationsIcon
                  sx={{
                    color:
                      hasBlockedNotifications || blockedNotifOpen
                        ? BLOCK_NOTIF_RED
                        : isDark
                          ? '#9A9A9A'
                          : '#616161',
                  }}
                />
              </IconButton>
              {/* Unread badge */}
              {unreadCount > 0 && !blockedNotifOpen && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: '#C74126',
                    border: `2px solid ${isDark ? '#1C1E22' : '#fff'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1,
                    pointerEvents: 'none',
                  }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Box>
              )}
            </Box>

            {/* ── Redesigned Popover ── */}
            <Popover
              open={blockedNotifOpen}
              anchorEl={blockedNotifAnchor}
              onClose={handleBlockedNotifClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              PaperProps={{
                elevation: 8,
                sx: {
                  mt: 1,
                  width: 340,
                  maxWidth: 'calc(100vw - 24px)',
                  borderRadius: '16px',
                  border: `1px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
                  overflow: 'hidden',
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.45)' : '0 8px 32px rgba(0,0,0,0.12)',
                  bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                  backgroundImage: 'none',
                },
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
                  bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LockOutlinedIcon sx={{ fontSize: 16, color: BLOCK_NOTIF_RED }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                    Task block reports
                  </Typography>
                  {hasBlockedNotifications && (
                    <Box
                      sx={{
                        bgcolor: isDark ? '#4A1A1A' : '#FCEBEB',
                        color: isDark ? '#EF9A9A' : '#791F1F',
                        fontSize: 11,
                        fontWeight: 600,
                        px: 0.875,
                        py: '1px',
                        borderRadius: '20px',
                        border: `0.5px solid ${isDark ? '#7F3030' : '#F09595'}`,
                        lineHeight: 1.5,
                      }}
                    >
                      {blockedNotificationItems.length}
                    </Box>
                  )}
                </Box>
                <IconButton
                  size="small"
                  onClick={handleBlockedNotifClose}
                  sx={{
                    color: isDark ? '#9A9A9A' : '#9E9E9E',
                    borderRadius: '8px',
                    '&:hover': {
                      bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                      color: isDark ? '#F0F0F0' : '#1A1A1A',
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {/* Body */}
              <Box
                sx={{ maxHeight: 400, overflowY: 'auto', bgcolor: isDark ? '#1C1E22' : '#FFFFFF' }}
              >
                {!hasBlockedNotifications ? (
                  <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '10px',
                        bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 1.25,
                      }}
                    >
                      <LockOutlinedIcon
                        sx={{ fontSize: 18, color: isDark ? '#5A5A5A' : '#BDBDBD' }}
                      />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13,
                        color: isDark ? '#9A9A9A' : '#9E9E9E',
                        fontWeight: 500,
                        lineHeight: 1.5,
                      }}
                    >
                      No blocked tasks in this selection.
                    </Typography>
                    <Typography
                      sx={{ fontSize: 12, color: isDark ? '#5A5A5A' : '#BDBDBD', mt: 0.5 }}
                    >
                      Blocked assignments will appear here.
                    </Typography>
                  </Box>
                ) : (
                  blockedNotificationItems.map((n, idx) => {
                    const isUnread = !seenBlockedKeySet.has(n.key);
                    const initials = n.developerName
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    const avatarStyle = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];

                    const blockCardSx = {
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? '#8B3A2E' : '#F09595'}`,
                      bgcolor: isDark ? '#2D1C1A' : '#FCEBEB',
                      px: 1.25,
                      py: 1.25,
                      ...(isUnread ? { borderColor: BLOCK_NOTIF_RED, borderWidth: '1.5px' } : {}),
                    };

                    return (
                      <Box
                        key={n.key}
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderBottom: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
                          '&:last-child': { borderBottom: 'none' },
                          cursor: 'default',
                        }}
                      >
                        <Box sx={blockCardSx}>
                          {/* Top row: avatar + name + time */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              mb: 0.75,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box
                                sx={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: '8px',
                                  bgcolor: avatarStyle.bg,
                                  color: avatarStyle.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  flexShrink: 0,
                                }}
                              >
                                {initials}
                              </Box>
                              <Typography
                                sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}
                              >
                                {n.developerName}
                              </Typography>
                            </Box>
                            <Typography
                              sx={{ fontSize: 11, color: isDark ? '#9A9A9A' : '#BDBDBD' }}
                            >
                              {formatBlockedSinceAge(n.blockedSince)}
                            </Typography>
                          </Box>

                          {/* Task ID */}
                          {n.taskId && (
                            <Typography
                              sx={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: isDark ? '#9A9A9A' : '#757575',
                                mb: '2px',
                                letterSpacing: '0.02em',
                              }}
                            >
                              {n.taskId}
                            </Typography>
                          )}

                          {/* Task title */}
                          <Typography
                            sx={{ fontSize: 13, color: 'text.primary', mb: 0.5, lineHeight: 1.4 }}
                          >
                            {n.taskTitle}
                          </Typography>

                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              flexWrap: 'wrap',
                              mb: 0.5,
                            }}
                          >
                            <LockOutlinedIcon sx={{ fontSize: 14, color: BLOCK_NOTIF_RED }} />
                            <Typography
                              sx={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: BLOCK_NOTIF_RED,
                                letterSpacing: '0.02em',
                              }}
                            >
                              Blocked
                            </Typography>
                            {compareMode && n.sprintLabel ? (
                              <Typography
                                sx={{ fontSize: 11, color: isDark ? '#9A9A9A' : '#757575' }}
                              >
                                · {n.sprintLabel}
                              </Typography>
                            ) : null}
                          </Box>

                          <Typography
                            sx={{
                              fontSize: 12,
                              color: isDark ? '#D4A5A0' : '#5C2E2E',
                              fontStyle: n.blockedReason ? 'italic' : 'normal',
                              lineHeight: 1.45,
                            }}
                          >
                            {n.blockedReason ? `"${n.blockedReason}"` : 'No reason provided.'}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>

              {/* Footer */}
              {hasBlockedNotifications && (
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderTop: `1px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
                    bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: 12, color: isDark ? '#9A9A9A' : '#9E9E9E' }}>
                    {blockedNotificationItems.length} blocked{' '}
                    {blockedNotificationItems.length === 1 ? 'task' : 'tasks'} in current selection
                  </Typography>
                </Box>
              )}
            </Popover>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {compareMode
                ? 'Multi-sprint comparison'
                : primarySprint?.name
                  ? primarySprint.name
                  : 'Project Progress'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon sx={{ fontSize: 18, color: isDark ? '#9A9A9A' : '#757575' }} />
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, color: isDark ? '#E0E0E0' : '#555' }}
              >
                {developerCountForAverages} devs
              </Typography>
            </Box>
          </Box>
        </Paper>
      </ScrollReveal>

      <ScrollReveal delay={0.04}>
        <Card
          sx={{
            borderRadius: 3,
            border: `1px solid ${isDark ? '#2A2C32' : '#EFEFEF'}`,
            mb: 2,
            bgcolor: 'background.paper',
          }}
        >
          <CardContent sx={{ py: 1.25, px: 1.75, '&:last-child': { pb: 1.25 } }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                mb: 0.75,
              }}
            >
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: isDark ? '#E0E0E0' : '#333' }}
              >
                Completion rate
              </Typography>
              <Typography
                variant="h6"
                component="span"
                sx={{ fontWeight: 800, color: completionRateColor, lineHeight: 1 }}
              >
                {heroProgress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={heroProgress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: isDark ? '#2A2C32' : '#F0F0F0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: completionRateColor,
                  borderRadius: 4,
                  transition: 'background-color 0.35s ease',
                },
              }}
            />
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={0.07}>
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
            bgcolor: 'background.paper',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: isDark ? '#9A9A9A' : '#616161',
              fontWeight: 600,
              mb: 1,
              fontSize: '0.8125rem',
            }}
          >
            Select one or more sprints and optionally filter by developer. &quot;All Sprints&quot;
            compares every sprint; choosing a single developer shows tasks and hours charts side by
            side.
          </Typography>
          <Typography
            id="dashboard-sprint-filter-label"
            variant="caption"
            sx={{
              display: 'block',
              mb: 0.75,
              fontWeight: 700,
              fontSize: '0.75rem',
              color: isDark ? '#9A9A9A' : '#616161',
              letterSpacing: '0.02em',
            }}
          ></Typography>
          <Box
            role="group"
            aria-labelledby="dashboard-sprint-filter-label"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: { xs: 0.5, sm: 1.25 },
              rowGap: 0.5,
            }}
          >
            <FormControlLabel
              sx={{
                m: 0,
                mr: { xs: 0.5, sm: 1 },
                flexShrink: 0,
                '& .MuiFormControlLabel-label': {
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: 'text.primary',
                },
              }}
              control={
                <Checkbox
                  checked={allSprintsSelected}
                  indeterminate={someSprintsSelected}
                  onChange={(e) => handleAllSprintsToggle(e.target.checked)}
                  size="small"
                  sx={{
                    py: 0.25,
                    color: isDark ? '#757575' : '#9E9E9E',
                    '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: ORACLE_RED_ACTION },
                  }}
                />
              }
              label="All Sprints"
            />
            <Box
              aria-hidden
              sx={{
                width: '1px',
                height: 22,
                bgcolor: isDark ? '#3A3C42' : '#E0E0E0',
                flexShrink: 0,
                display: { xs: 'none', sm: 'block' },
              }}
            />
            {sortedSprintsForFilter.map((sp, index) => {
              const sprintColor =
                sp.accentColor ?? SPRINT_CHART_COLORS[index % SPRINT_CHART_COLORS.length];
              const idStr = String(sp.id);
              const checked = selectedSprintIds.includes(idStr);
              return (
                <FormControlLabel
                  key={sp.id}
                  sx={{
                    m: 0,
                    flexShrink: 0,
                    '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' },
                  }}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleSprintId(idStr)}
                      size="small"
                      sx={{
                        py: 0.25,
                        color: isDark ? '#757575' : '#9E9E9E',
                        '&.Mui-checked': { color: sprintColor },
                      }}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
                      <Box
                        component="span"
                        sx={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          bgcolor: sprintColor,
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8125rem',
                          color: 'text.primary',
                          lineHeight: 1.2,
                        }}
                      >
                        {getSprintFilterLabel(sp.id)}
                      </Typography>
                    </Box>
                  }
                />
              );
            })}
          </Box>
          <Box
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`,
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Typography
              id="dashboard-developer-filter-label"
              variant="caption"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                color: isDark ? '#9A9A9A' : '#616161',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              Developer
            </Typography>
            <FormControl size="small" sx={{ minWidth: 220, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}>
              <InputLabel id="dashboard-developer-filter-select-label">Filter by developer</InputLabel>
              <Select
                labelId="dashboard-developer-filter-select-label"
                label="Filter by developer"
                value={selectedDeveloperName}
                onChange={(event) => setSelectedDeveloperName(event.target.value)}
                aria-labelledby="dashboard-developer-filter-label"
              >
                <MenuItem value="all">All developers</MenuItem>
                {developerNames.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Paper>
      </ScrollReveal>

      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, overflow: 'visible' }}
      >
        <ScrollReveal delay={0.05}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: compareMode ? 'column' : 'row' },
              alignItems: 'stretch',
              gap: DASHBOARD_BLOCK_GAP,
              width: '100%',
              minWidth: 0,
              mb: 2.5,
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
              <Typography
                component="h2"
                sx={{
                  ...SECTION_TITLE_SX,
                  color: 'text.primary',
                  mb: 0.35,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                Scorecards
              </Typography>
              <Typography
                sx={{
                  ...SECTION_DESC_SX,
                  mb: 1,
                  width: '100%',
                  textAlign: 'left',
                  color: 'text.secondary',
                }}
              >
                Quick totals and averages for the sprint(s) currently selected above.
              </Typography>
              <DashboardTopMetrics
                showSectionHeader={false}
                multiSprint={compareMode}
                scorecardsFourColumn={compareMode}
                totalTasks={selectionMetrics.totalTasks}
                totalCompleted={selectionMetrics.totalCompleted}
                totalAssigned={selectionMetrics.totalAssigned}
                totalHours={selectionMetrics.totalHours}
                avgTasksPerDev={avgTasksPerTeamDev}
                avgHoursPerDev={avgHoursPerTeamDev}
                uniqueDevCount={teamDeveloperCountForAverages}
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
                <Typography
                  component="h2"
                  sx={{
                    ...SECTION_TITLE_SX,
                    color: 'text.primary',
                    mb: 0.35,
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  Project status
                </Typography>
                <Typography
                  sx={{
                    ...SECTION_DESC_SX,
                    mb: 1,
                    width: '100%',
                    textAlign: 'left',
                    color: 'text.secondary',
                  }}
                >
                  Where tasks sit in the workflow for the active sprint.
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: 1.25, sm: 1.5 },
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignSelf: 'stretch',
                    width: '100%',
                    borderRadius: 3,
                    border: `1px solid ${isDark ? '#1A3A5C' : '#E3F2FD'}`,
                    borderLeft: '5px solid #1565C0',
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(21,101,192,0.12) 0%, #1C1E22 50%)'
                      : 'linear-gradient(135deg, rgba(21,101,192,0.07) 0%, #FFFFFF 50%)',
                    boxShadow: isDark
                      ? '0 2px 10px rgba(0,0,0,0.2)'
                      : '0 2px 10px rgba(21,101,192,0.08)',
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
            <Typography
              component="h2"
              sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.35 }}
            >
              Developer performance
            </Typography>
            <Typography sx={{ ...SECTION_DESC_SX, mb: 1, color: 'text.secondary' }}>
              Workload and hours by developer
            </Typography>
          </Box>
        </ScrollReveal>
        <DashboardDeveloperCharts
          developers={selectionMetrics.developers}
          selectedSprints={selectedSprints}
          compareMode={compareMode}
          projectDevelopers={projectDevelopers}
          selectedDeveloperName={selectedDeveloperNameForMetrics}
          allSprintsSelected={allSprintsSelected}
        />

        <ScrollReveal delay={0.05}>
          <Box sx={{ mt: 2.5, mb: 0 }}>
            <Typography
              component="h2"
              sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.35 }}
            >
              Developer productivity breakdown
            </Typography>
            <Typography sx={{ ...SECTION_DESC_SX, mb: 1, color: 'text.secondary' }}>
              Detailed per-developer numbers and sprint columns when comparing.
            </Typography>
          </Box>
        </ScrollReveal>
        <ScrollReveal delay={0.06}>
          <DeveloperTable
            selectedSprints={selectedSprints}
            compareMode={compareMode}
            projectDevelopers={projectDevelopers}
            filterDeveloperName={selectedDeveloperNameForMetrics}
            suppressCardTitle
          />
        </ScrollReveal>
      </Box>
    </Box>
  );
}
