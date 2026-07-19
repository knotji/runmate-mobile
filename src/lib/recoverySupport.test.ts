import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildSupportCards } from '@/lib/recoverySupport';

function supportContext(input?: {
  activePain?: boolean;
  sick?: boolean;
  fuel?: 'ready' | 'top_up' | 'low' | 'unknown';
  strain?: number;
  scoreState?: 'scored' | 'calibrating' | 'unscorable' | 'stale';
}): CoachContext {
  return {
    activePain: input?.activePain ?? false,
    latestSick: input?.sick ? { healthStatus: 'sick' } : null,
    recoverySystem: {
      fuelInsight: { status: input?.fuel ?? 'ready' },
      strain: { score: input?.strain ?? 0 },
      scoreState: input?.scoreState ?? 'scored',
    },
  } as CoachContext;
}

describe('buildSupportCards', () => {
  it('keeps hydration and data coverage visible when no alert is active', () => {
    expect(buildSupportCards(supportContext()).map((card) => card.category)).toEqual(['hydration', 'data']);
  });

  it('keeps priority order and limits the carousel to three cards', () => {
    const cards = buildSupportCards(supportContext({ activePain: true, fuel: 'low', strain: 16, scoreState: 'stale' }));
    expect(cards.map((card) => card.category)).toEqual(['body', 'fuel', 'hydration']);
  });

  it('uses one data card for missing recovery information', () => {
    const cards = buildSupportCards(supportContext({ scoreState: 'unscorable', fuel: 'unknown' }));
    expect(cards).toHaveLength(2);
    expect(cards[1]).toMatchObject({ category: 'data', title: 'Recovery Is Still Calibrating' });
  });
});
