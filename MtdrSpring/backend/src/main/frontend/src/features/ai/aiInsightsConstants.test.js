import { describe, expect, it } from 'vitest';
import {
  alignAlertLoosePercents,
  alignKpiMetricsInText,
  alignKpiProseForMetric,
  alignCompletionRatePercentLabels,
  alignSingleMetricBlock,
  stripContradictoryOnTimeDecline,
  reconcileOnTimeDeliveryConcernProse,
  resolveProductivityPredictionDisplay,
  formatProductivityForecastDeltaLine,
  alignProductivityTrendDelta,
} from './aiInsightsConstants';

describe('aiInsightsConstants KPI alignment', () => {
  it('aligns on-time delivery "currently at" far from the label', () => {
    const text = 'On-Time Delivery has declined for three consecutive sprints, currently at 63%.';
    const out = alignKpiProseForMetric(text, 'onTimeDelivery', { onTimeDelivery: 83 });
    expect(out).toContain('currently at 83%');
    expect(out).not.toContain('63%');
  });

  it('aligns productivity score prose to card value', () => {
    const text = 'The overall productivity score is currently at 73.4 points.';
    const out = alignKpiProseForMetric(text, 'productivityScore', { productivityScore: 78 });
    expect(out).toMatch(/78\s*%/);
    expect(out).not.toContain('73.4');
  });

  it('alignKpiMetricsInText updates tight on-time pattern', () => {
    const out = alignKpiMetricsInText('On-time delivery is at 63%.', { onTimeDelivery: 83 });
    expect(out).toBe('On-time delivery is at 83%.');
  });

  it('alignCompletionRatePercentLabels rewrites on-time % mislabeled as completion', () => {
    const out = alignCompletionRatePercentLabels(
      'The team achieved a 93% completion rate and a strong on-time delivery performance this sprint.',
      { completionRate: 68, onTimeDelivery: 93 },
    );
    expect(out.toLowerCase()).toContain('93% on-time delivery');
    expect(out.toLowerCase()).not.toContain('93% completion rate');
  });

  it('resolveProductivityPredictionDisplay marks down when forecast is below current sprint', () => {
    const resolved = resolveProductivityPredictionDisplay(
      { predictedScore: 47, trend: 'up', reasoning: 'Improved vs last sprint.' },
      { productivityScore: 68, completionRate: 70, onTimeDelivery: 100 },
    );
    expect(resolved.predictedScore).toBe(47);
    expect(resolved.trend).toBe('down');
    expect(resolved.deltaVsCurrent).toBe(-21);
    expect(formatProductivityForecastDeltaLine(resolved)).toContain('vs current sprint (68%)');
  });

  it('resolveProductivityPredictionDisplay marks up when forecast exceeds current sprint', () => {
    const resolved = resolveProductivityPredictionDisplay(
      { predictedScore: 82, trend: 'down' },
      { productivityScore: 68 },
    );
    expect(resolved.trend).toBe('up');
    expect(resolved.deltaVsCurrent).toBe(14);
  });

  it('resolveProductivityPredictionDisplay marks down for a 2-point drop (85 vs 87)', () => {
    const resolved = resolveProductivityPredictionDisplay(
      { predictedScore: 85, trend: 'stable' },
      { productivityScore: 87 },
    );
    expect(resolved.trend).toBe('down');
    expect(resolved.deltaVsCurrent).toBe(-2);
    expect(formatProductivityForecastDeltaLine(resolved)).toBe(
      '−2 points vs current sprint (87%)',
    );
  });

  it('resolveProductivityPredictionDisplay stays stable only when scores match', () => {
    const resolved = resolveProductivityPredictionDisplay(
      { predictedScore: 87, trend: 'down' },
      { productivityScore: 87 },
    );
    expect(resolved.trend).toBe('stable');
    expect(formatProductivityForecastDeltaLine(resolved)).toBe(
      'About the same as current sprint (87%)',
    );
  });

  it('does not swap productivity score into on-time improvement clause', () => {
    const out = alignKpiMetricsInText(
      'Productivity increased by 6 points compared to the previous sprint, driven by a 97% improvement in on-time delivery.',
      { productivityScore: 97, onTimeDelivery: 71 },
    );
    expect(out.toLowerCase()).toContain('with on-time delivery at 71%');
    expect(out.toLowerCase()).not.toContain('97% improvement in on-time');
  });

  it('realigns legacy participation prose to efficiency score card value', () => {
    const raw =
      'A participation score of 2.0 indicates a focused team effort on the assigned sprint goals.';
    const out = alignSingleMetricBlock(raw, 'efficiencyScore', 85);
    expect(out.toLowerCase()).toContain('efficiency');
    expect(out).toContain('85%');
    expect(out).not.toContain('2.0');
    expect(out).not.toMatch(/participation score of 2/i);
  });

  it('keeps a space after percent (avoids "0as" in manager guide)', () => {
    const out = alignKpiProseForMetric(
      'Efficiency score is 0% as work has not yet commenced on the assigned tasks.',
      'efficiencyScore',
      { efficiencyScore: 0 },
    );
    expect(out).toMatch(/0%\s+as/i);
    expect(out).not.toMatch(/0as/i);
  });

  it('alignAlertLoosePercents replaces currently at', () => {
    expect(alignAlertLoosePercents('currently at 63%', 83)).toBe('currently at 83%');
  });

  it('alignSingleMetricBlock fixes Gemini manager-guide phrasing', () => {
    const text =
      'The current completion rate of 13% reflects the early stage of the sprint where most work is still in progress.';
    const out = alignSingleMetricBlock(text, 'completionRate', 42);
    expect(out).toContain('completion rate of 42%');
    expect(out).not.toContain('13%');
  });

  it('alignSingleMetricBlock fixes workload balance score phrasing', () => {
    const text =
      'The workload balance score of 96% shows that tasks are currently distributed fairly across the team.';
    const out = alignSingleMetricBlock(text, 'workloadBalance', 97);
    expect(out).toContain('workload balance score of 97%');
    expect(out).not.toContain('96%');
  });

  it('reconcileOnTimeDeliveryConcernProse removes primary concern at 100%', () => {
    const text =
      'On-Time Delivery is the primary concern, having is at 100%. Prioritizing blocked tasks is essential.';
    const out = reconcileOnTimeDeliveryConcernProse(text, 100);
    expect(out.toLowerCase()).not.toContain('primary concern');
    expect(out).not.toContain('having is at');
    expect(out).toContain('100%');
    expect(out).toContain('blocked tasks');
  });

  it('stripContradictoryOnTimeDecline removes false decline at 100%', () => {
    const text =
      'On-Time Delivery has declined for three consecutive sprints, currently at 100%. Focus on tasks.';
    const out = stripContradictoryOnTimeDecline(text, 100);
    expect(out.toLowerCase()).not.toContain('declined');
    expect(out).toContain('Focus on tasks');
  });

  it('alignProductivityTrendDelta replaces relative percent with score points', () => {
    const text =
      'Productivity decreased by 24% compared to the previous sprint as work is still in progress.';
    const out = alignProductivityTrendDelta(text, -15);
    expect(out).toContain('decreased by 15 points');
    expect(out).not.toContain('24%');
    expect(out).toContain('work is still in progress');
  });
});
