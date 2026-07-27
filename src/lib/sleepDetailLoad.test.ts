import { describe, expect, it } from 'vitest';
import type { CoachContext } from './buildCoachContext';
import { requiresFullSleepHistory } from './sleepDetailLoad';

function contextWithDates(...dates: string[]): CoachContext {
  return {
    sleepHistory: dates.map((date) => ({ date })),
  } as CoachContext;
}

describe('Sleep Detail loading', () => {
  it('uses the bounded Recovery context for the latest or an available night', () => {
    const context = contextWithDates('2026-07-27', '2026-07-26');
    expect(requiresFullSleepHistory(context, null)).toBe(false);
    expect(requiresFullSleepHistory(context, '2026-07-26')).toBe(false);
  });

  it('requests full history only for an older selected night missing from the bounded context', () => {
    expect(requiresFullSleepHistory(contextWithDates('2026-07-27'), '2026-05-01')).toBe(true);
  });
});
