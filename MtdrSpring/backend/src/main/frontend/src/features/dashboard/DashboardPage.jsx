import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Card,
  CardContent,
  IconButton,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Popover,
  Stack,
  Button,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import GroupIcon from '@mui/icons-material/Group';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TaskStatusDistributionChart from './TaskStatusDistributionChart';
import DashboardTopMetrics from './DashboardTopMetrics';
import DashboardCompletedTasksPills from './DashboardCompletedTasksPills';
import DashboardDeveloperCharts from './DashboardDeveloperCharts';
import DashboardBlockedTasksPanel from './DashboardBlockedTasksPanel';
import DeveloperTable from '../kpis/DeveloperTable';
import {
  fetchDashboardSprints,
  mergeTaskStatusAcrossSprints,
  aggregateSelectionMetrics,
  sprintDbIdSortKey,
  buildBlockedTaskNotificationItems,
  formatBlockedSinceAge,
  SPRINT_CHART_COLORS,
} from './dashboardSprintData';
import {
  DASHBOARD_CONTENT_MAX_WIDTH,
  DASHBOARD_PRIMARY_ACCENT,
} from './constants/dashboardConstants';
import { SECTION_TITLE_SX, SECTION_DESC_SX } from './dashboardTypography';
import ScrollReveal from './ScrollReveal';
import { pickDefaultSelectedSprint } from '../sprints/utils/sprintUtils';
import { ORACLE_RED_ACTION } from '../sprints/constants/sprintConstants';
import { fetchProjectById } from './projectApi';

// ── Avatar palette for blocked notification items ────────────────────────────
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

