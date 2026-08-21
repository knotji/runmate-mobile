import { describe, expect, it } from 'vitest';
import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';
import { buildTodayBrief } from '@/lib/todayBrief';

function night(date: string, values: Partial<WeekSleepRow> = {}): WeekSleepRow {
  return {
    date,
    durationH: '7h',
    durationMinutes: 420,
    score: 75,
    readiness: null,
    restingHR: 52,
    hrv: 60,
    energyScore: null,
    sleepStartTime: null,
    sleepEndTime: null,
    timeInBedMinutes: 450,
    respiratoryRate: null,
    awakeMinutes: 20,
    remMinutes: null,
    lightMinutes: null,
    deepMinutes: null,
    ...values,
  };
}

function context(values: Partial<CoachContext> = {}): CoachContext {
  const latest = night('2026-07-31');
  return {
    todayDate: '2026-07-31',
    sleep7d: [latest],
    sleepHistory: [latest],
    sleepBaseline30d: [
      latest,
      night('2026-07-30'),
      night('2026-07-29', { awakeMinutes: 24, hrv: 62, restingHR: 53 }),
      night('2026-07-28', { awakeMinutes: 16, hrv: 58, restingHR: 51 }),
    ],
    mealsToday: [],
    todayWorkouts: [],
    todayPrimaryWorkout: null,
    recoverySystem: {
      overallScore: 72,
      scoreState: 'scored',
      dataFreshness: { status: 'today' },
      sleepPerformance: { score: 76, actualSleepMinutes: 420, sleepNeedMinutes: 450 },
    },
    ...values,
  } as unknown as CoachContext;
}

const options = { planned: null, recommendation: null, planStatus: null, dailyAction: null };

