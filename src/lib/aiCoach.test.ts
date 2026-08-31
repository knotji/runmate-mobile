import { beforeEach, describe, expect, it, vi } from 'vitest';
import { askAiCoach, askAiCoachChat, bangkokDayPhase, buildAiCoachContext, clearAiCoachAnswerCache, coachOriginFromPath } from '@/lib/aiCoach';
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
      sleepPerformance: { state: 'scored', score: 74, actualSleepMinutes: 390, sleepNeedMinutes: 420, sleepDebtMinutes: 11 },
      fuelInsight: { status: 'top_up', summary: 'Add protein.' },
      sourceCoverage: { used: ['Sleep Duration'], missing: ['HRV'] },
    },
    ...overrides,
  } as unknown as CoachContext;
}

describe('buildAiCoachContext', () => {
  it('maps canonical navigation origins without guessing from standalone paths', () => {
    expect(coachOriginFromPath('/tabs/today')).toBe('today');
    expect(coachOriginFromPath('/tabs/health')).toBe('health');
    expect(coachOriginFromPath('/tabs/move')).toBe('move');
    expect(coachOriginFromPath('/tabs/you')).toBe('you');
    expect(coachOriginFromPath('/nutrition-trends')).toBe('unknown');
    expect(coachOriginFromPath()).toBe('unknown');
  });

  it('sends compact coaching facts without raw records or account fields', () => {
    const source = buildContext();

    const result = buildAiCoachContext(source);
    const serialized = JSON.stringify(result);

    expect(result.recovery.score).toBe(72);
    expect(result.timeBangkok).toMatch(/^\d{2}:\d{2}$/);
    expect(['morning', 'midday', 'evening', 'night']).toContain(result.dayPhaseBangkok);
    expect(result.recovery.sleepDuration).toBe('6h 30m');
    expect(result.recovery.sleepNeed).toBe('7h');
    expect(result.recovery.currentSleepGap).toBe('30m');
    expect(result.recovery.accumulatedSleepDebt).toBe('11m');
    expect(result.recovery).not.toHaveProperty('sleepShortfall');
    expect(result.recentTraining.runDistanceKm7d).toBe(12.3);
    expect(result.nutritionToday?.foods).toEqual(['Rice', 'Egg']);
    expect(result.nutritionToday?.mealLog).toEqual([{ type: 'Lunch', foods: ['Rice', 'Egg'], caloriesKcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined }]);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('secretNote');
    expect(serialized).not.toContain('profile');
  });

  it('classifies the current Bangkok part of day for time-aware guidance', () => {
    expect(bangkokDayPhase(new Date('2026-07-28T00:54:00Z'))).toBe('morning');
    expect(bangkokDayPhase(new Date('2026-07-28T06:00:00Z'))).toBe('midday');
    expect(bangkokDayPhase(new Date('2026-07-28T12:00:00Z'))).toBe('evening');
    expect(bangkokDayPhase(new Date('2026-07-28T16:00:00Z'))).toBe('night');
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

  it('keeps contextual answers separate and sends the originating surface', async () => {
    invoke.mockResolvedValue({ data: { data: { headline: 'Contextual', summary: 'Answer.' } }, error: null });
    const context = buildContext();

    await askAiCoach('today', context, undefined, { origin: 'today' });
    await askAiCoach('today', context, undefined, { origin: 'health' });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke).toHaveBeenNthCalledWith(1, 'ai-coach', expect.objectContaining({
      body: expect.objectContaining({ origin: 'today' }),
    }));
    expect(invoke).toHaveBeenNthCalledWith(2, 'ai-coach', expect.objectContaining({
      body: expect.objectContaining({ origin: 'health' }),
    }));
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

  it('preserves a natural conversational message from the coach service', async () => {
    invoke.mockResolvedValue({ data: { data: { message: 'ได้เลยครับ วันนี้คุยเรื่องอะไรกันดี?' } }, error: null });

    const answer = await askAiCoachChat('คุยเรื่องอื่นได้ไหม', buildContext());

    expect(answer.message).toBe('ได้เลยครับ วันนี้คุยเรื่องอะไรกันดี?');
  });

  it('does not append a legacy meal card to a non-food answer', async () => {
    invoke.mockResolvedValue({
      data: {
        data: {
          headline: 'พักให้สดชื่น',
          summary: 'วันนี้เหมาะกับการพักครับ',
          actions: ['ดื่มน้ำให้เพียงพอ'],
          nextMeal: { title: 'มื้อถัดไป', options: ['ข้าวกับไข่'] },
        },
      },
      error: null,
    });

    const answer = await askAiCoach('today', buildContext());

    expect(answer.message).toContain('ดื่มน้ำให้เพียงพอ');
    expect(answer.message).not.toContain('มื้อถัดไป');
    expect(answer.message).not.toContain('ข้าวกับไข่');
  });

  it('sends only the latest eight conversation turns for a follow-up question', async () => {
    invoke.mockResolvedValue({ data: { data: { message: 'ต่อจากเมื่อกี้ได้เลยครับ' } }, error: null });
    const conversation = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
      content: `turn-${index}`,
    }));

    await askAiCoachChat('แล้วพรุ่งนี้ล่ะ', buildContext(), conversation);

    expect(invoke).toHaveBeenCalledWith('ai-coach', expect.objectContaining({
      body: expect.objectContaining({
        userQuery: 'แล้วพรุ่งนี้ล่ะ',
        history: conversation.slice(-8),
      }),
    }));
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

describe('a response carrying WholeMate-only keys', () => {
  beforeEach(() => {
    invoke.mockReset();
    clearAiCoachAnswerCache();
  });

  // `planProposal` was added to the shared ai-coach function for WholeMate,
  // which has a plan to apply it to. RunMate has no such surface, so the key
  // must be inert here: the answer reads the same as it did before the server
  // learned to send one, and nothing leaks into the object the UI renders.
  it('answers identically whether or not a planProposal is present', async () => {
    const base = { headline: 'Go Easy', summary: 'Take it easy today.', message: 'พักวันนี้ก่อนนะครับ' };

    invoke.mockResolvedValue({ data: { data: base }, error: null });
    const without = await askAiCoach('today', buildContext());

    clearAiCoachAnswerCache();
    invoke.mockResolvedValue({
      data: {
        data: {
          ...base,
          planProposal: { day: 'Sunday', workoutType: 'Rest', durationMin: 0, description: 'พักเต็มวัน' },
        },
      },
      error: null,
    });
    const withProposal = await askAiCoach('today', buildContext());

    expect({ ...withProposal, generatedAt: null }).toEqual({ ...without, generatedAt: null });
    expect(withProposal).not.toHaveProperty('planProposal');
    expect(withProposal.message).toBe('พักวันนี้ก่อนนะครับ');
  });

  it('still answers when a malformed planProposal arrives', async () => {
    invoke.mockResolvedValue({
      data: { data: { headline: 'Go Easy', summary: 'Take it easy.', planProposal: 'not an object' } },
      error: null,
    });

    const answer = await askAiCoach('today', buildContext());

    expect(answer.headline).toBe('Go Easy');
  });
});
