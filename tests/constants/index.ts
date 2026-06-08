import { LoginTestCase, Task, User } from '../types';

//  Platform URLs

export const BASE_URL = 'http://163.192.142.68';

export const AUTH_STORAGE = {
  manager: 'playwright/.auth/manager.json',
  developer: 'playwright/.auth/developer.json',
} as const;

export const ROUTES = {
  login: `${BASE_URL}/login`,
  home: `${BASE_URL}/`,
} as const;

// Test users

export const USERS: Record<string, User> = {
  MANAGER: {
    username: '4494467983',
    password: 'hola',
    role: 'manager',
  },
  DEVELOPER: {
    username: '4491234567',
    password: 'pass123',
    role: 'developer',
  },
  INVALID_USER: {
    username: 'user@test.com',
    password: '123lol',
    role: 'developer',
  },
};

/** Parameterized login scenarios for Suite 1 (Authentication). */
export const LOGIN_TEST_CASES: LoginTestCase[] = [
  {
    name: 'invalid credentials',
    user: {
      identifier: USERS.INVALID_USER.username,
      password: USERS.INVALID_USER.password,
    },
    shouldFail: true,
  },
  {
    name: 'valid manager',
    user: {
      identifier: USERS.MANAGER.username,
      password: USERS.MANAGER.password,
    },
    shouldFail: false,
  },
];

/** Developer display name in task assignee dropdown */
export const DEVELOPER_ASSIGNEE = /Jimena/i;

//  Sample tasks for create / edit
export const TASK_STATUSES = {
  TODO: { value: 'TODO', label: 'To Do' },
  IN_PROGRESS: { value: 'IN_PROGRESS', label: 'In Progress' },
  IN_REVIEW: { value: 'IN_REVIEW', label: 'In Review' },
  DONE: { value: 'DONE', label: 'Done' },
  PENDING: { value: 'PENDING', label: 'Pending' },
} as const;

/** API classification values */
export const TASK_CLASSIFICATIONS = {
  FEATURE: { value: 'FEATURE', label: 'Feature' },
  BUG: { value: 'BUG', label: 'Bug' },
  TASK: { value: 'TASK', label: 'Task' },
  USER_STORY: { value: 'USER_STORY', label: 'User Story' },
} as const;

/** API priority values  */
export const TASK_PRIORITIES = {
  LOW: { value: 'LOW', label: 'Low' },
  MEDIUM: { value: 'MEDIUM', label: 'Medium' },
  HIGH: { value: 'HIGH', label: 'High' },
  CRITICAL: { value: 'CRITICAL', label: 'Critical' },
} as const;

export const DEFAULT_TASK_DATES = {
  startDate: '2026-06-01',
  dueDate: '2026-12-31',
} as const;

/** Sample tasks */
export const TEST_TASKS: Task[] = [
  {
    title: 'Implement Login Feature',
    description: 'Create login functionality with JWT authentication',
    status: 'TODO',
    priority: 'HIGH',
    classification: 'FEATURE',
    startDate: DEFAULT_TASK_DATES.startDate,
    dueDate: DEFAULT_TASK_DATES.dueDate,
  },
  {
    title: 'Fix Navigation Bug',
    description: 'Resolve routing issues in the dashboard',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    classification: 'BUG',
    startDate: DEFAULT_TASK_DATES.startDate,
    dueDate: DEFAULT_TASK_DATES.dueDate,
  },
  {
    title: 'Write API Documentation',
    description: 'Update REST API documentation for task endpoints',
    status: 'IN_REVIEW',
    priority: 'LOW',
    classification: 'USER_STORY',
    startDate: DEFAULT_TASK_DATES.startDate,
    dueDate: DEFAULT_TASK_DATES.dueDate,
  },
];

/** Task created by manager in Suite 3 — completed by developer in Suite 4 Kanban test. */
export const DEVELOPER_KANBAN_TASK: Task = {
  title: 'Change status to Done in Kanban Board',
  description: 'Change status to Done in Kanban Board',
  status: 'TODO',
  priority: 'MEDIUM',
  classification: 'TASK',
  startDate: DEFAULT_TASK_DATES.startDate,
  dueDate: DEFAULT_TASK_DATES.dueDate,
};

/** Throwaway task for the delete test*/
export const DELETE_TASK: Task = {
  title: 'Remove after review',
  description: 'Temporary task created only to verify delete',
  status: 'TODO',
  priority: 'LOW',
  classification: 'TASK',
  startDate: DEFAULT_TASK_DATES.startDate,
  dueDate: DEFAULT_TASK_DATES.dueDate,
};

// Selectors

