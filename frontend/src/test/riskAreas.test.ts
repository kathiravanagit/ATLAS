import { describe, expect, it } from 'vitest';
import { riskArea, areaPrimary, areaSecondary, SCORE_TOOLTIP } from '../lib/riskAreas';

describe('riskAreas', () => {
  it('bands a full list as priority/watch/background', () => {
    expect([1, 2, 3].map(r => riskArea(r, 12))).toEqual(['priority', 'priority', 'priority']);
    expect([4, 10].map(r => riskArea(r, 12))).toEqual(['watch', 'watch']);
    expect([11, 12].map(r => riskArea(r, 12))).toEqual(['background', 'background']);
  });

  it('scales bands proportionally for short lists', () => {
    expect([1, 2, 3, 4, 5].map(r => riskArea(r, 5))).toEqual(
      ['priority', 'priority', 'watch', 'watch', 'background']);
    expect(riskArea(1, 1)).toBe('priority');
  });

  it('prefers backend areas but falls back to rank', () => {
    expect(riskArea(9, 12, 'priority')).toBe('priority');
    expect(riskArea(9, 12, 'nonsense')).toBe('watch');
    expect(riskArea(9, 12)).toBe('watch');
  });

  it('uses exact zone wording without probability claims', () => {
    expect(areaPrimary('priority', 1, 12)).toBe('Priority zone · Rank #1 of 12');
    expect(areaPrimary('watch', 5, 12)).toBe('Watch zone · Rank #5 of 12');
    expect(areaPrimary('background', 12, 12)).toBe('Background · Rank #12 of 12');
    const sub = areaSecondary('priority', 100, 94.9);
    expect(sub).toContain('Display score 100');
    expect(sub).toContain('Uncalibrated model score 94.9');
    expect(sub).toContain('not a real-world probability');
    expect(sub).not.toMatch(/chance|probability of/i);
  });

  it('tooltip disclaims probability everywhere', () => {
    expect(SCORE_TOOLTIP).toContain('not the probability');
    expect(SCORE_TOOLTIP).toContain('Priority / Watch / Background');
  });
});
