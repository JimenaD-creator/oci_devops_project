import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { AlertTriangle } from 'lucide-react';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import { fetchMyBlockers, resolveMyBlocker } from './developerBlockersApi';
import { ORACLE_RED, pageEase } from '../tasks/constants/taskConstants';
import { fetchSprintsProjectDevelopers } from '../sprints/sprintsPageApi';
import { SPRINT_CHART_COLORS } from '../dashboard/dashboardSprintData';
import {
  buildSprintNumberMap,
  formatSprintLabel,
  resolveActiveProjectIdNum,
} from '../sprints/utils/sprintUtils';
import DeveloperEmptyState from './DeveloperEmptyState';

function formatReportedDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isRowResolved(row) {
  return row?.resolved === true || String(row?.status ?? '').toUpperCase() === 'RESOLVED';
}

function buildSprintAccentMap(sprints) {
  const sorted = [...(sprints || [])].sort((a, b) => Number(a.id) - Number(b.id));
  const map = new Map();
  sorted.forEach((s, i) => {
    if (s?.id == null) return;
    map.set(
      Number(s.id),
      s.accentColor ?? SPRINT_CHART_COLORS[i % SPRINT_CHART_COLORS.length],
    );
  });
  return map;
}

function sprintPillSx(accent, isDark) {
  const base = {
    fontWeight: 700,
    fontSize: '0.72rem',
    height: 22,
  };
  if (!accent) {
    return {
      ...base,
      bgcolor: isDark ? '#2A2C32' : '#F5F5F5',
      color: isDark ? '#9A9A9A' : '#757575',
    };
  }
  return {
    ...base,
    borderColor: accent,
    color: accent,
    bgcolor: alpha(accent, isDark ? 0.15 : 0.08),
  };
}

