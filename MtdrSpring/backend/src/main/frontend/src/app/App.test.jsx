/**
 * Requirement 5 - Customized dashboard based on worker's role.
 * ADMIN sees "Change project" in the menu, and can return to project selector;
 * MANAGER does not see "Change project".
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithTheme } from '../test-utils';
import App from './App';
import { taskAPI } from '../services/API';

vi.mock('../services/API', () => ({
  taskAPI: {
    getAll: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../features/dashboard/DashboardPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-dashboard">Dashboard</div>,
}));

vi.mock('../features/tasks/TasksPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-tasks">Tasks</div>,
}));

vi.mock('../features/sprints/SprintsPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-sprints">Sprints</div>,
}));

vi.mock('../features/kpis/KPIAnalytics', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-kpi">KPI</div>,
}));

vi.mock('../features/ai/AIInsightsPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-ai">AI</div>,
}));

vi.mock('../features/project/ProjectSelector', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-project-selector">Project selector</div>,
}));

function seedUserAndProject({ role, userId = '1', name = 'Test User', projectId = '99', projectName = 'Acme' }) {
  localStorage.setItem(
    'currentUser',
    JSON.stringify({ id: userId, name, role }),
  );
  localStorage.setItem('currentProjectId', String(projectId));
  localStorage.setItem('currentProjectName', projectName);
}

function renderApp() {
  return renderWithTheme(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  );
}

describe('App shell navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    taskAPI.getAll.mockResolvedValue([]);
  });

  it('shows "Change project" for ADMIN with a selected project', async () => {
    seedUserAndProject({ role: 'ADMIN' });
    renderApp();

    await screen.findByTestId('mock-dashboard');
    expect(screen.getByText('Change project')).toBeInTheDocument();
  });

  it('does not show "Change project" for MANAGER with a selected project', async () => {
    seedUserAndProject({ role: 'MANAGER' });
    renderApp();

    await screen.findByTestId('mock-dashboard');
    expect(screen.queryByText('Change project')).not.toBeInTheDocument();
  });

  it('ADMIN clicking "Change project" clears storage and shows project selector', async () => {
    const user = userEvent.setup();
    seedUserAndProject({ role: 'ADMIN' });
    renderApp();

    await screen.findByTestId('mock-dashboard');
    await user.click(screen.getByText('Change project'));

    await waitFor(() => {
      expect(localStorage.getItem('currentProjectId')).toBeNull();
      expect(localStorage.getItem('currentProjectName')).toBeNull();
    });
    expect(await screen.findByTestId('mock-project-selector')).toBeInTheDocument();
  });
});
