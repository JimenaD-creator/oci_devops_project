/** One line under chart titles — what the reader should take away. */
export const CHART_DESC = {
  compare: {
    workload: undefined,
    hours:
      'Total hours worked and estimated hours per developer, summed across all selected sprints.',
    teamTrend: 'Team productivity score (0–100%) across selected sprints',
    developerTrend: 'Individual productivity score (0–100%) across selected sprints for this developer.',
    devScoreByDeveloper: 'One line per developer with activity in the selected sprints.',
    combo:
      'Total completed tasks (bars) and hours worked (line) per developer across selected sprints.',
  },
  single: {
    workload: 'Completed and pending tasks assigned to each developer in this sprint.',
    hours: 'Hours worked (logged) next to estimated hours from task estimates per developer.',
    combo: 'Side-by-side view of completed tasks (bars) and hours worked (line) per developer.',
  },
};

export const COMPLETED_FILL = '#5C6BC0';
export const HOURS_FILL = '#FB8C00';
export const HOURS_LINE = '#F57C00';
/** Planned / estimated hours — warm tint, legible (not washed gray). */
export const HOURS_ASSIGNED = '#FFCC80';
/** Text for estimated-hours values (muted; not primary orange, not teal). */
export const HOURS_ASSIGNED_LABEL = '#757575';

export const STACK_DONE = '#1565C0';
export const STACK_PENDING = '#64B5F6';

export const GRID = '#E0E0E0';

/** Recharts: bar/line growth when the plot mounts in view. */
export const CHART_BAR_ANIM_MS = 950;
export const CHART_BAR_EASING = 'ease-out';

export const Y_AXIS_HOURS = 'Hours';

/** Team productivity score trend line (compare mode). */
export const PRODUCTIVITY_SCORE_TREND = '#7E57C2';
