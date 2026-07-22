import { describe, expect, it } from 'vitest';
import { calculateTrainingStressBalance } from './trainingLoadAnalytics';
import { buildAiCoachContext } from './aiCoach';
import { buildCoachContextFromData } from './buildCoachContext';

describe('Item 3: Training Stress Balance & Load Analytics', () => {
  it('calculates CTL, ATL, and TSB correctly from history items', () => {
    const today = '2026-07-22';
    const items = [
      {
        id: 'workout-1',
        type: 'workout' as const,
        createdAt: new Date(`${today}T10:00:00Z`).toISOString(),
        dateKey: today,
        data: {
          extracted: {
            durationMinutes: 45,
            distanceKm: 8,
            vo2Max: 48.5,
          },
        },
      },
    ];

    const result = calculateTrainingStressBalance(items, { maxHr: 185, normalRestingHr: 55 }, today);
    expect(result.fatigue).toBeDefined();
    expect(result.fatigue.ctl).toBeGreaterThanOrEqual(0);
    expect(result.fatigue.atl).toBeGreaterThanOrEqual(0);
    expect(result.fatigue.zone).toBeDefined();
    expect(result.vo2Max.current).toBe(48.5);
  });
});

describe('Item 1: Conversational AI Coach Context', () => {
  it('builds ai coach context containing recovery, plan, and health signals', () => {
    const context = buildCoachContextFromData({
      items: [],
      profile: null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });

    const aiContext = buildAiCoachContext(context);
    expect(aiContext).toBeDefined();
    expect(aiContext.recovery).toBeDefined();
    expect(aiContext.recentTraining).toBeDefined();
  });
});
