import { describe, expect, it } from 'vitest';
import type { CoachContext } from './buildCoachContext';
import type { RunMateRecoverySystem } from './recoverySystem';
import { guardCoachContextFreshness } from './aiCoachFreshness';

const context = {
  recoverySystem: {
    scoreState: 'scored',
    dataFreshness: { status: 'today', latestSleepDate: '2026-07-30', ageDays: 0 },
    guardrails: [],
  } as unknown as RunMateRecoverySystem,
} as CoachContext;

describe('AI Coach freshness guard', () => {
  it('leaves fresh context unchanged', () => {
    expect(guardCoachContextFreshness(context, 'fresh')).toBe(context);
  });

  it('marks cached context stale so training load is not adapted', () => {
    const guarded = guardCoachContextFreshness(context, 'fallback');
    expect(guarded.recoverySystem.scoreState).toBe('stale');
    expect(guarded.recoverySystem.dataFreshness.status).toBe('stale');
    expect(guarded.recoverySystem.guardrails.join(' ')).toContain('Do not increase or reduce');
  });
});
