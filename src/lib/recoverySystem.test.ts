import { describe, expect, it } from 'vitest';
import { buildCoachContext, type WeekSleepRow } from '@/lib/buildCoachContext';
import { buildRunMateRecoverySystem, getOverallDisplayStatus } from '@/lib/recoverySystem';

const sleepNight = (date: string, overrides: Partial<WeekSleepRow> = {}): WeekSleepRow => ({
  date,
  durationH: '7 ชม. 30 นาที',
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

describe('WHOOP-style Recovery Engine', () => {
  it('does not invent a Recovery score when sleep data is absent', () => {
    const recovery = buildRunMateRecoverySystem(null);

    expect(recovery.model).toBe('whoop_style_v1');
    expect(recovery.scoreState).toBe('unscorable');
    expect(recovery.overallScore).toBe(0);
    expect(recovery.strain.scaleMax).toBe(21);
  });

  it('uses personal HRV and RHR baselines after calibration', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { hrv: 72, restingHR: 51 }),
      sleepNight(dateBefore(context.todayDate, 1), { hrv: 60, restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 2), { hrv: 62, restingHR: 54 }),
      sleepNight(dateBefore(context.todayDate, 3), { hrv: 58, restingHR: 56 }),
    ];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.scoreState).toBe('scored');
    expect(recovery.dataFreshness.status).toBe('today');
    expect(recovery.recovery.reasons.join(' ')).toContain('baseline');
    expect(recovery.overallScore).toBeGreaterThanOrEqual(67);
    expect(recovery.sleepPerformance.targetWakeTime).toBe('6:30 AM');
    expect(recovery.sleepPerformance.targetSleepTime).toBeTruthy();
    expect(recovery.sleepPerformance.recommendedInBedTime).toBeTruthy();
    expect(recovery.sleepPerformance.efficiencyScore).toBe(94);
  });

  it('identifies sleep-window RHR estimates in the Recovery explanation', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { restingHR: 52, restingHRSource: 'estimated_sleep_hr' }),
      sleepNight(dateBefore(context.todayDate, 1), { restingHR: 55, restingHRSource: 'estimated_sleep_hr' }),
      sleepNight(dateBefore(context.todayDate, 2), { restingHR: 54, restingHRSource: 'estimated_sleep_hr' }),
      sleepNight(dateBefore(context.todayDate, 3), { restingHR: 56, restingHRSource: 'estimated_sleep_hr' }),
    ];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.recovery.reasons.join(' ')).toContain('Estimated sleeping RHR');
  });

  it('converts Samsung UTC sleep times to Bangkok before deriving the typical wake time', () => {
    const context = buildCoachContext();
    context.sleep7d = [0, 1, 2].map((days) => sleepNight(dateBefore(context.todayDate, days), {
      sleepEndTime: `${dateBefore(context.todayDate, days)}T21:27:00.000Z`,
    }));
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.sleepPerformance.targetWakeTime).toBe('4:27 AM');
  });

  it('maps workout effort onto a non-linear 0-21 Strain scale', () => {
    const context = buildCoachContext();
    context.todayWorkouts = [{
      date: context.todayDate,
      kind: 'run',
      label: 'วิ่ง',
      distanceKm: 10,
      durationMin: 60,
      durationText: '60 min',
      avgHR: 155,
      pace: null,
      calories: null,
    }];
    context.profile = { maxHr: 190 };

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.strain.score).toBeGreaterThan(0);
    expect(recovery.strain.score).toBeLessThanOrEqual(21);
    expect(recovery.strain.estimated).toBe(true);
  });

  it('keeps Fuel as an insight instead of changing Recovery', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate), sleepNight(dateBefore(context.todayDate, 1)),
      sleepNight(dateBefore(context.todayDate, 2)), sleepNight(dateBefore(context.todayDate, 3)),
    ];
    context.sleepBaseline30d = context.sleep7d;
    const withoutMeals = buildRunMateRecoverySystem(context);
    context.mealsToday = [{ mealType: 'breakfast', foods: ['rice'], caloriesKcal: 500, proteinG: 20, carbsG: 70, fatG: 10, fiberG: null, fatLoad: null, coachNote: null }];
    const withMeals = buildRunMateRecoverySystem(context);

    expect(withoutMeals.overallScore).toBe(withMeals.overallScore);
    expect(withoutMeals.fuelInsight.status).not.toBe(withMeals.fuelInsight.status);
  });

  it('marks an older sleep session as stale instead of Today’s Recovery', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(dateBefore(context.todayDate, 1)),
      sleepNight(dateBefore(context.todayDate, 2)),
      sleepNight(dateBefore(context.todayDate, 3)),
      sleepNight(dateBefore(context.todayDate, 4)),
    ];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.scoreState).toBe('stale');
    expect(recovery.dataFreshness).toEqual({
      status: 'stale',
      latestSleepDate: dateBefore(context.todayDate, 1),
      ageDays: 1,
    });
    expect(recovery.guardrails.join(' ')).toContain('Today’s Recovery');
  });

  it('marks today as calibrating when the current sleep exists but baseline nights are insufficient', () => {
    const context = buildCoachContext();
    context.sleep7d = [sleepNight(context.todayDate), sleepNight(dateBefore(context.todayDate, 1))];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.scoreState).toBe('calibrating');
    expect(recovery.dataFreshness.status).toBe('today');
  });

  it('classifies HRV above baseline as a helping factor and RHR above baseline as hurting', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { hrv: 80, restingHR: 62 }),
      sleepNight(dateBefore(context.todayDate, 1), { hrv: 60, restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 2), { hrv: 60, restingHR: 55 }),
      sleepNight(dateBefore(context.todayDate, 3), { hrv: 60, restingHR: 55 }),
    ];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);
    const factors = recovery.recovery.factors ?? [];

    expect(factors.find((factor) => factor.key === 'hrv')?.direction).toBe('helping');
    expect(factors.find((factor) => factor.key === 'restingHR')?.direction).toBe('hurting');
  });

  it('marks a factor unavailable instead of neutral or hurting when its baseline has no samples', () => {
    const context = buildCoachContext();
    context.sleep7d = [sleepNight(context.todayDate, { hrv: null, restingHR: null, respiratoryRate: null })];
    context.sleepBaseline30d = context.sleep7d;

    const recovery = buildRunMateRecoverySystem(context);
    const factors = recovery.recovery.factors ?? [];

    expect(factors.find((factor) => factor.key === 'hrv')?.direction).toBe('unavailable');
    expect(factors.find((factor) => factor.key === 'restingHR')?.direction).toBe('unavailable');
    expect(factors.find((factor) => factor.key === 'respiratoryRate')?.direction).toBe('unavailable');
  });

  it('marks active pain as a hurting factor', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate), sleepNight(dateBefore(context.todayDate, 1)),
      sleepNight(dateBefore(context.todayDate, 2)), sleepNight(dateBefore(context.todayDate, 3)),
    ];
    context.sleepBaseline30d = context.sleep7d;
    context.activePain = true;
    context.latestPain = { painLevel: 6, redFlags: [] } as unknown as typeof context.latestPain;

    const recovery = buildRunMateRecoverySystem(context);

    expect(recovery.recovery.factors?.find((factor) => factor.key === 'pain')?.direction).toBe('hurting');
  });

  it('keeps every recovery.factors[].detail in English, since the Today UI is English-only', () => {
    const context = buildCoachContext();
    context.sleep7d = [
      sleepNight(context.todayDate, { hrv: 80, restingHR: 62, respiratoryRate: 18 }),
      sleepNight(dateBefore(context.todayDate, 1), { hrv: 60, restingHR: 55, respiratoryRate: 15 }),
      sleepNight(dateBefore(context.todayDate, 2), { hrv: 60, restingHR: 55, respiratoryRate: 15 }),
      sleepNight(dateBefore(context.todayDate, 3), { hrv: 60, restingHR: 55, respiratoryRate: 15 }),
    ];
    context.sleepBaseline30d = context.sleep7d;
    context.activePain = true;
    context.latestPain = { painLevel: 5, redFlags: [] } as unknown as typeof context.latestPain;
    context.activeSick = true;
    context.sickRiskLevel = 'monitor' as unknown as typeof context.sickRiskLevel;

    const recovery = buildRunMateRecoverySystem(context);
    const thaiCharacters = /[฀-๿]/;

    for (const factor of recovery.recovery.factors ?? []) {
      expect(factor.detail).not.toMatch(thaiCharacters);
    }
  });

  it('keeps every unavailable factor.detail in English when the signal has no baseline yet', () => {
    const context = buildCoachContext();
    context.sleep7d = [sleepNight(context.todayDate, { hrv: null, restingHR: null, respiratoryRate: null })];
    context.sleepBaseline30d = [];

    const recovery = buildRunMateRecoverySystem(context);
    const thaiCharacters = /[฀-๿]/;

    for (const factor of recovery.recovery.factors ?? []) {
      expect(factor.detail).not.toMatch(thaiCharacters);
    }
  });

  it('applies the pain safety display cap', () => {
    const display = getOverallDisplayStatus(90, 90, 20, 90, 90, true, false);

    expect(display.label).toBe('Fair');
    expect(display.cautionLevel).toBe('high');
    expect(display.note).toContain('safety cap');
  });
});
