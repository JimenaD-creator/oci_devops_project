/**
 * Tasks page API helpers (worked hours on completion).
 */
import { afterEach, expect, test, vi } from 'vitest';
import { apiFetch } from '../../utils/auth';
import { completeAssigneeWithHours } from './tasksPageApi';

vi.mock('../../utils/auth', () => ({
  apiFetch: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

test('completeAssigneeWithHours POSTs COMPLETED status and workedHours', async () => {
  const saved = { user: { id: 5 }, task: { id: 12 }, status: 'COMPLETED', workedHours: 3.5 };
  apiFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(saved),
  });

  const result = await completeAssigneeWithHours(12, 5, 3.5);

  expect(apiFetch).toHaveBeenCalledTimes(1);
  const [url, options] = apiFetch.mock.calls[0];
  expect(url).toMatch(/\/api\/user-tasks$/);
  expect(options.method).toBe('POST');
  const body = JSON.parse(options.body);
  expect(body).toEqual({
    userId: 5,
    taskId: 12,
    status: 'COMPLETED',
    workedHours: 3.5,
  });
  expect(result).toEqual(saved);
});

test('completeAssigneeWithHours throws when response is not ok', async () => {
  apiFetch.mockResolvedValue({ ok: false });

  await expect(completeAssigneeWithHours(1, 2, 1)).rejects.toThrow(/failed to save worked hours/i);
});
