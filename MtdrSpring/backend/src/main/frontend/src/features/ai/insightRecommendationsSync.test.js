import { describe, it, expect } from 'vitest';
import {
  computeRecommendationList,
  hasTeamOverloadFlag,
  isGenericWorkloadRedistributionText,
  isValidRedistributionPair,
  parseMoveSuggestionFromInsight,
  pickGeminiWorkloadFromActionables,
  pickRedistributionReceiver,
  refineExplicitWorkloadRecommendation,
  workloadRowsFromDeveloperInsights,
} from './insightRecommendationsSync';

describe('isGenericWorkloadRedistributionText', () => {
  it('detects balanced-assignment filler', () => {
    expect(
      isGenericWorkloadRedistributionText(
        'Current task status distribution is balanced across developers. Keep assignments stable and focus on unblocking tasks in In progress/In review.',
      ),
    ).toBe(true);
  });
});

describe('parseMoveSuggestionFromInsight', () => {
  it('parses consider moving N tasks to teammate', () => {
    expect(
      parseMoveSuggestionFromInsight(
        'Carrying more than peers — consider moving ~2 task(s) to Alice (1 planned row).',
      ),
    ).toEqual({ tasksToMove: 2, to: 'Alice' });
  });

  it('parses backend overload enrichment line', () => {
    expect(
      parseMoveSuggestionFromInsight(
        'Flagged as overloaded — consider moving ~1 task(s) to Ana López.',
      ),
    ).toEqual({ tasksToMove: 1, to: 'Ana López' });
  });
});

describe('pickRedistributionReceiver', () => {
  it('prefers a receiver with lower open load, not just fewer In progress tasks', () => {
    expect(
      pickRedistributionReceiver(
        [
          { name: 'Diego Carrillo', assigned: 2, completed: 0, pending: 2, hours: 12 },
          { name: 'Erick Sánchez', assigned: 2, completed: 1, pending: 1, hours: 40 },
          { name: 'Ana López', assigned: 1, completed: 0, pending: 1, hours: 5 },
        ],
        'Diego Carrillo',
      ),
    ).toBe('Ana López');
  });

  it('does not pick a teammate who already logged more hours than the sender', () => {
    expect(
      isValidRedistributionPair(
        { name: 'Diego Carrillo', assigned: 2, completed: 0, pending: 2, hours: 12 },
        { name: 'Erick Sánchez', assigned: 2, completed: 1, pending: 1, hours: 40 },
      ),
    ).toBe(false);
    expect(
      pickRedistributionReceiver(
        [
          { name: 'Diego Carrillo', assigned: 2, completed: 0, pending: 2, hours: 12 },
          { name: 'Erick Sánchez', assigned: 2, completed: 1, pending: 1, hours: 40 },
          { name: 'Jimena Díaz', assigned: 1, completed: 0, pending: 1, hours: 4 },
        ],
        'Diego Carrillo',
      ),
    ).toBe('Jimena Díaz');
  });
});

describe('hasTeamOverloadFlag', () => {
  it('is true when any developer is overloaded', () => {
    expect(
      hasTeamOverloadFlag([
        { developerName: 'A', overloaded: false },
        { developerName: 'B', overloaded: true },
      ]),
    ).toBe(true);
  });
});

