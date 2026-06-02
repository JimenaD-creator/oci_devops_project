import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch } from '../../utils/auth';
import {
  fetchProjectDevelopers,
  getCachedProjectDevelopersSnapshot,
  invalidateProjectDevelopersCache,
} from './projectApi';

vi.mock('../../utils/auth', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('../../utils/apiBase', () => ({
  getApiBase: () => 'http://test.local',
}));

beforeEach(() => {
  invalidateProjectDevelopersCache();
});

afterEach(() => {
  vi.clearAllMocks();
  invalidateProjectDevelopersCache();
});

test('fetchProjectDevelopers caches results per project', async () => {
  const developers = [{ id: 1, name: 'Ada' }];
  apiFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(developers),
  });

  const first = await fetchProjectDevelopers('42');
  const second = await fetchProjectDevelopers('42');

  expect(first).toEqual(developers);
  expect(second).toEqual(developers);
  expect(apiFetch).toHaveBeenCalledTimes(1);
});

test('getCachedProjectDevelopersSnapshot returns warm cache without network', async () => {
  apiFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ id: 2, name: 'Grace' }]),
  });

  expect(getCachedProjectDevelopersSnapshot('7')).toBeNull();
  await fetchProjectDevelopers('7');

  const snap = getCachedProjectDevelopersSnapshot('7');
  expect(snap?.developers).toEqual([{ id: 2, name: 'Grace' }]);
  expect(typeof snap?.timestamp).toBe('number');
});

test('fetchProjectDevelopers with forceFresh bypasses cache', async () => {
  apiFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }]),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
    });

  await fetchProjectDevelopers('99');
  const refreshed = await fetchProjectDevelopers('99', { forceFresh: true });

  expect(refreshed).toEqual([{ id: 1 }, { id: 2 }]);
  expect(apiFetch).toHaveBeenCalledTimes(2);
});
