/**
 * Requirement 5 - Customized dashboard based on worker's role.
 * ADMIN sees "Change project" in the menu, and can return to project selector;
 * MANAGER does not see "Change project".
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithTheme } from '../test-utils';
import App from './App';
import { taskAPI } from '../services/API';

jest.mock('../services/API', () => ({
  taskAPI: {
    getAll: jest.fn(() => Promise.resolve([])),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../features/dashboard/DashboardPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-dashboard">Dashboard</div>,
}));

jest.mock('../features/tasks/TasksPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-tasks">Tasks</div>,
}));

jest.mock('../features/sprints/SprintsPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-sprints">Sprints</div>,
}));

jest.mock('../features/kpis/KPIAnalytics', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-kpi">KPI</div>,
}));

jest.mock('../features/ai/AIInsightsPage', () => ({
  __esModule: true,
  default: () => <div data-testid="mock-ai">AI</div>,
}));

jest.mock('../features/project/ProjectSelector', () => ({
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
    jest.clearAllMocks();
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
