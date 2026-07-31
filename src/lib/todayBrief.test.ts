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

const options = { planned: null, recommendation: null, planStatus: null };

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
  });
});
