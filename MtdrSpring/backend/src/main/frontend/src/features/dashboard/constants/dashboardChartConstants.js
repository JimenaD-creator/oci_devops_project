import { alpha } from '@mui/material/styles';

/** One line under chart titles — what the reader should take away. */
export const CHART_DESC = {
  compare: {
    workload:
      'One column per developer, stacked: solid = completed, lighter = pending, one stack per sprint.',
    hours:
      'Per sprint: solid bar = hours worked; lighter bar = estimated hours from task estimates.',
    combo: 'Bars show completed tasks; lines show hours — both broken down by sprint.',
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
/** Planned / estimated hours (lighter bar next to worked). */
export const HOURS_ASSIGNED = alpha(HOURS_FILL, 0.45);

export const STACK_DONE = '#1565C0';
export const STACK_PENDING = '#90CAF9';

export const GRID = '#E0E0E0';

/** Recharts: bar/line growth when the plot mounts in view. */
export const CHART_BAR_ANIM_MS = 950;
export const CHART_BAR_EASING = 'ease-out';

export const Y_AXIS_HOURS = 'Hours';
