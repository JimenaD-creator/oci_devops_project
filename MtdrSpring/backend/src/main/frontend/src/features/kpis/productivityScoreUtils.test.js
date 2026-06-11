import { describe, expect, it } from 'vitest';
import {
  buildProductivityKpiAnalyticsGuideLine,
  appendProductivityEvolutionNote,
  finalizeProductivityManagerGuideText,
  stripProductivityEvolutionNotesForEndedSprint,
  appendProductivityEndedSprintClosing,
  stripProductivityGuideInstructionEcho,
  stripProductivityLowScoreExcuses,
  softenProductivityGuideForSprintPhase,
  computeIndividualWorkloadBalance,
  computeIndividualProductivityScore,
  computeProductivityScore,
  productivityScoreFromDeveloperMetrics,
} from './productivityScoreUtils';

describe('computeIndividualWorkloadBalance', () => {
  it('rewards developers who cleared all assignments despite lighter load vs peers', () => {
    const team = [
      { name: 'A', assigned: 10, completed: 8, hours: 40 },
      { name: 'B', assigned: 4, completed: 4, hours: 12 },
      { name: 'C', assigned: 6, completed: 5, hours: 28 },
    ];
    expect(computeIndividualWorkloadBalance(team[1], team)).toBe(85);
  });

  it('scores 100 when assignment count matches team average', () => {
    const team = [
      { assigned: 5, completed: 5, hours: 20 },
      { assigned: 5, completed: 4, hours: 30 },
      { assigned: 5, completed: 3, hours: 10 },
    ];
    expect(computeIndividualWorkloadBalance(team[0], team)).toBe(100);
  });

  it('returns 0 for developers with no sprint activity', () => {
    const team = [{ assigned: 3, completed: 2, hours: 8 }];
    expect(computeIndividualWorkloadBalance({ assigned: 0, completed: 0, hours: 0 }, team)).toBe(0);
  });
});

describe('computeIndividualProductivityScore', () => {
  it('uses 45/35/20 weights and ignores workload', () => {
    expect(
      computeIndividualProductivityScore({
        completionRate: 100,
        onTimeDelivery: 100,
        efficiencyScore: 100,
      }),
    ).toBe(100);
    expect(
      computeIndividualProductivityScore({
        completionRate: 80,
        onTimeDelivery: 60,
        efficiencyScore: 50,
      }),
    ).toBe(Math.round(80 * 0.45 + 60 * 0.35 + 50 * 0.2));
  });

  it('productivityScoreFromDeveloperMetrics matches individual formula', () => {
    const score = productivityScoreFromDeveloperMetrics({
      assigned: 10,
      completed: 8,
      hours: 20,
      assignedHoursEstimate: 18,
      onTime: 90,
      workload: 70,
    });
    const expected = computeIndividualProductivityScore({
      completionRate: 80,
      onTimeDelivery: 90,
      efficiencyScore: 90,
    });
    expect(score).toBe(expected);
  });
});

describe('computeProductivityScore (team / sprint)', () => {
  it('keeps 40/30/20/10 weights including workload', () => {
    expect(
      computeProductivityScore({
        completionRate: 100,
        onTimeDelivery: 100,
        efficiencyScore: 100,
        workloadBalance: 100,
      }),
    ).toBe(100);
    expect(
      computeProductivityScore({
        completionRate: 80,
        onTimeDelivery: 60,
        efficiencyScore: 50,
        workloadBalance: 70,
      }),
    ).toBe(Math.round(80 * 0.4 + 60 * 0.3 + 50 * 0.2 + 70 * 0.1));
  });
});

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
      isEarly: false,
    });
    expect(added).toMatch(/marked Done/i);
  });

  it('appendProductivityEvolutionNote skips duplicate when Gemini already mentions active tasks', () => {
    const gemini =
      'The productivity score is 81%, which reflects the current balance of completed work and active tasks.';
    const out = appendProductivityEvolutionNote(gemini, { phase: 'in_progress', isEarly: false });
    expect(out).toBe(gemini);
    expect(out).not.toMatch(/not a final grade.*not a final grade/i);
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

  it('finalizeProductivityManagerGuideText prepends score % when only evolution note remains', () => {
    const out = finalizeProductivityManagerGuideText(
      'It will keep updating as tasks progress and completion, on-time delivery, participation, and workload balance change during the sprint.',
      42,
      { phase: 'in_progress', isEarly: true },
    );
    expect(out).toContain('The Productivity Score is 42%');
    expect(out).toMatch(/keep updating/i);
  });

  it('stripProductivityEvolutionNotesForEndedSprint removes forward-looking sentences', () => {
    const raw =
      'The 99% productivity score demonstrates a healthy and sustainable pace for the team. ' +
      'It will keep updating as tasks progress and completion, on-time delivery, participation, and workload balance change during the sprint.';
    const out = stripProductivityEvolutionNotesForEndedSprint(raw, { phase: 'ended', isEarly: false });
    expect(out).toContain('healthy and sustainable pace');
    expect(out).not.toMatch(/keep updating|during the sprint/i);
  });

  it('finalizeProductivityManagerGuideText does not append evolution note when sprint ended', () => {
    const pastStart = new Date();
    pastStart.setDate(pastStart.getDate() - 30);
    const pastDue = new Date();
    pastDue.setDate(pastDue.getDate() - 7);
    const out = finalizeProductivityManagerGuideText(
      'The 99% productivity score demonstrates a healthy and sustainable pace for the team. ' +
        'It will keep updating as tasks progress and completion, on-time delivery, participation, and workload balance change during the sprint.',
      99,
      { startDate: pastStart.toISOString(), dueDate: pastDue.toISOString() },
    );
    expect(out).toContain('healthy and sustainable pace');
    expect(out).not.toMatch(/keep updating|during the sprint/i);
    expect(out).toMatch(/final delivery for the completed sprint window/i);
  });

  it('appendProductivityEndedSprintClosing does not duplicate when closing already present', () => {
    const raw =
      'The productivity score is 88% and reflects final delivery for the completed sprint.';
    const out = appendProductivityEndedSprintClosing(raw, { phase: 'ended', isEarly: false });
    expect(out).toBe(raw);
  });

  it('softenProductivityGuideForSprintPhase strips judgment labels before sprint is mature', () => {
    const out = softenProductivityGuideForSprintPhase('Performance is weak in the combined view.', {
      phase: 'not_started',
      isEarly: true,
    });
    expect(out).not.toMatch(/weak/i);
  });
});
