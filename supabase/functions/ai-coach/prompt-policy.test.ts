import { describe, expect, it } from 'vitest';
import { normalizeCoachOrigin, originInstruction } from './prompt-policy';

describe('AI Coach origin policy', () => {
  it('accepts only canonical product origins', () => {
    expect(normalizeCoachOrigin('today')).toBe('today');
    expect(normalizeCoachOrigin('health')).toBe('health');
    expect(normalizeCoachOrigin('move')).toBe('move');
    expect(normalizeCoachOrigin('you')).toBe('you');
    expect(normalizeCoachOrigin('/tabs/health')).toBe('unknown');
    expect(normalizeCoachOrigin(null)).toBe('unknown');
  });

  it('uses Health as evidence context without making it a race prompt', () => {
    const instruction = originInstruction('health');
    expect(instruction).toContain('measured health signals');
    expect(instruction).toContain('explicit current question always wins');
    expect(instruction.toLowerCase()).not.toContain('race');
  });
});