export const SELECTORS = {
  login: {
    usernameInput: '#login-email',
    passwordInput: '#login-password',
    submitButton: 'button.login-signin-btn, button[type="submit"]:has-text("Sign in")',
    errorMessage: '[role="alert"]',
    brandHeading: 'h1:has-text("ORACLE")',
    subtitle: 'text=Sign in to access the dashboard',
    rememberMeCheckbox: 'input.login-checkbox',
    testIdEmail: 'login-email',
    testIdPassword: 'login-password',
    titleViewTaskDetails: 'Click to view details',
  },
  dashboard: {
    navDashboard: 'button:has-text("Dashboard")',
    navAiInsights: 'button:has-text("AI Insights")',
    navKpiAnalytics: 'button:has-text("KPI Analytics")',
    navSprints: 'button:has-text("Sprints")',
    developerFilter: '[aria-labelledby="dashboard-developer-filter-label"]',
    goToTasksButton: 'button:has-text("Go to Tasks")',
    productivityScore: 'text=Productivity Score',
    completionRate: 'text=Completion Rate',
  },
  tasks: {
    tasksTab: 'button:has-text("Tasks")',
    kanbanTab: 'button:has-text("Kanban board")',
    newTaskButton: 'button:has-text("New Task")',
    createTaskButton: 'button:has-text("Create task")',
    saveChangesButton: 'button:has-text("Save changes")',
    editButton: 'button:has-text("Edit")',
    tasksTable: 'table tbody',
    taskRow: 'table tbody tr',
    taskTitleInput: '[aria-label="Task title *"], [aria-label="Task title"]',
    taskDescriptionInput: '[aria-label="Description"]',
    developerSelect: '[aria-label="Developer *"]',
    startDateInput: '[aria-label="Start date *"]',
    dueDateInput: '[aria-label="Due date *"]',
    taskDialog: '[role="dialog"]',
  },
  kanban: {
    board: '.kanban-board',
    columnTodo: '.kanban-col-todo',
    columnInProgress: '.kanban-col-progress',
    columnInReview: '.kanban-col-review',
    columnDone: '.kanban-col-done',
    taskCard: '.kanban-task-card',
    columnHeader: '.kanban-column-header-title',
    columnBody: '.kanban-column-body',
  },
  developer: {
    myTasksHeading: '[role="heading"]:has-text("My Tasks")',
    tasksAssigned: 'text=Tasks assigned',
    tasksCompleted: 'text=Tasks completed',
    kanbanBoardButton: 'button:has-text("Kanban Board")',
    myPerformanceButton: 'button:has-text("My Performance")',
    hoursWorkedInput: '[aria-label="Hours worked"]',
    markDoneButton: 'button:has-text("Mark done")',
  },
} as const;

// API paths (relative to BASE_URL) 

export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  FORGOT_PASSWORD: '/api/auth/forgot-password',
  RESET_PASSWORD: '/api/auth/reset-password',
  PROJECTS: '/api/projects',
  PROJECT_BY_ID: '/api/projects/:projectId',
  DASHBOARD_BUNDLE: '/api/projects/:projectId/dashboard-bundle',
  PROJECT_DEVELOPERS: '/api/projects/:projectId/developers',
  PROJECT_EVENTS: '/api/projects/:projectId/events',
  MANAGER_PROJECTS: '/api/projects/manager/:managerId/list',
  DEVELOPER_PROJECTS: '/api/projects/developer/:userId/list',
  TASKS: '/api/tasks',
  USER_TASKS: '/api/user-tasks',
  SPRINTS: '/api/sprints',
  INSIGHTS: '/api/insights',
  MANAGER_CHAT: '/api/chat/manager',
  USERS: '/api/users',
} as const;

// Tags for filtering

export const TAGS = {
  smoke: '@smoke',
  auth: '@auth',
  manager: '@manager',
  developer: '@developer',
  tasks: '@tasks',
  mock: '@mock',
} as const;

// Visible UI text for assertions 

export const UI = {
  signIn: 'Sign in',
  invalidCredentials: 'Invalid credentials',
  dashboard: 'Dashboard',
  kpiAnalytics: 'KPI Analytics',
  aiInsights: 'AI Insights',
  myTasks: 'My Tasks',
  myPerformance: 'My Performance',
  productivityScore: 'Productivity Score',
  tasksAssigned: 'Tasks assigned',
  tasksCompleted: 'Tasks completed',
  newTask: 'New Task',
  createTask: 'Create task',
  saveChanges: 'Save changes',
  markDone: 'Mark done',
} as const;

// Kanban column names

export const KANBAN_COLUMNS = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
} as const;

// Default timeouts (ms) 

export const TIMEOUTS = {
  navigation: 45_000,
  action: 20_000,
  expect: 20_000,
  login: 45_000,
  dialog: 20_000,
  settle: 30_000,
  visualHold: 2_000,
} as const;

// Mock / HAR paths (for API mocking tests)

export const HAR_FILES = {
  loginSuccess: 'auth-login.har',
  loginFailed: 'auth-login-failed.har',
  managerSession: 'manager-session.har',
} as const;

export const MOCK = {
  harDir: 'tests/har',
  loginHarFile: 'tests/har/auth-login.har',
  loginFailedHarFile: 'tests/har/auth-login-failed.har',
  managerSessionHarFile: 'tests/har/manager-session.har',
  mockJwt: 'mock-jwt-e2e',
  mockProjectName: 'Software Manager Tool',
} as const;