describe('workloadRowsFromDeveloperInsights', () => {
  it('uses suggestedMoveTo when present', () => {
    const rows = workloadRowsFromDeveloperInsights([
      {
        developerName: 'Bob',
        overloaded: true,
        suggestedMoveTo: 'Alice',
        suggestedTasksToMove: 2,
        insight: 'Too many open tasks.',
      },
    ]);
    expect(rows).toEqual([
      {
        from: 'Bob',
        to: 'Alice',
        tasksToMove: 2,
        reason: 'Too many open tasks.',
      },
    ]);
  });

  it('parses move target from insight prose', () => {
    const rows = workloadRowsFromDeveloperInsights([
      {
        developerName: 'Maria',
        overloaded: true,
        insight: 'Planned load — consider moving ~3 task(s) to Carlos (2 rows).',
      },
    ]);
    expect(rows[0]).toMatchObject({ from: 'Maria', to: 'Carlos', tasksToMove: 3 });
  });

  it('prefers receiver who finished assignments with fewer hours', () => {
    const rows = workloadRowsFromDeveloperInsights(
      [
        {
          developerName: 'Erick Sánchez',
          overloaded: true,
          insight: '3 open assignment rows vs team average.',
        },
      ],
      [
        { name: 'Erick Sánchez', assigned: 5, completed: 2, pending: 3, hours: 40 },
        {
          name: 'Ana López',
          assigned: 2,
          completed: 2,
          pending: 0,
          hours: 8,
          assignedHoursEstimate: 20,
        },
        {
          name: 'Luis Pérez',
          assigned: 2,
          completed: 2,
          pending: 0,
          hours: 25,
          assignedHoursEstimate: 20,
        },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].from).toBe('Erick Sánchez');
    expect(rows[0].to).toBe('Ana López');
  });

  it('does not assign redistribution to a developer with active blockers', () => {
    const blocked = new Set(['ana lópez']);
    expect(
      pickRedistributionReceiver(
        [
          { name: 'Erick Sánchez', assigned: 3, completed: 1, pending: 2, hours: 20 },
          { name: 'Ana López', assigned: 1, completed: 0, pending: 1, hours: 4 },
          { name: 'Luis Pérez', assigned: 2, completed: 2, pending: 0, hours: 10 },
        ],
        'Erick Sánchez',
        blocked,
      ),
    ).toBe('Luis Pérez');

    const rows = workloadRowsFromDeveloperInsights(
      [
        {
          developerName: 'Erick Sánchez',
          overloaded: true,
          suggestedMoveTo: 'Ana López',
          suggestedTasksToMove: 1,
        },
      ],
      [
        { name: 'Erick Sánchez', assigned: 3, completed: 2, pending: 1, hours: 20 },
        { name: 'Ana López', assigned: 1, completed: 0, pending: 1, hours: 4 },
        { name: 'Luis Pérez', assigned: 2, completed: 2, pending: 0, hours: 10 },
      ],
      blocked,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].to).toBe('Luis Pérez');
  });

  it('still builds a move when overloaded but all assignments are done (Team chip sync)', () => {
    const rows = workloadRowsFromDeveloperInsights(
      [
        {
          developerName: 'Erick Sánchez',
          overloaded: true,
          insight:
            'Completed 2 assignments, all finished on or before the due date. Hours logged are above the team average.',
        },
      ],
      [
        { name: 'Erick Sánchez', assigned: 2, completed: 2, pending: 0 },
        { name: 'Diego Carrillo', assigned: 1, completed: 1, pending: 0 },
      ],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].from).toBe('Erick Sánchez');
    expect(rows[0].to).toBe('Diego Carrillo');
  });
});

describe('pickGeminiWorkloadFromActionables', () => {
  it('returns explicit Gemini workload unchanged', () => {
    const picked = pickGeminiWorkloadFromActionables([
      {
        category: 'workload_redistribution',
        text: 'Shift about 2 task(s) toward Ana: Jimena has more In progress work than peers.',
      },
    ]);
    expect(picked?.kind).toBe('explicit');
    expect(picked?.text).toMatch(/Shift about 2 task/);
  });
});

