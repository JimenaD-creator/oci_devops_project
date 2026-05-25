import { describe, expect, it } from 'vitest';
import {
  alignAlertLoosePercents,
  alignKpiMetricsInText,
  alignKpiProseForMetric,
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
});
