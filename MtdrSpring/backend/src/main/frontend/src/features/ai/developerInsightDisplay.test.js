import { describe, expect, test } from 'vitest';
import { developerInsightDisplayText } from './developerInsightDisplay';

describe('developerInsightDisplayText', () => {
  test('prefers aiNarrative and merges live snapshot suffix when present', () => {
    expect(
      developerInsightDisplayText({
        aiNarrative: 'Completed 2 tasks on time; 1 task remains in the To do status.',
        insight:
          'Completed 2 tasks on time; 1 task remains in the To do status. Current snapshot: live text.',
      }),
    ).toBe(
      'Completed 2 tasks on time; 1 task remains in the To do status. Current snapshot: live text.',
    );
  });

  test('appends Current snapshot suffix from composed insight when aiNarrative is primary', () => {
    expect(
      developerInsightDisplayText({
        aiNarrative: 'Completed 2 tasks on time with 12 hours logged. Has 1 Pending task remaining.',
        insight:
          'Completed 2 tasks on time with 12 hours logged. Has 1 Pending task remaining. Current snapshot: Completed 3 assignments, all finished on or before the due date.',
      }),
    ).toContain('Current snapshot:');
    expect(
      developerInsightDisplayText({
        aiNarrative: 'Completed 2 tasks on time with 12 hours logged. Has 1 Pending task remaining.',
        insight:
          'Completed 2 tasks on time with 12 hours logged. Has 1 Pending task remaining. Current snapshot: Completed 3 assignments, all finished on or before the due date.',
      }),
    ).toMatch(/^Completed 2 tasks on time with 12 hours logged/);
  });
});
