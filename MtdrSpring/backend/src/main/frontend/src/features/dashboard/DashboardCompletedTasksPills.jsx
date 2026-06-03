import React from 'react';
import { Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Completed vs assigned assignments for the current sprint selection.
 *
 * @param {{ accent?: string, completed?: number, assigned?: number, count?: number, compareBySprint?: { id: number, shortLabel: string, completed: number, assigned?: number, accentColor?: string }[], pillTestId?: string }} props
 */
export default function DashboardCompletedTasksPills({
  accent,
  completed,
  assigned = 0,
  count = 0,
  compareBySprint,
  pillTestId = 'dashboard-tasks-completed-pill',
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const defaultAccent = accent ?? '#3949AB';
  const resolvedCompleted =
    completed != null
      ? Math.max(0, Math.round(Number(completed) || 0))
      : compareBySprint?.length > 0
        ? compareBySprint.reduce((sum, b) => sum + (Number(b.completed) || 0), 0)
        : Math.max(0, Math.round(Number(count) || 0));
  const resolvedAssigned =
    assigned > 0
      ? Math.max(0, Math.round(Number(assigned) || 0))
      : compareBySprint?.length > 0
        ? compareBySprint.reduce((sum, b) => sum + (Number(b.assigned) || 0), 0)
        : 0;

  const chipSx = {
    fontWeight: 700,
    fontSize: '0.8125rem',
    height: 30,
    borderColor: defaultAccent,
    color: defaultAccent,
    bgcolor: alpha(defaultAccent, isDark ? 0.15 : 0.08),
  };

  return (
    <Chip
      data-testid={pillTestId}
      size="small"
      label={
        resolvedAssigned > 0
          ? `${resolvedCompleted} / ${resolvedAssigned} completed`
          : `${resolvedCompleted} completed`
      }
      sx={chipSx}
      variant="outlined"
    />
  );
}
