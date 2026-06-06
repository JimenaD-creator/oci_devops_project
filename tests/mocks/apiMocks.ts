import path from 'path';
import type { Page, Route } from '@playwright/test';
import { API_ENDPOINTS, HAR_FILES, MOCK, TEST_TASKS, UI } from '../constants';
import type { AuthLoginResponse, MockLoginPayload, TaskDto } from '../types';
//  Mock response payloads

export const MOCK_MANAGER_LOGIN: MockLoginPayload = {
  token: MOCK.mockJwt,
  user: {
    id: 1,
    name: 'Project Manager',
    type: 'MANAGER',
    role: 'MANAGER',
    jobTitle: 'Manager',
  },
  projectId: 1,
  projectName: MOCK.mockProjectName,
};

export const MOCK_DEVELOPER_LOGIN: MockLoginPayload = {
  token: `${MOCK.mockJwt}-dev`,
  user: {
    id: 2,
    name: 'Test Developer',
    type: 'DEVELOPER',
    role: 'DEVELOPER',
    jobTitle: 'Software Developer',
  },
  projectId: 1,
  projectName: MOCK.mockProjectName,
};

export const MOCK_PROJECT = {
  id: 1,
  name: MOCK.mockProjectName,
} as const;

export const MOCK_SPRINTS = [
  {
    id: 101,
    name: 'Sprint 1',
    projectId: MOCK_PROJECT.id,
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  },
];

export const MOCK_DEVELOPERS = [
  { id: 2, name: 'Demo Developer', role: 'DEVELOPER' },
  { id: 3, name: 'Alex Rivera', role: 'DEVELOPER' },
];

function buildMockTasks(): TaskDto[] {
  return TEST_TASKS.map((task, index) => ({
    id: 1001 + index,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    classification: task.classification,
    assignedSprint: { id: MOCK_SPRINTS[0].id },
    startDate: task.startDate,
    dueDate: task.dueDate,
  }));
}

export const MOCK_TASKS: TaskDto[] = buildMockTasks();

export const MOCK_USER_TASKS = MOCK_TASKS.map((task) => ({
  id: 2000 + task.id,
  user: { id: MOCK_DEVELOPER_LOGIN.user.id, name: MOCK_DEVELOPER_LOGIN.user.name },
  task: { id: task.id, title: task.title, status: task.status },
  status: task.status === 'DONE' ? 'COMPLETED' : 'IN_PROGRESS',
  workedHours: task.status === 'DONE' ? 4 : 0,
}));

export const MOCK_DASHBOARD_BUNDLE = {
  projectId: MOCK_PROJECT.id,
  sprints: MOCK_SPRINTS,
  tasks: MOCK_TASKS,
  userTasks: MOCK_USER_TASKS,
  developers: MOCK_DEVELOPERS,
};

export const MOCK_ANALYTICS_CSV =
  'developer,tasks,completed\nDemo Developer,3,1\nAlex Rivera,2,2\n';

// Route helpers 

function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function fulfillSse(route: Route): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: ':ok\n\n',
  });
}

function fulfillUnauthorized(route: Route, message = UI.invalidCredentials): Promise<void> {
  return fulfillJson(route, { message: `${message}.` }, 401);
}

function toLoginResponse(payload: MockLoginPayload): AuthLoginResponse {
  return {
    token: payload.token,
    user: payload.user,
    projectId: payload.projectId,
    projectName: payload.projectName,
  };
}

// Individual mock handlers 

/** Mocks POST /api/auth/login with 401 */
export async function mockLoginUnauthorized(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.LOGIN}`, (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return fulfillUnauthorized(route);
  });
}

/** Mocks POST /api/auth/login with a successful response. */
export async function mockLoginSuccess(
  page: Page,
  payload: MockLoginPayload = MOCK_MANAGER_LOGIN,
): Promise<void> {
  await page.route(`**${API_ENDPOINTS.LOGIN}`, (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    return fulfillJson(route, toLoginResponse(payload));
  });
}

/** Mocks manager project list returned after login. */
export async function mockManagerProjects(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.MANAGER_PROJECTS.replace(':managerId', '*')}`, (route) =>
    fulfillJson(route, [MOCK_PROJECT]),
  );
}

/** Mocks developer project list returned after login. */
export async function mockDeveloperProjects(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.DEVELOPER_PROJECTS.replace(':userId', '*')}`, (route) =>
    fulfillJson(route, [MOCK_PROJECT]),
  );
}

/** Mocks GET /api/projects/:id/dashboard-bundle. */
export async function mockDashboardBundle(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.DASHBOARD_BUNDLE.replace(':projectId', '*')}`, (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }
    return fulfillJson(route, MOCK_DASHBOARD_BUNDLE);
  });
}

