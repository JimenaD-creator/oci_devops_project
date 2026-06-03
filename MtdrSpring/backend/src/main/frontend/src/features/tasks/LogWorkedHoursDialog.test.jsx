/**
 * Worked-hours dialog shown when a developer marks a task Done.
 */
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { renderWithTheme } from '../../test-utils';
import LogWorkedHoursDialog from './LogWorkedHoursDialog';

test('shows task title and prefills initial hours when open', () => {
  renderWithTheme(
    <LogWorkedHoursDialog
      open
      taskTitle="API wiring"
      initialHours={2.5}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );

  expect(screen.getByText('API wiring')).toBeInTheDocument();
  expect(screen.getByText(/Log hours worked/i)).toBeInTheDocument();
  expect(screen.getByLabelText('Hours worked')).toHaveValue(2.5);
});

test('confirm calls onConfirm with parsed hours', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn().mockResolvedValue(undefined);

  renderWithTheme(
    <LogWorkedHoursDialog open taskTitle="Ship feature" onConfirm={onConfirm} onCancel={vi.fn()} />,
  );

  await user.type(screen.getByLabelText('Hours worked'), '4');
  await user.click(screen.getByRole('button', { name: 'Mark done' }));

  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(4));
});

test('rejects negative hours without calling onConfirm', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();

  renderWithTheme(<LogWorkedHoursDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);

  await user.type(screen.getByLabelText('Hours worked'), '-1');
  await user.click(screen.getByRole('button', { name: 'Mark done' }));

  expect(onConfirm).not.toHaveBeenCalled();
  expect(screen.getByText(/valid number of hours/i)).toBeInTheDocument();
});

test('cancel calls onCancel when not submitting', async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();

  renderWithTheme(<LogWorkedHoursDialog open onConfirm={vi.fn()} onCancel={onCancel} />);

  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test('allows zero hours', async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn().mockResolvedValue(undefined);

  renderWithTheme(<LogWorkedHoursDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);

  await user.type(screen.getByLabelText('Hours worked'), '0');
  await user.click(screen.getByRole('button', { name: 'Mark done' }));

  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(0));
});