describe('buildTodayBrief', () => {
  it('uses total awake minutes as a limiter without inventing an awakening count', () => {
    const latest = night('2026-07-31', { awakeMinutes: 58 });
    const brief = buildTodayBrief(context({ sleep7d: [latest], sleepHistory: [latest] }), options);

    expect(brief.limiter.title).toBe('58 Min Awake During Sleep');
    expect(brief.limiter.summary).toContain('+38 min');
    expect(JSON.stringify(brief)).not.toMatch(/times|ครั้ง/i);
  });

  it('finds caffeine in a late meal and labels log time as unconfirmed consumption time', () => {
    const latest = night('2026-07-31', { awakeMinutes: 58 });
    const brief = buildTodayBrief(context({
      sleep7d: [latest],
      sleepHistory: [latest],
      mealsToday: [{
        mealType: 'Snack',
        foods: ['Iced Americano'],
        loggedAt: '2026-07-31T08:30:00.000Z',
        caloriesKcal: 10,
        proteinG: 0,
        carbsG: 2,
        fatG: 0,
        fiberG: null,
        fatLoad: null,
        coachNote: null,
      }],
    }), options);

    expect(brief.action.title).toBe('No More Caffeine Today');
    expect(brief.action.summary).toBe('Last caffeine logged at 3:30 PM.');
    expect(brief.action.summary).not.toContain('Consumption time');
    expect(brief.evidence.find((item) => item.eyebrow === 'Caffeine Signal')?.title).toContain('Iced Americano');
    expect(brief.evidence.find((item) => item.eyebrow === 'Caffeine Signal')?.summary).toContain('Consumption time was not confirmed');
  });

  it('uses personal HRV baseline when awake time is not elevated', () => {
    const latest = night('2026-07-31', { awakeMinutes: 22, hrv: 48 });
    const brief = buildTodayBrief(context({ sleep7d: [latest], sleepHistory: [latest] }), options);

    expect(brief.limiter.title).toBe('HRV Below Your Baseline');
    expect(brief.limiter.summary).toContain('48 ms');
  });

  it('does not name a physiological limiter when fresh sleep is unavailable', () => {
    const base = context();
    const brief = buildTodayBrief(context({
      sleep7d: [],
      sleepHistory: [],
      recoverySystem: {
        ...base.recoverySystem,
        scoreState: 'stale',
        dataFreshness: { status: 'stale', latestSleepDate: '2026-07-30', ageDays: 1 },
      },
    }), options);

    expect(brief.readiness.title).toBe('Waiting For Fresh Sleep Data');
    expect(brief.limiter.title).toBe('Latest Sleep Is Missing');
    // Regression: sleepPerformance.score is a placeholder 0 (not a real low score) when
    // state is 'unscorable' — the action card must not fabricate "Protect Tonight's
    // Sleep Window" while the WHY card is simultaneously saying sleep data is missing.
    expect(brief.action.title).not.toBe('Protect Tonight’s Sleep Window');
  });

  it('does not treat an unscorable placeholder Sleep Performance score as a real low score for the action card', () => {
    const base = context();
    const brief = buildTodayBrief(context({
      recoverySystem: {
        ...base.recoverySystem,
        sleepPerformance: { score: 0, state: 'unscorable', actualSleepMinutes: null, sleepNeedMinutes: 450 },
      } as unknown as CoachContext['recoverySystem'],
    }), options);

    expect(brief.action.title).not.toBe('Protect Tonight’s Sleep Window');
    expect(brief.action.title).toBe('Keep Today Steady');
  });

  it('puts a logged safety signal ahead of lower-priority sleep explanations', () => {
    const latest = night('2026-07-31', { awakeMinutes: 58, hrv: 40 });
    const brief = buildTodayBrief(context({ activePain: true, sleep7d: [latest], sleepHistory: [latest] }), options);

    expect(brief.limiter.title).toBe('Active Pain Takes Priority');
    expect(brief.limiter.summary).not.toMatch(/diagnos|injury caused/i);
  });

  it('aligns Body Status with the Today\'s Focus badge instead of re-deriving it from overallScore alone (regression: showed "Reduce Load" badge next to "Ready For A Normal Day" body status when the trigger was sleep performance, not the composite score)', () => {
    // overallScore alone (72) clears the >=67 "normal day" threshold, but
    // dailyRecommendation.ts also reduces on a low sleep-performance sub-score,
    // strain, or heavy weekly load — Body Status must follow that, not the score.
    const brief = buildTodayBrief(context(), { ...options, dailyAction: 'reduce' });
    expect(brief.readiness.title).toBe('Keep Today Controlled');
  });

  it('labels a partial baseline as calibration rather than full readiness', () => {
    const base = context();
    const brief = buildTodayBrief(context({
      recoverySystem: { ...base.recoverySystem, scoreState: 'calibrating' },
    }), options);

    expect(brief.readiness.title).toBe('Recovery Is Still Calibrating');
  });

  it('states the concrete planned session in One Adjustment when keeping the plan as-is, instead of a generic instruction', () => {
    const planned = { workoutType: 'Easy Run', distanceKm: 5, durationMin: 40, targetPace: '', targetHR: '', description: '', day: 'Monday' };
    const brief = buildTodayBrief(context(), { ...options, planned });

    expect(brief.action.title).toBe('Easy Run · 5 km · 40 min');
    expect(brief.action.summary).toBe('Complete Easy Run · 5 km · 40 min as written, without adding extra distance or intensity.');
  });

  it('does not invent a distance/duration for a planned rest day', () => {
    const planned = { workoutType: 'Rest', distanceKm: null, durationMin: null, targetPace: '', targetHR: '', description: '', day: 'Monday' };
    const brief = buildTodayBrief(context(), { ...options, planned });

    expect(brief.action.title).toBe('Rest Day');
    expect(brief.action.summary).toBe('Today is a scheduled rest day — no training planned.');
  });

  it('still lets an adaptive recommendation override the concrete plan title when the plan is actually being adjusted', () => {
    const planned = { workoutType: 'Tempo Run', distanceKm: 8, durationMin: 45, targetPace: '', targetHR: '', description: '', day: 'Monday' };
    const recommendation = { action: 'swap', headline: 'Swap Tempo For Easy', summary: 'Recovery favors an easy day instead.', reasons: [], suggestedWorkout: planned } as unknown as NonNullable<Parameters<typeof buildTodayBrief>[1]['recommendation']>;
    const brief = buildTodayBrief(context(), { ...options, planned, recommendation });

    expect(brief.action.title).toBe('Swap Tempo For Easy');
  });
});
