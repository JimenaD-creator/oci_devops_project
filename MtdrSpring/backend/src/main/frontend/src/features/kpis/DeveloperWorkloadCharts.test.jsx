import { expect, test } from 'vitest';
import { buildTeamWorkedEstimatedHoursRows } from './DeveloperWorkloadCharts';

const sprintSnapshot = {
  id: 7,
  shortLabel: 'Sprint 7',
  developers: [
    { name: 'Ana Ruiz', hours: 18, assignedHoursEstimate: 16 },
    { name: 'Luis Pérez', hours: 9, assignedHoursEstimate: 12 },
  ],
};

test('buildTeamWorkedEstimatedHoursRows sums estimated and worked hours across developers', () => {
  const rows = buildTeamWorkedEstimatedHoursRows([sprintSnapshot]);

  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe('Sprint 7');
  expect(rows[0].sp7_e).toBe(28);
  expect(rows[0].sp7_h).toBe(27);
});
