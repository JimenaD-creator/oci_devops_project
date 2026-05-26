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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AlertTriangle } from 'lucide-react';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import { useProjectData } from '../../contexts/ProjectDataContext';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import { fetchMyBlockers } from './developerBlockersApi';
import { ORACLE_RED, pageEase } from '../tasks/constants/taskConstants';
import {
  buildSprintNumberMap,
  formatSprintLabel,
  resolveActiveProjectIdNum,
} from '../sprints/utils/sprintUtils';

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

export default function MyBlockersPage({ projectId, currentUser }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { sprints: sharedSprints } = useProjectData();

  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);
  const userId = Number(currentUser?.id);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailTaskId, setDetailTaskId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const projectSprints = useMemo(() => {
    if (!effectiveProjectIdNum || !Array.isArray(sharedSprints)) return [];
    return sharedSprints.filter(
      (s) => String(s.assignedProject?.id) === String(effectiveProjectIdNum),
    );
  }, [sharedSprints, effectiveProjectIdNum]);

  const sprintNumberMap = useMemo(() => buildSprintNumberMap(projectSprints), [projectSprints]);

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

  const borderColor = isDark ? '#2A2C32' : '#ECECEC';
  const cardBg = theme.palette.background.paper;
  const headCellSx = {
    fontWeight: 700,
    fontSize: '0.8rem',
    color: isDark ? '#9A9A9A' : '#607D8B',
    bgcolor: isDark ? '#1C1E22' : '#F5F5F5',
    borderBottom: `1px solid ${borderColor}`,
  };

  if (loading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
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
              Tasks you have reported as blocked in this project, with the reason and when the report was
              recorded.
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{ borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg, overflow: 'hidden' }}
      >
        {rows.length === 0 ? (
          <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
              No active blocker reports
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
              When you flag an assignment as blocked (web or Telegram), it will appear here until the work
              is completed or unblocked.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small" aria-label="My blocker reports">
              <TableHead>
                <TableRow>
                  <TableCell sx={headCellSx}>Task</TableCell>
                  <TableCell sx={headCellSx}>Sprint</TableCell>
                  <TableCell sx={headCellSx}>Reported</TableCell>
                  <TableCell sx={headCellSx}>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const sid = row.sprintId;
                  const sprintLabel =
                    sid != null ? formatSprintLabel(sprintNumberMap, sid) : '—';
                  const reason = String(row.blockedReason ?? '').trim();
                  return (
                    <TableRow
                      key={`${row.taskId}-${sid}`}
                      hover
                      sx={{
                        '&:last-child td': { borderBottom: 0 },
                        '&:hover': { bgcolor: isDark ? '#25272C' : '#FAFAFA' },
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
                        onClick={() => {
                          if (row.taskId != null) {
                            setDetailTaskId(row.taskId);
                            setDetailOpen(true);
                          }
                        }}
                      >
                        {row.taskTitle || `Task #${row.taskId}`}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={sprintLabel}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            bgcolor: isDark ? '#2A2C32' : '#EEEEEE',
                            color: 'text.primary',
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
        taskId={detailTaskId}
        onClose={() => setDetailOpen(false)}
        initialTab="overview"
      />
    </Box>
  );
}
