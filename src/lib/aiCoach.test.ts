import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askAiCoach, buildAiCoachContext, clearAiCoachAnswerCache } from '@/lib/aiCoach';
import type { CoachContext } from '@/lib/buildCoachContext';

const invoke = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

function buildContext(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    todayDate: '2026-07-20',
    profile: { email: 'private@example.com', secretNote: 'do not send' },
    raceGoal: null,
    racePlan: null,
    activeRaceGoal: null,
    activeRaceStatus: 'none',
    raceName: null,
    raceDate: null,
    raceDistance: null,
    daysUntilRace: null,
    targetTime: null,
    todayWorkouts: [],
    totalSessions: 3,
    totalRunKm: 12.34,
    runDays7d: 2,
    longestRun7dKm: 7,
    lastWorkoutDate: '2026-07-19',
    nutritionToday: { mealCount: 2, caloriesKcal: 1200, proteinG: 80, carbsG: 130, fatG: 40 },
    mealsToday: [{ foods: ['Rice', 'Egg'], mealType: 'Lunch' }],
    activePain: false,
    recentMaxPain: null,
    latestPain: null,
    activeSick: false,
    sickRiskLevel: 'low',
    recoverySystem: {
      scoreState: 'scored', overallScore: 72, overallLabel: 'Good',
      dataFreshness: { status: 'today' },
      strain: { score: 4.24, estimated: true },
      sleepPerformance: { state: 'scored', score: 74, actualSleepMinutes: 390, sleepNeedMinutes: 420, sleepDebtMinutes: 30 },
      fuelInsight: { status: 'top_up', summary: 'Add protein.' },
      sourceCoverage: { used: ['Sleep Duration'], missing: ['HRV'] },
    },
    ...overrides,
  } as unknown as CoachContext;
}

describe('buildAiCoachContext', () => {
  it('sends compact coaching facts without raw records or account fields', () => {
    const source = buildContext();

    const result = buildAiCoachContext(source);
    const serialized = JSON.stringify(result);

    expect(result.recovery.score).toBe(72);
    expect(result.recovery.sleepDuration).toBe('6h 30m');
    expect(result.recovery.sleepNeed).toBe('7h');
    expect(result.recovery.sleepShortfall).toBe('30m');
    expect(result.recentTraining.runDistanceKm7d).toBe(12.3);
    expect(result.nutritionToday?.foods).toEqual(['Rice', 'Egg']);
    expect(result.nutritionToday?.mealLog).toEqual([{ type: 'Lunch', foods: ['Rice', 'Egg'], caloriesKcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined }]);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('secretNote');
    expect(serialized).not.toContain('profile');
  });
});

describe('askAiCoach caching', () => {
  beforeEach(() => {
    invoke.mockReset();
    clearAiCoachAnswerCache();
  });

  it('reuses a cached answer for the same topic and unchanged context', async () => {
    invoke.mockResolvedValue({ data: { data: { headline: 'Go Easy', summary: 'Take it easy today.' } }, error: null });
    const context = buildContext();

    const first = await askAiCoach('today', context);
    const second = await askAiCoach('today', context);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(first.headline).toBe('Go Easy');
  });

  it('refetches when the underlying Coach Context changes', async () => {
    invoke.mockResolvedValue({ data: { data: { headline: 'Go Easy', summary: 'Take it easy today.' } }, error: null });

    await askAiCoach('today', buildContext());
    await askAiCoach('today', buildContext({ totalRunKm: 20 }));

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('bypasses the cache when forced, for a Refresh Answer action', async () => {
    invoke.mockResolvedValue({ data: { data: { headline: 'Go Easy', summary: 'Take it easy today.' } }, error: null });
    const context = buildContext();

    await askAiCoach('today', context);
    await askAiCoach('today', context, undefined, { force: true });

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('never caches freeform chat questions', async () => {
    invoke.mockResolvedValue({ data: { data: { headline: 'Sure', summary: 'Here is an answer.' } }, error: null });
    const context = buildContext();

    await askAiCoach('chat', context, 'What should I eat?');
    await askAiCoach('chat', context, 'What should I eat?');

    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('does not cache a degraded local fallback answer after a failed call', async () => {
    invoke.mockRejectedValue(new Error('network down'));
    const context = buildContext();

    const first = await askAiCoach('today', context);
    invoke.mockResolvedValue({ data: { data: { headline: 'Go Easy', summary: 'Take it easy today.' } }, error: null });
    const second = await askAiCoach('today', context);

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(first.headline).not.toBe('Go Easy');
    expect(second.headline).toBe('Go Easy');
  });
});
