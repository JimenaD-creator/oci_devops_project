/** Base URL for API calls (dev proxy vs same-origin in production). */
export const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

/** Primary actions / brand (red, black, gray — not blue). */
export const ORACLE_RED = '#E53935';
export const ORACLE_RED_ACTION = '#C74634';

/** Progress bars & % labels: no red/green in the bar fill (neutral blue/indigo). */
export const PROGRESS_BAR = '#1565C0';
export const PROGRESS_BAR_COMPLETE = '#2E7D32';
export const PROGRESS_TRACK = '#ECEFF1';
export const PROGRESS_LABEL = '#424242';

export const CLASSIFICATION_CHIP_SX = {
  FEATURE: { bgcolor: '#E8F5E9', color: '#2E7D32' },
  BUG: { bgcolor: '#FFEBEE', color: '#C62828' },
  TASK: { bgcolor: '#E8EAF6', color: '#3949AB' },
  USER_STORY: { bgcolor: '#F3E5F5', color: '#6A1B9A' },
};

export const PRIORITY_CHIP_SX = {
  LOW: { bgcolor: '#ECEFF1', color: '#455A64' },
  MEDIUM: { bgcolor: '#FFF8E1', color: '#F57F17' },
  HIGH: { bgcolor: '#FFF3E0', color: '#E65100' },
  CRITICAL: { bgcolor: '#FFEBEE', color: '#B71C1C' },
};

export const STATUS_CHIP_SX = {
  TODO: { bgcolor: '#ECEFF1', color: '#455A64' },
  IN_PROGRESS: { bgcolor: '#E3F2FD', color: '#1565C0' },
  IN_REVIEW: { bgcolor: '#F3E5F5', color: '#6A1B9A' },
  PENDING: { bgcolor: '#FFF1F0', color: '#C62828' },
  DONE: { bgcolor: '#E8F5E9', color: '#2E7D32' },
};

export const STATUS_CONFIG = {
  active: { label: 'In progress', color: '#E3F2FD', textColor: '#1565C0' },
  completed: { label: 'Completed', color: '#E8F5E9', textColor: '#1B5E20' },
  planned: { label: 'Planned', color: '#FFF8E1', textColor: '#F57F17' },
};

export const TASK_STATUS_LABEL = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  IN_REVIEW: 'In review',
  PENDING: 'Pending',
  DONE: 'Done',
};

export const EASE_OUT = [0.25, 0.1, 0.25, 1];

export const sprintsOverviewVariants = {
  page: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: 0.35, staggerChildren: 0.07, delayChildren: 0.04 },
    },
  },
  block: {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: EASE_OUT } },
  },
};