describe('computeRecommendationList', () => {
  it('prefers Gemini workload text over synthesized overload fallback', () => {
    const list = computeRecommendationList(
      {
        actionableRecommendations: [
          {
            category: 'workload_redistribution',
            text: 'Shift about 2 task(s) toward Diego Carrillo: Erick Sánchez has more In progress tasks than the team.',
          },
        ],
        developerInsights: [
          {
            developerName: 'Erick Sánchez',
            overloaded: true,
            suggestedMoveTo: 'Jimena Díaz',
            suggestedTasksToMove: 2,
          },
        ],
      },
      {
        teamDevelopers: [
          { name: 'Erick Sánchez', assigned: 4, completed: 1, pending: 3 },
          { name: 'Jimena Díaz', assigned: 1, completed: 1, pending: 0 },
          { name: 'Diego Carrillo', assigned: 2, completed: 2, pending: 0 },
        ],
      },
    );
    const workload = list.filter((r) => r.category === 'workload_redistribution');
    expect(workload).toHaveLength(1);
    expect(workload[0].text).toMatch(/Shift about 2 task/);
    expect(workload[0].text).not.toMatch(/Move ~2 task\(s\) from Erick/);
  });

  it('adds redistribution when Team overload flag exists without workloadRecommendations', () => {
    const list = computeRecommendationList({
      actionableRecommendations: [],
      workloadRecommendations: [],
      developerInsights: [
        {
          developerName: 'Bob',
          overloaded: true,
          suggestedMoveTo: 'Alice',
          suggestedTasksToMove: 2,
          insight: 'Open tasks exceed team average.',
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0].category).toBe('workload_redistribution');
    expect(list[0].text).toMatch(/Move ~2 task\(s\) from Bob to Alice/);
  });

  it('does not duplicate API workload row for same move', () => {
    const list = computeRecommendationList({
      workloadRecommendations: [{ from: 'Bob', to: 'Alice', tasksToMove: 2, reason: 'API' }],
      developerInsights: [
        {
          developerName: 'Bob',
          overloaded: true,
          suggestedMoveTo: 'Alice',
          suggestedTasksToMove: 2,
        },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0].text).toMatch(/from Bob to Alice/);
  });

  it('shows generic balanced workload when no redistribution is needed', () => {
    const list = computeRecommendationList(
      {
        actionableRecommendations: [
          { category: 'planning', text: 'Review the remaining To do items.' },
        ],
        developerInsights: [
          {
            developerName: 'Erick Sánchez',
            overloaded: false,
            insight: 'Completed 2 assignments, all finished on or before the due date.',
          },
        ],
      },
      {
        teamDevelopers: [{ name: 'Erick Sánchez', assigned: 2, completed: 2, pending: 0 }],
      },
    );
    const workload = list.filter((r) => r.category === 'workload_redistribution');
    expect(workload).toHaveLength(1);
    expect(workload[0].text).toMatch(/balanced across developers/i);
  });

  it('shows explicit move (not generic) when Team marks overload after regenerate', () => {
    const list = computeRecommendationList(
      {
        actionableRecommendations: [
          {
            category: 'workload_redistribution',
            text: 'Current task status distribution is balanced across developers. Keep assignments stable and focus on unblocking tasks in In progress/In review.',
          },
          { category: 'planning', text: 'Review the remaining To do items.' },
        ],
        workloadRecommendations: [],
        developerInsights: [
          {
            developerName: 'Erick Sánchez',
            overloaded: true,
            suggestedMoveTo: 'Diego Carrillo',
            suggestedTasksToMove: 1,
            insight:
              'Completed 2 assignments, all finished on or before the due date. Flagged as overloaded — consider moving ~1 task(s) to Diego Carrillo.',
          },
          { developerName: 'Diego Carrillo', overloaded: false },
        ],
      },
      {
        teamDevelopers: [
          { name: 'Erick Sánchez', assigned: 2, completed: 2, pending: 0 },
          { name: 'Diego Carrillo', assigned: 1, completed: 1, pending: 0 },
        ],
      },
    );
    const workload = list.filter((r) => r.category === 'workload_redistribution');
    expect(workload).toHaveLength(1);
    expect(workload[0].text).toMatch(/Move ~1 task\(s\) from Erick Sánchez to Diego Carrillo/);
    expect(workload[0].text).not.toMatch(/balanced across developers/i);
  });

  it('keeps a single explicit move when overload has pending work', () => {
    const list = computeRecommendationList(
      {
        actionableRecommendations: [
          {
            category: 'workload_redistribution',
            text: 'Current task status distribution is balanced across developers. Keep assignments stable.',
          },
        ],
        developerInsights: [
          {
            developerName: 'Erick Sánchez',
            overloaded: true,
            suggestedMoveTo: 'Ana López',
            suggestedTasksToMove: 1,
            insight: '2 open assignment rows remain.',
          },
        ],
      },
      {
        teamDevelopers: [
          { name: 'Erick Sánchez', assigned: 4, completed: 2, pending: 2 },
          { name: 'Ana López', assigned: 1, completed: 1, pending: 0 },
        ],
      },
    );
    const workload = list.filter((r) => r.category === 'workload_redistribution');
    expect(workload).toHaveLength(1);
    expect(workload[0].text).toMatch(/Move ~1 task\(s\) from Erick Sánchez to Ana López/);
  });

  it('rewrites API/Gemini move away from a high-hours receiver', () => {
    const team = [
      { name: 'Diego Carrillo', assigned: 2, completed: 0, pending: 2, hours: 12 },
      { name: 'Erick Sánchez', assigned: 2, completed: 1, pending: 1, hours: 40 },
      { name: 'Jimena Díaz', assigned: 1, completed: 0, pending: 1, hours: 4 },
    ];
    const refined = refineExplicitWorkloadRecommendation(
      {
        category: 'workload_redistribution',
        text:
          'Move ~1 task(s) from Diego Carrillo to Erick Sánchez: Diego Carrillo has 2 in "In progress" vs Erick Sánchez with 0 in that stage but 1 in To do (1 open overall); shifting ~1 task(s) spreads that stage more evenly.',
      },
      team,
      new Set(),
    );
    expect(refined.text).toMatch(/from Diego Carrillo to Jimena Díaz/);
    expect(refined.text).not.toMatch(/Erick Sánchez/);

    const list = computeRecommendationList(
      {
        workloadRecommendations: [
          {
            from: 'Diego Carrillo',
            to: 'Erick Sánchez',
            tasksToMove: 1,
            reason: 'Status spread',
          },
        ],
        developerInsights: [{ developerName: 'Diego Carrillo', overloaded: true }],
      },
      { teamDevelopers: team },
    );
    expect(list[0].text).toMatch(/from Diego Carrillo to Jimena Díaz/);
  });
});
