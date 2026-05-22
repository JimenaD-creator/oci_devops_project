import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PageLoadingSpinner from '../../components/common/PageLoadingSpinner';
import TaskTable from '../tasks/TaskTable';
import { TaskDetailDialog } from '../tasks/TaskDetailDialog';
import DeveloperMetricCards from './DeveloperMetricCards';
import { filterUserTasksForUser } from './developerTaskFilters';
import { resolveUserTaskUserId, taskSprintId, userTaskWorkedHours } from '../dashboard/dashboardSprintData';
import {
  buildSprintTaskTableRows,
  filterTasksForUser,
} from '../tasks/sprintTaskTableRows';
import {
  isUserTaskAssigneeComplete,
  pageFormFieldOutline,
  userTaskRowTaskId,
} from '../tasks/utils/taskUtils';
import { ORACLE_RED, pageEase } from '../tasks/constants/taskConstants';
import {
  pickDefaultSelectedSprint,
  resolveActiveProjectIdNum,
  sortSprintsForDisplay,
  sortTasksForSprintTable,
} from '../sprints/utils/sprintUtils';
import { fetchSprintsProjectDevelopers, fetchSprintsTasksAndAssignments } from '../sprints/sprintsPageApi';

export default function MyTasksPage({ projectId, currentUser }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const currentUserId = Number(currentUser?.id);

  const effectiveProjectIdNum = resolveActiveProjectIdNum(projectId);
  const [sprints, setSprints] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [userTasks, setUserTasks] = useState([]);
  const [projectDevelopers, setProjectDevelopers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedSprint, setSelectedSprint] = useState(null);
  const [taskForDetail, setTaskForDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { sprintsList, tasksList, userTasksList } =
        await fetchSprintsTasksAndAssignments(projectId);
      const sorted = sortSprintsForDisplay(
        Array.isArray(sprintsList) ? sprintsList : [],
        Array.isArray(tasksList) ? tasksList : [],
      );
      setSprints(sorted);
      setTasks(Array.isArray(tasksList) ? tasksList : []);
      setUserTasks(Array.isArray(userTasksList) ? userTasksList : []);
    } catch {
      setSprints([]);
      setTasks([]);
      setUserTasks([]);
      setLoadError('Could not load your tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  useEffect(() => {
    if (selectedSprint != null || !sprints.length) return;
    const picked = pickDefaultSelectedSprint(sprints);
    if (picked) setSelectedSprint(picked);
  }, [sprints, selectedSprint]);

  const scopedUserTasks = useMemo(
    () => filterUserTasksForUser(userTasks, currentUserId),
    [userTasks, currentUserId],
  );

  const mySprintTasks = useMemo(() => {
    if (selectedSprint?.id == null) return [];
    const sprintId = Number(selectedSprint.id);
    const inSprint = tasks.filter((t) => taskSprintId(t) === sprintId);
    const mine = filterTasksForUser(inSprint, scopedUserTasks, currentUserId);
    return sortTasksForSprintTable(mine);
  }, [tasks, selectedSprint, scopedUserTasks, currentUserId]);

  const tableRows = useMemo(
    () =>
      buildSprintTaskTableRows(mySprintTasks, scopedUserTasks, projectDevelopers, {
        assignmentFilter: (assignments) =>
          assignments.filter((ut) => resolveUserTaskUserId(ut) === currentUserId),
      }),
    [mySprintTasks, scopedUserTasks, projectDevelopers, currentUserId],
  );

  const mySprintStats = useMemo(() => {
    if (selectedSprint?.id == null) {
      return { assigned: 0, completed: 0, hours: 0, estimated: 0, completionRate: 0 };
    }
    const sprintTaskIds = new Set(mySprintTasks.map((t) => Number(t.id)));
    const assignedIds = new Set();
    const completedIds = new Set();
    let hours = 0;
    scopedUserTasks.forEach((ut) => {
      const tid = userTaskRowTaskId(ut);
      if (tid == null || !sprintTaskIds.has(tid)) return;
      assignedIds.add(tid);
      hours += userTaskWorkedHours(ut);
      if (isUserTaskAssigneeComplete(ut)) completedIds.add(tid);
    });
    const assigned = assignedIds.size;
    const completed = completedIds.size;
    const estimated = mySprintTasks.reduce(
      (sum, t) => sum + (Number(t.assignedHours ?? t.assigned_hours) || 0),
      0,
    );
    return {
      assigned,
      completed,
      hours,
      estimated,
      completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
    };
  }, [selectedSprint, mySprintTasks, scopedUserTasks]);

  const metricCards = useMemo(() => {
    const { assigned, completed, hours, estimated, completionRate } = mySprintStats;
    const hoursRatio = estimated > 0 ? Math.round((hours / estimated) * 100) : 0;

    return [
      {
        label: 'Tasks assigned',
        value: assigned,
        subtitle: selectedSprint ? `Sprint ${selectedSprint.id}` : 'Select a sprint',
        progress: assigned > 0 ? 100 : 0,
        accent: '#1565C0',
      },
      {
        label: 'Tasks completed',
        value: completed,
        subtitle: assigned > 0 ? `${completed} of ${assigned} tasks` : 'Marked complete',
        progress: completionRate,
        accent: '#FB8C00',
      },
      {
        label: 'Completion rate',
        value: `${completionRate}%`,
        subtitle: 'Completed / assigned',
        progress: completionRate,
        accent: '#8E24AA',
      },
      {
        label: 'Hours worked',
        value: `${hours.toFixed(1)}h`,
        subtitle:
          estimated > 0 ? `${hours.toFixed(1)}h of ${estimated.toFixed(1)}h estimated` : 'Logged on your assignments',
        progress: estimated > 0 ? Math.min(100, hoursRatio) : hours > 0 ? 100 : 0,
        accent: '#3949AB',
      },
    ];
  }, [mySprintStats, selectedSprint]);

  const borderColor = isDark ? '#2A2C32' : '#ECECEC';
  const cardBg = theme.palette.background.paper;

  if (loading) {
    return <PageLoadingSpinner color={ORACLE_RED} />;
  }

  return (
    <Box sx={{ maxWidth: 1200, width: '100%' }}>
      {loadError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      ) : null}

      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.34, ease: pageEase }}
        elevation={0}
        sx={{ p: 2, mb: 2, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.5px' }}
            >
              My Tasks
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
              Your assignments for the selected sprint.
            </Typography>
          </Box>
          <FormControl
            size="small"
            sx={{ minWidth: { xs: '100%', sm: 200 }, ...pageFormFieldOutline() }}
          >
            <InputLabel id="my-tasks-sprint-label">Sprint</InputLabel>
            <Select
              labelId="my-tasks-sprint-label"
              value={selectedSprint?.id != null ? String(selectedSprint.id) : ''}
              label="Sprint"
              onChange={(e) => {
                const id = Number(e.target.value);
                const sp = sprints.find((s) => Number(s.id) === id);
                setSelectedSprint(sp || null);
              }}
              disabled={!sprints.length}
            >
              {sprints.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  Sprint {s.id}
                  {s.startDate && s.endDate
                    ? ` · ${new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      <DeveloperMetricCards metrics={metricCards} />

      <Paper
        component={motion.div}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.34, ease: pageEase }}
        elevation={0}
        sx={{ p: 2, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary', mb: 1.5 }}>
          Tasks
        </Typography>
        {selectedSprint == null ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
            Select a sprint to view your tasks.
          </Typography>
        ) : tableRows.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
            You have no assigned tasks in this sprint.
          </Typography>
        ) : (
          <TaskTable
            items={tableRows}
            variant="manager"
            onRowClick={(row) => {
              const task = mySprintTasks.find((t) => Number(t.id) === Number(row.id));
              if (task) {
                setTaskForDetail(task);
                setDetailOpen(true);
              }
            }}
            scrollMaxHeight={480}
          />
        )}
      </Paper>

      <TaskDetailDialog
        open={detailOpen}
        initialTask={taskForDetail}
        initialUserTasks={userTasks}
        sprints={sprints}
        projectDevelopers={projectDevelopers}
        activeProjectId={effectiveProjectIdNum}
        onClose={() => {
          setDetailOpen(false);
          setTaskForDetail(null);
        }}
        onSaved={(updated) => {
          setTasks((prev) =>
            prev.map((t) => (Number(t.id) === Number(updated.id) ? { ...t, ...updated } : t)),
          );
          setDetailOpen(false);
          setTaskForDetail(null);
          loadData();
        }}
      />
    </Box>
  );
}
