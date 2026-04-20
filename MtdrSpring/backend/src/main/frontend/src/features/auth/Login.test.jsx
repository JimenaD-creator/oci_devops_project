/**
 * Requirement: Role-based dashboard (login gate).
 * Topics: Form Testing, Mock HTTP requests, Mock functions (jest.fn/spy).
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { renderWithTheme } from '../../test-utils';
import Login from './Login';
import { setupFetchMock, jsonResponse } from '../../mocks/mockFetch';

// Mock the auth utilities so navigation side-effects are isolated 
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

// Dynamic test data factory 
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

// Tests 

test('shows error when fields are empty and Sign in is clicked', async () => {
  const user = userEvent.setup();
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: /sign in/i }));
  expect(
    await screen.findByText(/please enter your email/i),
  ).toBeInTheDocument();
});

test('typing in email and password fields updates their values', async () => {
  const user = userEvent.setup();
  renderWithTheme(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
  const emailInput = screen.getByPlaceholderText(/email, phone, or username/i);
  const pwInput = screen.getByPlaceholderText(/enter your password/i);
  await user.type(emailInput, 'admin@oracle.com');
  await user.type(pwInput, 'secret');
  expect(emailInput).toHaveValue('admin@oracle.com');
  expect(pwInput).toHaveValue('secret');
});

test('MOCK HTTP: DEVELOPER role is denied access after valid credentials', async () => {
  const user = userEvent.setup();
  setupFetchMock([
    {
      test: () => true,
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

test('MOCK HTTP: MANAGER logs in and is redirected to home', async () => {
  const user = userEvent.setup();
  setupFetchMock([
    {
      test: (url) => url.includes('/users') && !url.includes('/api'),
      handle: () => jsonResponse([makeUser({ type: 'MANAGER' })]),
    },
    {
      test: (url) => url.includes('/api/projects/manager/1'),
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

test('MOCK HTTP: shows error when server is unreachable', async () => {
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
