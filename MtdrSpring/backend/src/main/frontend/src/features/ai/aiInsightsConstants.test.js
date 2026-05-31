import { describe, expect, it } from 'vitest';
import {
  alignAlertLoosePercents,
  alignKpiMetricsInText,
  alignKpiProseForMetric,
  alignSingleMetricBlock,
  stripContradictoryOnTimeDecline,
  reconcileOnTimeDeliveryConcernProse,
} from './aiInsightsConstants';

describe('aiInsightsConstants KPI alignment', () => {
  it('aligns on-time delivery "currently at" far from the label', () => {
    const text =
      'On-Time Delivery has declined for three consecutive sprints, currently at 63%.';
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

  it('keeps a space after percent (avoids "0as" in manager guide)', () => {
    const out = alignKpiProseForMetric(
      'Team participation is 0% as work has not yet commenced on the assigned tasks.',
      'teamParticipation',
      { teamParticipation: 0 },
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
});
