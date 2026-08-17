import { describe, expect, it } from 'vitest';
import { buildCoachContext, type WeekSleepRow } from '@/lib/buildCoachContext';
import { buildPersonalBaseline, computeSignalBaseline } from '@/lib/personalBaseline';

const night = (date: string, overrides: Partial<WeekSleepRow> = {}): WeekSleepRow => ({
  date,
  durationH: '7h',
  durationMinutes: 420,
  score: 75,
  readiness: null,
  restingHR: 55,
  hrv: 60,
  energyScore: null,
  sleepStartTime: null,
  sleepEndTime: null,
  timeInBedMinutes: 450,
  respiratoryRate: 15,
  awakeMinutes: 20,
  remMinutes: null,
  lightMinutes: null,
  deepMinutes: null,
  ...overrides,
});

describe('computeSignalBaseline', () => {
  it('marks a signal insufficient with zero samples instead of inventing a value', () => {
    const baseline = computeSignalBaseline([]);
    expect(baseline).toEqual({ value: null, sampleCount: 0, state: 'insufficient' });
  });

  it('marks a signal calibrating below the ready-sample threshold', () => {
    const baseline = computeSignalBaseline([60, 62], 4);
    expect(baseline.state).toBe('calibrating');
    expect(baseline.sampleCount).toBe(2);
    expect(baseline.value).toBe(61);
  });

  it('marks a signal ready at or above the threshold and ignores nulls', () => {
    const baseline = computeSignalBaseline([60, null, 62, undefined, 58, 64], 4);
    expect(baseline.state).toBe('ready');
    expect(baseline.sampleCount).toBe(4);
    expect(baseline.value).toBe(61);
  });
});

describe('buildPersonalBaseline', () => {
  it('returns insufficient baselines for a null context instead of zeros', () => {
    const baseline = buildPersonalBaseline(null);
    expect(baseline.hrv.state).toBe('insufficient');
    expect(baseline.restingHR.state).toBe('insufficient');
    expect(baseline.respiratoryRate.state).toBe('insufficient');
    expect(baseline.sleepDurationMinutes.state).toBe('insufficient');
    expect(baseline.nightsConsidered).toBe(0);
  });

  it('excludes the latest night from the baseline it is compared against', () => {
    const context = buildCoachContext();
    context.sleepBaseline30d = [
      night('2026-08-10', { hrv: 90 }),
      night('2026-08-09', { hrv: 60 }),
      night('2026-08-08', { hrv: 62 }),
      night('2026-08-07', { hrv: 58 }),
      night('2026-08-06', { hrv: 64 }),
    ];

    const baseline = buildPersonalBaseline(context);

    expect(baseline.nightsConsidered).toBe(4);
    expect(baseline.hrv.value).toBe(61);
    expect(baseline.hrv.state).toBe('ready');
  });
});
