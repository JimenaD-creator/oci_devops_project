/**
 * Requirement 5: Role-based access at login (who may enter the app).
 * Component under test: Login.jsx.
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithTheme } from '../../test-utils';
import Login from './Login';
import { setupFetchMock, jsonResponse } from '../../mocks/mockFetch';

jest.mock('../../utils/auth.js', () => ({
  isAuthenticated: jest.fn(() => false),
  login: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

afterEach(() => {
  jest.clearAllMocks();
});

function makeUser(overrides = {}) {
  return {
    id: 1,
    name: 'Manager Test',
    email: 'manager@example.com',
    userPassword: 'pass123',
    type: 'MANAGER',
    phoneNumber: '5551234567',
    ...overrides,
  };
}

// Submit with empty fields shows the validation error message.
test('validation: empty email shows error on submit', async () => {
  const user = userEvent.setup();
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/please enter your email/i)).toBeInTheDocument();
});

// DEVELOPER users get a denial message and the app does not navigate away.
test('DEVELOPER role: valid credentials show access denied and do not navigate', async () => {
  const user = userEvent.setup();
  setupFetchMock([
    {
      test: (url) => String(url).includes('/users') && !String(url).includes('/api'),
      handle: () => jsonResponse([makeUser({ type: 'DEVELOPER' })]),
    },
  ]);
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  await user.type(screen.getByPlaceholderText(/email/i), 'manager@example.com');
  await user.type(screen.getByPlaceholderText(/password/i), 'pass123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/access denied/i)).toBeInTheDocument();
  expect(mockNavigate).not.toHaveBeenCalled();
});

// MANAGER signs in successfully and the router navigates to `/`.
test('MANAGER role: login and redirect to /', async () => {
  const user = userEvent.setup();
  setupFetchMock([
    {
      test: (url) => String(url).includes('/users') && !String(url).includes('/api'),
      handle: () => jsonResponse([makeUser({ type: 'MANAGER' })]),
    },
    {
      test: (url) => String(url).includes('/api/projects/manager/1'),
      handle: () => jsonResponse({ id: 10, name: 'Test Project' }),
    },
  ]);
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  await user.type(screen.getByPlaceholderText(/email/i), 'manager@example.com');
  await user.type(screen.getByPlaceholderText(/password/i), 'pass123');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
});

// If fetch fails, the user sees a connection error instead of a silent failure.
test('network error: shows message when fetch fails', async () => {
  const user = userEvent.setup();
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network Error'));
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  await user.type(screen.getByPlaceholderText(/email/i), 'a@b.com');
  await user.type(screen.getByPlaceholderText(/password/i), 'pw');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByText(/could not connect/i)).toBeInTheDocument();
});