export default function DashboardPage({ projectId: propProjectId }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const AVATAR_PALETTE = isDark ? AVATAR_PALETTE_DARK : AVATAR_PALETTE_LIGHT;

  const [allSprints, setAllSprints] = useState([]);
  const [sprintsLoading, setSprintsLoading] = useState(true);
  const [selectedSprintIds, setSelectedSprintIds] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [blockedNotifAnchor, setBlockedNotifAnchor] = useState(null);
  const [seenBlockedKeysCsv, setSeenBlockedKeysCsv] = useState('');

  const projectId = propProjectId || localStorage.getItem('currentProjectId');

  const loadProjectInfo = useCallback(async () => {
    if (!projectId) return;
    try {
      const project = await fetchProjectById(projectId);
      if (project) setCurrentProject(project);
    } catch (err) {
      console.error('Error loading project:', err);
    }
  }, [projectId]);

  const handleRefresh = useCallback(() => {
    setSprintsLoading(true);
    fetchDashboardSprints(projectId)
      .then((sprints) => {
        setAllSprints(sprints);
        setSelectedSprintIds((prev) => {
          if (sprints.length > 0 && prev.length === 0) {
            const picked = pickDefaultSelectedSprint(sprints);
            if (picked?.id != null) return [Number(picked.id)];
          }
          return prev;
        });
      })
      .finally(() => setSprintsLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    loadProjectInfo();
    handleRefresh();
  }, [projectId, loadProjectInfo, handleRefresh]);

  useEffect(() => {
    setSeenBlockedKeysCsv('');
  }, [projectId]);
  useEffect(() => {
    if (!projectId) setSprintsLoading(false);
  }, [projectId]);

  const normalizedSelectedIds = useMemo(() => {
    if (!allSprints.length) return [];
    const valid = new Set(allSprints.map((s) => Number(s.id)));
    return [...new Set(selectedSprintIds.map(Number).filter(Number.isFinite))]
      .filter((id) => valid.has(id))
      .sort((a, b) => a - b);
  }, [selectedSprintIds, allSprints]);

  useEffect(() => {
    if (!allSprints.length || sprintsLoading) return;
    if (normalizedSelectedIds.length === 0) {
      const picked = pickDefaultSelectedSprint(allSprints);
      if (picked?.id != null) setSelectedSprintIds([Number(picked.id)]);
      return;
    }
    const raw = selectedSprintIds.map(Number).filter(Number.isFinite);
    const uniqueRaw = [...new Set(raw)];
    const normSorted = [...normalizedSelectedIds].sort((a, b) => a - b).join(',');
    const uniqSorted = uniqueRaw
      .slice()
      .sort((a, b) => a - b)
      .join(',');
    const hasDuplicateEntries = raw.length !== uniqueRaw.length;
    const needsPrune = uniqSorted !== normSorted;
    if (hasDuplicateEntries || needsPrune) setSelectedSprintIds(normalizedSelectedIds);
  }, [allSprints, sprintsLoading, selectedSprintIds, normalizedSelectedIds]);

  const selectedSprints = useMemo(() => {
    const byId = new Map(allSprints.map((s) => [Number(s.id), s]));
    return normalizedSelectedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => sprintDbIdSortKey(a) - sprintDbIdSortKey(b));
  }, [normalizedSelectedIds, allSprints]);

  const compareMode = normalizedSelectedIds.length > 1;
  const primarySprint = selectedSprints[0];

  const { taskStatusDistribution, taskStatusTotal } = useMemo(
    () => mergeTaskStatusAcrossSprints(selectedSprints),
    [selectedSprints],
  );
  const selectionMetrics = useMemo(
    () => aggregateSelectionMetrics(selectedSprints),
    [selectedSprints],
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
    if (chronological.length < 2) return { avgTasksTrend: null, avgHoursTrend: null, series };
    const current = chronological[chronological.length - 1];
    const previous = chronological[chronological.length - 2];
    return {
      avgTasksTrend: { delta: avgTasks(current) - avgTasks(previous) },
      avgHoursTrend: { delta: avgHours(current) - avgHours(previous) },
      series,
    };
  }, [selectedSprints]);

  const heroProgress = useMemo(() => {
    if (!taskStatusTotal) return 0;
    const done = taskStatusDistribution.find((r) => r.key === 'DONE')?.count ?? 0;
    return Math.round((100 * done) / taskStatusTotal);
  }, [taskStatusDistribution, taskStatusTotal]);

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

  const teamDeveloperCount = useMemo(
    () => new Set(selectedSprints.flatMap((s) => (s.developers || []).map((d) => d.name))).size,
    [selectedSprints],
  );

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

  const headerTasksCompleted = useMemo(() => {
    if (!selectedSprints?.length) return null;
    if (compareMode) {
      return (
        <DashboardCompletedTasksPills
          pillTestId="dashboard-header-tasks-completed"
          accent={selectedSprints[0]?.accentColor ?? DASHBOARD_PRIMARY_ACCENT}
          compareBySprint={selectedSprints.map((sp) => ({
            id: Number(sp.id),
            shortLabel: sp.shortLabel ?? `S${sp.id}`,
            completed: Number(sp.totalCompleted) || 0,
            accentColor: sp.accentColor,
          }))}
        />
      );
    }
    if (!primarySprint) return null;
    return (
      <DashboardCompletedTasksPills
        pillTestId="dashboard-header-tasks-completed"
        accent={primarySprint.accentColor ?? DASHBOARD_PRIMARY_ACCENT}
        count={Number(primarySprint.totalCompleted) || 0}
      />
    );
  }, [selectedSprints, compareMode, primarySprint]);

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
        <CircularProgress sx={{ color: ORACLE_RED_ACTION }} />
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
        <Paper elevation={0} sx={{ p: 2.5, mb: 1.5, borderRadius: 3, border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`, bgcolor: 'background.paper' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 1.5 }}>
            <Box sx={{ pr: 1, minWidth: 0, flex: 1 }}>
              <Typography variant="h3" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.2, fontSize: { xs: '1.65rem', sm: '2rem', md: '2.25rem' } }}>
                Dashboard – {projectName}
              </Typography>
              {sprintDateLabel ? (
                <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
                  {compareMode ? (
                    <>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>Sprint dates: </Box>
                      <Box component="span" sx={{ color: isDark ? '#E0E0E0' : '#424242' }}>{sprintDateLabel}</Box>
                    </>
                  ) : (
                    <>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>Sprint Date: </Box>
                      {primarySprint?.name ? (
                        <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666', fontWeight: 700 }}>{primarySprint.name}</Box>
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
                    <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}>Multi-sprint comparison</Box>
                  ) : (
                    <>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666', fontWeight: 700 }}>{primarySprint?.name ?? 'Sprint'}</Box>
                      <Box component="span" sx={{ color: isDark ? '#9A9A9A' : '#666' }}> overview</Box>
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
                  ...(showBlockedNotifPulse
                    ? {
                        bgcolor: alpha('#C74126', isDark ? 0.2 : 0.1),
                        color: '#C74126',
                        '@keyframes notifPulse': {
                          '0%, 100%': { boxShadow: '0 0 0 2px rgba(199,65,38,0.3)' },
                          '50%': { boxShadow: '0 0 0 7px rgba(199,65,38,0.08)' },
                        },
                        animation: 'notifPulse 2.4s ease-in-out infinite',
                        '&:hover': { bgcolor: alpha('#C74126', isDark ? 0.28 : 0.16) },
                      }
                    : {
                        bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
                        '&:hover': { bgcolor: isDark ? '#3A3C42' : '#EEEEEE' },
                      }),
                }}
              >
                <NotificationsIcon sx={{ color: hasBlockedNotifications ? '#C74126' : (isDark ? '#9A9A9A' : '#616161') }} />
              </IconButton>
              {/* Unread badge */}
              {unreadCount > 0 && !blockedNotifOpen && (
                <Box sx={{
                  position: 'absolute', top: 4, right: 4,
                  width: 16, height: 16, borderRadius: '50%',
                  bgcolor: '#C74126', border: `2px solid ${isDark ? '#1C1E22' : '#fff'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: '#fff', lineHeight: 1, pointerEvents: 'none',
                }}>
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
                elevation: 0,
                sx: {
                  mt: 1,
                  width: 340,
                  maxWidth: 'calc(100vw - 24px)',
                  borderRadius: '16px',
                  border: `0.5px solid ${isDark ? '#2A2C32' : '#E0E0E0'}`,
                  overflow: 'hidden',
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(0,0,0,0.10)',
                  bgcolor: 'background.paper',
                },
              }}
            >
              {/* Header */}
              <Box sx={{
                px: 2, py: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `0.5px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
                bgcolor: isDark ? '#1C1E22' : '#FFFFFF',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LockOutlinedIcon sx={{ fontSize: 16, color: '#C74126' }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                    Task block reports
                  </Typography>
                  {hasBlockedNotifications && (
                    <Box sx={{
                      bgcolor: isDark ? '#4A1A1A' : '#FCEBEB', 
                      color: isDark ? '#EF9A9A' : '#791F1F',
                      fontSize: 11, fontWeight: 600,
                      px: 0.875, py: '1px',
                      borderRadius: '20px', border: `0.5px solid ${isDark ? '#7F3030' : '#F09595'}`, 
                      lineHeight: 1.5,
                    }}>
                      {blockedNotificationItems.length}
                    </Box>
                  )}
                </Box>
                <IconButton size="small" onClick={handleBlockedNotifClose}
                  sx={{ color: isDark ? '#9A9A9A' : '#9E9E9E', borderRadius: '8px', '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5', color: isDark ? '#F0F0F0' : '#1A1A1A' } }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {/* Body */}
              <Box sx={{ maxHeight: 400, overflowY: 'auto', bgcolor: isDark ? '#16181C' : '#FAFAFA' }}>
                {!hasBlockedNotifications ? (
                  <Box sx={{ px: 2.5, py: 3, textAlign: 'center' }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: isDark ? '#2A2C32' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.25 }}>
                      <LockOutlinedIcon sx={{ fontSize: 18, color: isDark ? '#5A5A5A' : '#BDBDBD' }} />
                    </Box>
                    <Typography sx={{ fontSize: 13, color: isDark ? '#9A9A9A' : '#9E9E9E', fontWeight: 500, lineHeight: 1.5 }}>
                      No blocked tasks in this selection.
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: isDark ? '#5A5A5A' : '#BDBDBD', mt: 0.5 }}>
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

                    return (
                      <Box
                        key={n.key}
                        sx={{
                          px: 2, py: 1.5,
                          bgcolor: isUnread ? (isDark ? '#1C1E22' : '#FFFFFF') : 'transparent',
                          borderBottom: `0.5px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`,
                          borderLeft: isUnread ? '3px solid #C74126' : '3px solid transparent',
                          transition: 'background 0.15s',
                          '&:hover': { bgcolor: isDark ? '#2A2C32' : '#F5F5F5' },
                          '&:last-child': { borderBottom: 'none' },
                          cursor: 'default',
                        }}
                      >
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
                            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                              {n.developerName}
                            </Typography>
                          </Box>
                          <Typography sx={{ fontSize: 11, color: isDark ? '#9A9A9A' : '#BDBDBD' }}>
                            {formatBlockedSinceAge(n.blockedSince)}
                          </Typography>
                        </Box>

                        {/* Task ID */}
                        {n.taskId && (
                          <Typography
                            sx={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#C74126',
                              mb: '2px',
                              letterSpacing: '0.02em',
                            }}
                          >
                            {n.taskId}
                          </Typography>
                        )}

                        {/* Task title */}
                        <Typography sx={{ fontSize: 13, color: 'text.primary', mb: 0.875, lineHeight: 1.4 }}>
                          {n.taskTitle}
                        </Typography>

                        {/* Block card */}
                        <Box sx={{ borderRadius: '10px', overflow: 'hidden', border: `0.5px solid ${isDark ? '#7F3030' : '#F09595'}` }}>
                          {/* Card header — solid red */}
                          <Box
                            sx={{
                              bgcolor: '#C74126',
                              px: 1.25,
                              py: 0.75,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <LockOutlinedIcon
                                sx={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}
                              />
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: 'rgba(255,255,255,0.95)',
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                }}
                              >
                                Blocked
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {compareMode && n.sprintLabel && (
                                <Box
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: 'rgba(255,255,255,0.8)',
                                    bgcolor: 'rgba(0,0,0,0.18)',
                                    px: 0.875,
                                    py: '1px',
                                    borderRadius: '20px',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {n.sprintLabel}
                                </Box>
                              )}
                              <Typography
                                sx={{
                                  fontSize: 11,
                                  color: 'rgba(255,255,255,0.75)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.4,
                                }}
                              >
                                <LockOutlinedIcon sx={{ fontSize: 11 }} />
                                {formatBlockedSinceAge(n.blockedSince)}
                              </Typography>
                            </Box>
                          </Box>
                          {/* Card body — light red */}
                          <Box sx={{ bgcolor: isDark ? '#4A1A1A' : '#FCEBEB', px: 1.25, py: 1 }}>
                            {n.blockedReason ? (
                              <Typography sx={{ fontSize: 12, color: isDark ? '#EF9A9A' : '#501313', fontStyle: 'italic', lineHeight: 1.45 }}>
                                "{n.blockedReason}"
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: 12, color: isDark ? '#EF9A9A' : '#791F1F', lineHeight: 1.45 }}>
                                No reason provided.
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    );
                  })
                )}
              </Box>

              {/* Footer */}
              {hasBlockedNotifications && (
                <Box sx={{ px: 2, py: 1.25, borderTop: `0.5px solid ${isDark ? '#2A2C32' : '#F0F0F0'}`, bgcolor: isDark ? '#1C1E22' : '#FFFFFF', display: 'flex', justifyContent: 'center' }}>
                  <Typography sx={{ fontSize: 12, color: isDark ? '#9A9A9A' : '#9E9E9E' }}>
                    {blockedNotificationItems.length} blocked {blockedNotificationItems.length === 1 ? 'task' : 'tasks'} in current selection
                  </Typography>
                </Box>
              )}
            </Popover>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {compareMode ? 'Multi-sprint comparison' : primarySprint?.name ? primarySprint.name : 'Project Progress'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupIcon sx={{ fontSize: 18, color: isDark ? '#9A9A9A' : '#757575' }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: isDark ? '#E0E0E0' : '#555' }}>
                {teamDeveloperCount} devs
              </Typography>
            </Box>
            {!compareMode && headerTasksCompleted}
          </Box>
          {compareMode && headerTasksCompleted ? (
            <Box sx={{ mt: 1.25, width: '100%' }}>{headerTasksCompleted}</Box>
          ) : null}
        </Paper>
      </ScrollReveal>

      <ScrollReveal delay={0.04}>
        <Card sx={{ borderRadius: 3, border: `1px solid ${isDark ? '#2A2C32' : '#EFEFEF'}`, mb: 2.5, bgcolor: 'background.paper' }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? '#E0E0E0' : '#333' }}>Completion rate</Typography>
              <Typography variant="h6" component="span" sx={{ fontWeight: 800, color: DASHBOARD_PRIMARY_ACCENT, lineHeight: 1 }}>
                {heroProgress}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={heroProgress}
              sx={{ height: 8, borderRadius: 4, bgcolor: isDark ? '#2A2C32' : '#F0F0F0', '& .MuiLinearProgress-bar': { bgcolor: DASHBOARD_PRIMARY_ACCENT } }} />
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={0.07}>
        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: `1px solid ${isDark ? '#2A2C32' : '#ECECEC'}`, bgcolor: 'background.paper' }}>
          <Typography variant="body2" sx={{ color: isDark ? '#9A9A9A' : '#616161', fontWeight: 600, mb: 1.25 }}>
            Select one or more sprints below to filter the dashboard. Check additional boxes to compare sprints side by side.
          </Typography>
          <FormGroup row sx={{ gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
            {allSprints.map((sp) => {
              const sprintColor = sp.accentColor ?? SPRINT_CHART_COLORS[0];
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
                      <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: sprintColor, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{sp.name}</Typography>
                    </Box>
                  }
                />
              );
            })}
          </FormGroup>
        </Paper>
      </ScrollReveal>

      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, overflow: 'visible' }}
      >
        <ScrollReveal delay={0.05}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: compareMode ? 'column' : 'row' }, alignItems: 'stretch', gap: { xs: 3, md: 3 }, width: '100%', minWidth: 0, mb: 4 }}>
            <Box sx={{ flex: { md: compareMode ? 'none' : '1 1 0' }, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.5, textAlign: 'left', width: '100%' }}>Scorecards</Typography>
              <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, width: '100%', textAlign: 'left', color: 'text.secondary' }}>Quick totals and averages for the sprint(s) currently selected above.</Typography>
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
              <Box sx={{ flex: { md: '1 1 0' }, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: { xs: '100%', md: 'auto' } }}>
                <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.5, textAlign: 'left', width: '100%' }}>Project status</Typography>
                <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, width: '100%', textAlign: 'left', color: 'text.secondary' }}>Where tasks sit in the workflow for the active sprint.</Typography>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.25 }, flex: 1, display: 'flex', flexDirection: 'column', minHeight: { xs: 260, md: 0 }, width: '100%', borderRadius: 3, border: `1px solid ${isDark ? '#1A3A5C' : '#E3F2FD'}`, borderLeft: '5px solid #1565C0', background: isDark ? 'linear-gradient(135deg, rgba(21,101,192,0.12) 0%, #1C1E22 50%)' : 'linear-gradient(135deg, rgba(21,101,192,0.07) 0%, #FFFFFF 50%)', boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.2)' : '0 2px 10px rgba(21,101,192,0.08)', boxSizing: 'border-box' }}>
                  <TaskStatusDistributionChart distribution={taskStatusDistribution} total={taskStatusTotal} embedded caption="Tasks in each workflow stage for this sprint." />
                </Paper>
              </Box>
            ) : null}
          </Box>
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          <DashboardBlockedTasksPanel selectedSprints={selectedSprints} />
        </ScrollReveal>

        <ScrollReveal delay={0.06}>
          <Box sx={{ mb: 0 }}>
            <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.5 }}>Developer performance</Typography>
            <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, color: 'text.secondary' }}>Charts for workload, hours, and productivity by developer.</Typography>
          </Box>
        </ScrollReveal>
        <DashboardDeveloperCharts
          developers={selectionMetrics.developers}
          selectedSprints={selectedSprints}
          compareMode={compareMode}
        />

        <ScrollReveal delay={0.05}>
          <Box sx={{ mt: 4, mb: 0 }}>
            <Typography component="h2" sx={{ ...SECTION_TITLE_SX, color: 'text.primary', mb: 0.5 }}>Developer productivity breakdown</Typography>
            <Typography sx={{ ...SECTION_DESC_SX, mb: 1.5, color: 'text.secondary' }}>Detailed per-developer numbers and sprint columns when comparing.</Typography>
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