/** Mocks GET /api/projects/:id/developers. */
export async function mockProjectDevelopers(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.PROJECT_DEVELOPERS.replace(':projectId', '*')}`, (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }
    return fulfillJson(route, MOCK_DEVELOPERS);
  });
}

/** Mocks SSE /api/projects/:id/events. */
export async function mockProjectEvents(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.PROJECT_EVENTS.replace(':projectId', '*')}`, (route) =>
    fulfillSse(route),
  );
}

/** Mocks GET /api/sprints?projectId=… */
export async function mockSprints(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.SPRINTS}*`, (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue();
    }
    return fulfillJson(route, MOCK_SPRINTS);
  });
}

/** Mocks GET /api/tasks?projectId=… and POST /api/tasks. */
export async function mockTasks(page: Page): Promise<void> {
  await page.route(/\/api\/tasks(\?.*)?$/, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      return fulfillJson(route, MOCK_TASKS);
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const created: TaskDto = {
        id: 9000 + MOCK_TASKS.length,
        title: String(body.title ?? body.name ?? 'New task'),
        description: String(body.description ?? ''),
        status: 'TODO',
        priority: (body.priority as TaskDto['priority']) ?? 'MEDIUM',
        classification: (body.classification as TaskDto['classification']) ?? 'TASK',
        assignedSprint: { id: MOCK_SPRINTS[0].id },
        startDate: String(body.startDate ?? ''),
        dueDate: String(body.dueDate ?? ''),
      };
      MOCK_TASKS.push(created);
      return fulfillJson(route, created, 201);
    }

    return route.continue();
  });
}

/** Mocks GET /api/tasks/:id (update) and related task mutations. */
export async function mockTaskById(page: Page): Promise<void> {
  await page.route('**/api/tasks/*', async (route) => {
    const url = route.request().url();
    if (url.includes('?')) {
      return route.fallback();
    }

    const method = route.request().method();
    const id = Number(url.split('/api/tasks/')[1]?.split(/[/?]/)[0]);

    if (method === 'GET') {
      const task = MOCK_TASKS.find((t) => t.id === id);
      return task ? fulfillJson(route, task) : fulfillJson(route, { message: 'Not found' }, 404);
    }

    if (method === 'PUT' || method === 'PATCH') {
      const body = route.request().postDataJSON() as Partial<TaskDto>;
      const task = MOCK_TASKS.find((t) => t.id === id);
      if (!task) {
        return fulfillJson(route, { message: 'Not found' }, 404);
      }
      Object.assign(task, body);
      return fulfillJson(route, task);
    }

    if (method === 'DELETE') {
      return fulfillJson(route, {});
    }

    return route.continue();
  });
}

/** Mocks GET /api/user-tasks?projectId=… and POST assignments. */
export async function mockUserTasks(page: Page): Promise<void> {
  await page.route(`**${API_ENDPOINTS.USER_TASKS}*`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      return fulfillJson(route, MOCK_USER_TASKS);
    }

    if (method === 'POST') {
      return fulfillJson(route, { id: 9999, status: 'COMPLETED' }, 201);
    }

    return route.continue();
  });
}

/** Mocks analytics CSV export download. */
export async function mockAnalyticsExport(page: Page): Promise<void> {
  await page.route('**/api/projects/*/analytics/export', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: { 'Content-Disposition': 'attachment; filename="team-analytics.csv"' },
      body: MOCK_ANALYTICS_CSV,
    }),
  );
}

// HAR file mocking 

export type HarMockOptions = {
  /** HAR filename inside tests/har/ (defaults to auth-login.har) */
  harFile?: string;
  /** URL glob passed to routeFromHAR (defaults to all API routes) */
  url?: string;
  /** When true, records network traffic into the HAR instead of replaying */
  update?: boolean;
  /** What to do when no HAR entry matches — use 'abort' to guarantee no real API */
  notFound?: 'abort' | 'fallback';
};

/** Resolves a HAR filename to an absolute path under tests/har/. */
export function resolveHarPath(harFile: string): string {
  return path.join(__dirname, '..', 'har', harFile);
}

/**
 * Generic HAR replay helper (Playwright routeFromHAR).
 * @see https://playwright.dev/docs/mock#mocking-with-har-files
 */
export async function mockFromHar(page: Page, options: HarMockOptions = {}): Promise<void> {
  const harFile = options.harFile ?? HAR_FILES.loginSuccess;
  await page.routeFromHAR(resolveHarPath(harFile), {
    url: options.url ?? '**/api/**',
    update: options.update ?? false,
    notFound: options.notFound ?? 'fallback',
  });
}

/** Replays POST /api/auth/login from auth-login.har (successful login). */
export async function mockLoginFromHar(
  page: Page,
  harFile: string = HAR_FILES.loginSuccess,
): Promise<void> {
  await mockFromHar(page, {
    harFile,
    url: `**${API_ENDPOINTS.LOGIN}`,
    notFound: 'abort',
  });
}

/** Replays POST /api/auth/login from auth-login-failed.har (401 response). */
export async function mockLoginFailedFromHar(page: Page): Promise<void> {
  await mockFromHar(page, {
    harFile: HAR_FILES.loginFailed,
    url: `**${API_ENDPOINTS.LOGIN}`,
    notFound: 'abort',
  });
}

/**
 * Replays a full manager session from manager-session.har
 * (login + projects + dashboard-bundle + events + sprints + tasks).
 * Unmatched API calls fall back to programmatic mocks so the UI keeps working.
 */
export async function mockManagerSessionFromHar(page: Page): Promise<void> {
  await mockUnhandledApi(page);
  await mockFromHar(page, {
    harFile: HAR_FILES.managerSession,
    url: '**/api/**',
    notFound: 'fallback',
  });

  // Fallback mocks for endpoints not captured in the HAR file
  await mockProjectDevelopers(page);
  await mockUserTasks(page);
  await mockTaskById(page);
}

/** Records live API traffic into a HAR file (use once, then commit the generated file). */
export async function recordHar(page: Page, harFile: string, url = '**/api/**'): Promise<void> {
  await page.routeFromHAR(resolveHarPath(harFile), {
    url,
    update: true,
  });
}
// Composed setups

/** Fallback for unmatched API calls so mock JWT sessions are not logged out with 401. */
export async function mockUnhandledApi(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      return fulfillJson(route, []);
    }
    return fulfillJson(route, {}, 200);
  });
}

/** Registers all mocks needed for a mocked manager session (no real API). */
export async function mockAllForManager(page: Page): Promise<void> {
  await mockUnhandledApi(page);
  await mockLoginSuccess(page, MOCK_MANAGER_LOGIN);
  await mockManagerProjects(page);
  await mockDashboardBundle(page);
  await mockProjectDevelopers(page);
  await mockProjectEvents(page);
  await mockSprints(page);
  await mockTasks(page);
  await mockTaskById(page);
  await mockUserTasks(page);
}

/** Registers all mocks needed for a mocked developer session (no real API). */
export async function mockAllForDeveloper(page: Page): Promise<void> {
  await mockUnhandledApi(page);
  await mockLoginSuccess(page, MOCK_DEVELOPER_LOGIN);
  await mockDeveloperProjects(page);
  await mockDashboardBundle(page);
  await mockProjectDevelopers(page);
  await mockProjectEvents(page);
  await mockSprints(page);
  await mockTasks(page);
  await mockTaskById(page);
  await mockUserTasks(page);
}

/** Fluent wrapper for grouping mocks in tests. */
export class ApiMocks {
  constructor(readonly page: Page) {}

  loginUnauthorized(): Promise<void> {
    return mockLoginUnauthorized(this.page);
  }

  loginSuccess(payload: MockLoginPayload = MOCK_MANAGER_LOGIN): Promise<void> {
    return mockLoginSuccess(this.page, payload);
  }

  loginFromHar(harFile?: string): Promise<void> {
    return mockLoginFromHar(this.page, harFile);
  }

  loginFailedFromHar(): Promise<void> {
    return mockLoginFailedFromHar(this.page);
  }

  managerSessionFromHar(): Promise<void> {
    return mockManagerSessionFromHar(this.page);
  }

  fromHar(options?: HarMockOptions): Promise<void> {
    return mockFromHar(this.page, options);
  }

  recordHar(harFile: string, url?: string): Promise<void> {
    return recordHar(this.page, harFile, url);
  }

  managerSession(): Promise<void> {
    return mockAllForManager(this.page);
  }

  developerSession(): Promise<void> {
    return mockAllForDeveloper(this.page);
  }

  analyticsExport(): Promise<void> {
    return mockAnalyticsExport(this.page);
  }
}
