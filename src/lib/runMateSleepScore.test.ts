import { describe, expect, it } from 'vitest';
import { calculateRunMateSleepScore, type RunMateSleepScoreNight } from './runMateSleepScore';

const night = (durationMinutes: number, overrides: Partial<RunMateSleepScoreNight> = {}): RunMateSleepScoreNight => ({
  durationMinutes,
  timeInBedMinutes: durationMinutes + 30,
  sleepStartTime: '2026-07-22T16:00:00Z',
  sleepEndTime: '2026-07-22T23:00:00Z',
  remMinutes: 70,
  lightMinutes: 190,
  deepMinutes: 55,
  ...overrides,
});

describe('Sleep Score calculation', () => {
  it('calculates a score from duration, efficiency, consistency, and stages', () => {
    const result = calculateRunMateSleepScore([night(360), night(420), night(430), night(410)]);
    expect(result.score).not.toBeNull();
    expect(result.sufficiencyScore).toBeLessThan(100);
    expect(result.efficiencyScore).toBeGreaterThan(90);
    expect(result.consistencyScore).not.toBeNull();
  });

  it('requires actual sleep duration and never manufactures a score from stages alone', () => {
    const result = calculateRunMateSleepScore([night(360, { durationMinutes: null })]);
    expect(result.score).toBeNull();
  });

  it('rebalances available components when optional data is missing', () => {
    const result = calculateRunMateSleepScore([night(420, { timeInBedMinutes: null, remMinutes: null, lightMinutes: null, deepMinutes: null, sleepStartTime: null, sleepEndTime: null })]);
    expect(result.score).toBe(100);
    expect(result.efficiencyScore).toBeNull();
    expect(result.qualityScore).toBeNull();
  });
});
