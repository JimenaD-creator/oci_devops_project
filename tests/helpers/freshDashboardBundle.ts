import type { APIRequestContext, Page, Route } from '@playwright/test';
import { BASE_URL } from '../constants';

async function fetchJson(
  api: APIRequestContext,
  path: string,
  auth?: string,
): Promise<unknown> {
  const response = await api.get(`${BASE_URL}${path}`, {
    headers: auth ? { Authorization: auth } : undefined,
  });
  if (!response.ok()) {
    throw new Error(`GET ${path} failed with ${response.status()}`);
  }
  return response.json();
}

export async function installFreshDashboardBundleRoute(page: Page): Promise<void> {
  await page.route('**/api/projects/*/dashboard-bundle', async (route: Route) => {
    if (page.isClosed()) {
      await route.continue();
      return;
    }

    const match = route.request().url().match(/\/api\/projects\/(\d+)\/dashboard-bundle/);
    const projectId = match?.[1] ?? '1';
    const auth = route.request().headers()['authorization'];

    try {
      const [sprints, tasks, userTasks, developers] = await Promise.all([
        fetchJson(page.request, `/api/sprints?projectId=${projectId}`, auth),
        fetchJson(page.request, `/api/tasks?projectId=${projectId}`, auth),
        fetchJson(page.request, `/api/user-tasks?projectId=${projectId}`, auth),
        fetchJson(page.request, `/api/projects/${projectId}/developers`, auth),
      ]);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projectId: Number(projectId),
          sprints,
          tasks,
          userTasks,
          developers: Array.isArray(developers) ? developers : [],
        }),
      });
    } catch {
      await route.continue();
    }
  });
}
