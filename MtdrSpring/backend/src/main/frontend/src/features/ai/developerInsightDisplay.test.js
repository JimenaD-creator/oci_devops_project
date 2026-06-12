import { describe, expect, test } from 'vitest';
import { developerInsightDisplayText } from './developerInsightDisplay';

describe('developerInsightDisplayText', () => {
  test('prefers backend-composed insight (includes live on-time corrections)', () => {
    expect(
      developerInsightDisplayText({
        aiNarrative:
          'Completed 5 tasks, though 2 were finished after their due date.',
        insight:
          'Completed 5 assignments, all finished on or before the due date. Performance is consistent.',
      }),
    ).toBe(
      'Completed 5 assignments, all finished on or before the due date. Performance is consistent.',
    );
  });

  test('falls back to aiNarrative when insight is empty', () => {
    expect(
      developerInsightDisplayText({
        aiNarrative: 'Completed 2 tasks on time; 1 task remains in the To do status.',
        insight: '',
      }),
    ).toBe('Completed 2 tasks on time; 1 task remains in the To do status.');
  });
});
