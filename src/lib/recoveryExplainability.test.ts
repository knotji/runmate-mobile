import { describe, expect, it } from 'vitest';
import { buildCoachContext, type WeekSleepRow } from '@/lib/buildCoachContext';
import { buildRunMateRecoverySystem } from '@/lib/recoverySystem';
import { buildRecoveryExplainability } from '@/lib/recoveryExplainability';

const sleepNight = (date: string, overrides: Partial<WeekSleepRow> = {}): WeekSleepRow => ({
  date,
  durationH: '7h 30m',
  durationMinutes: 450,
  score: 82,
  readiness: null,
  restingHR: 55,
  hrv: 60,
  energyScore: null,
  sleepStartTime: `${date}T23:00:00+07:00`,
  sleepEndTime: `${date}T06:30:00+07:00`,
  timeInBedMinutes: 480,
  respiratoryRate: 15,
  awakeMinutes: 30,
  remMinutes: 90,
  lightMinutes: 240,
  deepMinutes: 90,
  ...overrides,
});

const dateBefore = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
};

describe('buildRecoveryExplainability', () => {
  it('returns unavailable instead of fabricating a breakdown from a stale night', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(dateBefore(context.todayDate, 1)),
      sleepNight(dateBefore(context.todayDate, 2)),
      sleepNight(dateBefore(context.todayDate, 3)),
      sleepNight(dateBefore(context.todayDate, 4)),
    ];
    context.sleepBaseline30d = context.sleep7d;
    const recovery = buildRunMateRecoverySystem(context);

    const explainability = buildRecoveryExplainability(recovery);

    expect(explainability.status).toBe('unavailable');
    if (explainability.status === 'unavailable') {
      expect(explainability.reason).toContain(dateBefore(context.todayDate, 1));
    }
  });

  it('separates helping and hurting factors from the same numbers the score used', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { hrv: 85, restingHR: 62 }),
      sleepNight(dateBefore(context.todayDate, 1), { hrv: 60, restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 2), { hrv: 60, restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 3), { hrv: 60, restingHR: 55 }),
    ];
    context.sleepBaseline30d = context.sleep7d;
    const recovery = buildRunMateRecoverySystem(context);

    const explainability = buildRecoveryExplainability(recovery);

    expect(explainability.status).toBe('ready');
    if (explainability.status === 'ready') {
      expect(explainability.helping.some((factor) => factor.key === 'hrv')).toBe(true);
      expect(explainability.hurting.some((factor) => factor.key === 'restingHR')).toBe(true);
    }
  });

  it('lists active pain ahead of other hurting factors', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { restingHR: 63 }),
      sleepNight(dateBefore(context.todayDate, 1), { restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 2), { restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 3), { restingHR: 55 }),
    ];
    context.sleepBaseline30d = context.sleep7d;
    context.activePain = true;
    context.latestPain = { painLevel: 6, redFlags: [] } as unknown as typeof context.latestPain;
    const recovery = buildRunMateRecoverySystem(context);

    const explainability = buildRecoveryExplainability(recovery);

    expect(explainability.status).toBe('ready');
    if (explainability.status === 'ready') {
      expect(explainability.hurting[0]?.key).toBe('pain');
    }
  });

  it('keeps a missing signal out of the hurting list', () => {
    const context = buildCoachContext();
    context.sleep7d = [sleepNight(context.todayDate, { hrv: null, restingHR: null, respiratoryRate: null })];
    context.sleepBaseline30d = context.sleep7d;
    const recovery = buildRunMateRecoverySystem(context);

    const explainability = buildRecoveryExplainability(recovery);

    expect(explainability.status).toBe('ready');
    if (explainability.status === 'ready') {
      expect(explainability.hurting.some((factor) => factor.key === 'hrv')).toBe(false);
      expect(explainability.unavailable.some((factor) => factor.key === 'hrv')).toBe(true);
    }
  });
});