export default function MyBlockersPage({ projectId, currentUser }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { sprints: sharedSprints, getRawBundle, invalidateAndRefresh } = useProjectData();

  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);
  const userId = Number(currentUser?.id);

  const [rows, setRows] = useState([]);
  const [rawTasks, setRawTasks] = useState([]);
  const [rawUserTasks, setRawUserTasks] = useState([]);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailTask, setDetailTask] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  /** @type {['all' | 'blocked' | 'resolved', React.Dispatch<React.SetStateAction<'all' | 'blocked' | 'resolved'>>]} */
  const [statusFilter, setStatusFilter] = useState('all');
  const [resolvingKey, setResolvingKey] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const projectSprints = useMemo(() => {
    if (!effectiveProjectIdNum || !Array.isArray(sharedSprints)) return [];
    return sharedSprints.filter(
      (s) => String(s.assignedProject?.id) === String(effectiveProjectIdNum),
    );
  }, [sharedSprints, effectiveProjectIdNum]);

  const sprintNumberMap = useMemo(() => buildSprintNumberMap(projectSprints), [projectSprints]);
  const sprintAccentMap = useMemo(() => buildSprintAccentMap(projectSprints), [projectSprints]);

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows;
    return rows.filter((row) =>
      statusFilter === 'resolved' ? isRowResolved(row) : !isRowResolved(row),
    );
  }, [rows, statusFilter]);

  const loadBlockers = useCallback(async () => {
    if (!Number.isFinite(userId) || effectiveProjectIdNum == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyBlockers(userId, effectiveProjectIdNum);
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e?.message || 'Could not load your blocker reports.');
    } finally {
      setLoading(false);
    }
  }, [userId, effectiveProjectIdNum]);

  useEffect(() => {
    loadBlockers();
  }, [loadBlockers]);

  useEffect(() => {
    let cancelled = false;
    if (effectiveProjectIdNum == null) {
      setRawTasks([]);
      setRawUserTasks([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const bundle = await getRawBundle();
        if (cancelled) return;
        setRawTasks(Array.isArray(bundle?.tasks) ? bundle.tasks : []);
        setRawUserTasks(Array.isArray(bundle?.userTasks) ? bundle.userTasks : []);
      } catch {
        if (!cancelled) {
          setRawTasks([]);
          setRawUserTasks([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectIdNum, getRawBundle]);

  useEffect(() => {
    let cancelled = false;
    if (effectiveProjectIdNum == null) {
      setProjectDevelopers([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const data = await fetchSprintsProjectDevelopers(effectiveProjectIdNum);
        if (!cancelled) setProjectDevelopers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setProjectDevelopers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveProjectIdNum]);

  const borderColor = isDark ? '#2A2C32' : '#ECECEC';
  const cardBg = theme.palette.background.paper;
  const headCellSx = {
    fontSize: '0.7rem',
    fontWeight: 800,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    py: 1.35,
    px: 1.5,
    borderBottom: '1px solid rgba(255,255,255,0.24)',
    backgroundColor: ORACLE_RED,
  };

  const openDetailForRow = useCallback(
    (row) => {
      if (row?.taskId == null) return;
      const task = rawTasks.find((t) => Number(t.id) === Number(row.taskId));
      setDetailTask(task ?? { id: row.taskId, title: row.taskTitle ?? `Task #${row.taskId}` });
      setDetailOpen(true);
    },
    [rawTasks],
  );

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailTask(null);
  }, []);

  const handleResolveBlocker = useCallback(
    async (row) => {
      const taskId = row?.taskId;
      if (taskId == null || !Number.isFinite(userId)) return;
      const taskTitle = row.taskTitle || `Task #${taskId}`;
      const ok = window.confirm(
        `Mark "${taskTitle}" as resolved?\n\nThe blocker report will stay in your history. You can keep working on the task.`,
      );
      if (!ok) return;

      const rowKey = `${taskId}-${row.sprintId ?? 'na'}`;
      setResolvingKey(rowKey);
      setActionMessage('');
      setError('');
      try {
        await resolveMyBlocker(userId, taskId);
        await loadBlockers();
        try {
          await invalidateAndRefresh();
          const bundle = await getRawBundle({ forceFresh: true });
          setRawTasks(Array.isArray(bundle?.tasks) ? bundle.tasks : []);
          setRawUserTasks(Array.isArray(bundle?.userTasks) ? bundle.userTasks : []);
        } catch {
          /* list refresh above is enough */
        }
        setActionMessage(`"${taskTitle}" marked as resolved.`);
      } catch (e) {
        setError(e?.message || 'Could not mark blocker as resolved.');
      } finally {
        setResolvingKey(null);
      }
    },
    [userId, loadBlockers, invalidateAndRefresh, getRawBundle],
  );

  if (loading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
  }

  const hasNoSprints = projectSprints.length === 0;
  const showProjectEmpty = hasNoSprints && rows.length === 0;

  if (showProjectEmpty) {
    return (
      <Box sx={{ maxWidth: 1100, width: '100%' }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <DeveloperEmptyState
          pageTitle="My Blockers"
          description="There are no sprints or blocker reports in this project yet. Blockers you report via Telegram will appear here once sprints and assignments exist."
        />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, width: '100%' }}>
      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: pageEase }}
        elevation={0}
        sx={{ p: 2.5, mb: 2.5, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <AlertTriangle size={26} color="#C62828" style={{ flexShrink: 0, marginTop: 2 }} />
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.5px', color: 'text.primary' }}>
              My Blockers
            </Typography>
            <Typography sx={{ color: 'text.secondary', mt: 0.5, maxWidth: '42rem' }}>
              Blocker reports you filed in this project (active and resolved). When you have a list, use the
              filter to show all, blocked only, or resolved only.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {actionMessage ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setActionMessage('')}>
          {actionMessage}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{ borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg, overflow: 'hidden' }}
      >
        {rows.length === 0 ? (
          <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
              No blocker reports yet
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              When you flag an assignment as blocked (only via Telegram) with a reason, it will appear here.
              Resolved reports stay in your history.
            </Typography>
          </Box>
        ) : filteredRows.length === 0 ? (
          <Box sx={{ py: 5, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
              No reports match this filter
            </Typography>
            <ToggleButtonGroup
              value={statusFilter}
              exclusive
              size="small"
              onChange={(_, v) => v != null && setStatusFilter(v)}
              aria-label="Filter blocker status"
              sx={{ justifyContent: 'center' }}
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="blocked">Blocked</ToggleButton>
              <ToggleButton value="resolved">Resolved</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        ) : (
          <TableContainer>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                borderBottom: `1px solid ${borderColor}`,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', fontWeight: 600 }}>
                Showing {filteredRows.length} of {rows.length}
              </Typography>
              <ToggleButtonGroup
                value={statusFilter}
                exclusive
                size="small"
                onChange={(_, v) => v != null && setStatusFilter(v)}
                aria-label="Filter blocker status"
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="blocked">Blocked</ToggleButton>
                <ToggleButton value="resolved">Resolved</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Table size="small" aria-label="My blocker reports">
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Task</TableCell>
                  <TableCell sx={headCellSx}>Sprint</TableCell>
                  <TableCell sx={headCellSx}>Status</TableCell>
                  <TableCell sx={headCellSx}>Reported</TableCell>
                  <TableCell sx={headCellSx}>Reason</TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Action
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map((row) => {
                  const sid = row.sprintId;
                  const sprintLabel =
                    sid != null ? formatSprintLabel(sprintNumberMap, sid) : '—';
                  const sprintAccent = sid != null ? sprintAccentMap.get(Number(sid)) : null;
                  const reason = String(row.blockedReason ?? '').trim();
                  const resolved = isRowResolved(row);
                  const rowKey = `${row.taskId}-${sid ?? 'na'}`;
                  const isResolving = resolvingKey === rowKey;
                  return (
                    <TableRow
                      key={rowKey}
                      hover
                      sx={{
                        '&:last-child td': { borderBottom: 0 },
                        bgcolor: resolved
                          ? isDark
                            ? 'rgba(67,160,71,0.08)'
                            : 'rgba(67,160,71,0.06)'
                          : isDark
                            ? 'rgba(229,57,53,0.10)'
                            : 'rgba(229,57,53,0.07)',
                        '&:hover': {
                          bgcolor: resolved
                            ? isDark
                              ? 'rgba(67,160,71,0.16)'
                              : 'rgba(67,160,71,0.12)'
                            : isDark
                              ? 'rgba(229,57,53,0.18)'
                              : 'rgba(229,57,53,0.14)',
                        },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          color: 'text.primary',
                          maxWidth: 260,
                          cursor: 'pointer',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                        onClick={() => openDetailForRow(row)}
                      >
                        {row.taskTitle || `Task #${row.taskId}`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sprintLabel}
                          size="small"
                          variant={sprintAccent ? 'outlined' : 'filled'}
                          sx={sprintPillSx(sprintAccent, isDark)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resolved ? 'Resolved' : 'Blocked'}
                          size="small"
                          sx={{
                            fontWeight: 700,
                            bgcolor: resolved
                              ? isDark
                                ? 'rgba(67,160,71,0.25)'
                                : 'rgba(67,160,71,0.18)'
                              : isDark
                                ? 'rgba(229,57,53,0.26)'
                                : 'rgba(229,57,53,0.2)',
                            color: resolved
                              ? isDark
                                ? '#A5D6A7'
                                : '#1B5E20'
                              : isDark
                                ? '#FFCDD2'
                                : '#B71C1C',
                            border: `1px solid ${
                              resolved ? 'rgba(67,160,71,0.45)' : 'rgba(229,57,53,0.45)'
                            }`,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.85rem' }}>
                        {formatReportedDate(row.reportedAt)}
                      </TableCell>
                      <TableCell sx={{ color: 'text.primary', fontSize: '0.88rem', lineHeight: 1.5 }}>
                        {reason || (
                          <Typography component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            No reason provided
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {!resolved ? (
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={isResolving}
                            onClick={() => handleResolveBlocker(row)}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              borderColor: isDark ? 'rgba(67,160,71,0.55)' : 'rgba(46,125,50,0.55)',
                              color: isDark ? '#A5D6A7' : '#2E7D32',
                              '&:hover': {
                                borderColor: isDark ? '#81C784' : '#2E7D32',
                                bgcolor: isDark ? 'rgba(67,160,71,0.12)' : 'rgba(67,160,71,0.08)',
                              },
                            }}
                          >
                            {isResolving ? 'Saving…' : 'Mark resolved'}
                          </Button>
                        ) : (
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', fontStyle: 'italic' }}>
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <TaskDetailDialog
        open={detailOpen}
        initialTask={detailTask}
        initialUserTasks={rawUserTasks}
        sprints={projectSprints}
        projectDevelopers={projectDevelopers}
        activeProjectId={effectiveProjectIdNum}
        onClose={closeDetail}
        readOnly
      />
    </Box>
  );
}
