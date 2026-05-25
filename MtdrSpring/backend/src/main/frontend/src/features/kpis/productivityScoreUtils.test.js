import { describe, expect, it } from 'vitest';
import {
  buildProductivityKpiAnalyticsGuideLine,
  appendProductivityEvolutionNote,
  stripProductivityGuideInstructionEcho,
  stripProductivityLowScoreExcuses,
  softenProductivityGuideForSprintPhase,
} from './productivityScoreUtils';

describe('productivityScoreUtils (KPI Analytics)', () => {
  it('buildProductivityKpiAnalyticsGuideLine is a short fallback (value + what it measures)', () => {
    const futureStart = new Date();
    futureStart.setDate(futureStart.getDate() + 14);
    const futureDue = new Date(futureStart);
    futureDue.setDate(futureDue.getDate() + 14);
    const line = buildProductivityKpiAnalyticsGuideLine(9, {
      startDate: futureStart.toISOString(),
      dueDate: futureDue.toISOString(),
    });
    expect(line).toContain('The Productivity Score is 9%');
    expect(line).toMatch(/combining completion rate/i);
    expect(line).toMatch(/will update once the sprint begins/i);
    expect(line).not.toMatch(/matching the KPI card|40%|weak|baseline|underperform|expected/i);
  });

  it('appendProductivityEvolutionNote adds forward-looking sentence without duplicating', () => {
    const withNote = appendProductivityEvolutionNote(
      'Score is 12%. It will update once the sprint begins.',
      { phase: 'not_started', isEarly: true },
    );
    expect(withNote).not.toMatch(/will update.*will update/i);
    const added = appendProductivityEvolutionNote('Score is 12%.', {
      phase: 'in_progress',
      isEarly: true,
    });
    expect(added).toMatch(/keep updating/i);
  });

  it('stripProductivityGuideInstructionEcho removes instruction-style suffix', () => {
    const raw =
      'The Productivity Score is 9%, matching the KPI card above (completion 40%, on-time delivery 30%, team participation 20%, workload balance 10%).';
    const out = stripProductivityGuideInstructionEcho(raw);
    expect(out).not.toMatch(/matching the KPI card/i);
    expect(out).not.toMatch(/completion 40%/i);
  });

  it('stripProductivityLowScoreExcuses removes low-score justification when sprint not started', () => {
    const raw =
      'The Productivity Score is 9%. The sprint has not started yet, so a low value is expected. It combines the four KPIs.';
    const out = stripProductivityLowScoreExcuses(raw, { phase: 'not_started', isEarly: true });
    expect(out).not.toMatch(/not started|expected|baseline/i);
    expect(out).toContain('Productivity Score is 9%');
    expect(out).toContain('combines the four KPIs');
  });

  it('softenProductivityGuideForSprintPhase strips judgment labels before sprint is mature', () => {
    const out = softenProductivityGuideForSprintPhase(
      'Performance is weak in the combined view.',
      { phase: 'not_started', isEarly: true },
    );
    expect(out).not.toMatch(/weak/i);
  });
});
