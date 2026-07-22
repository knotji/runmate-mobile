import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { buildRecoveryTrend } from './recoveryTrends';

function sleep(date: string, score: number, hrv: number, restingHR: number): LocalHistoryItem {
  return { id: `sleep-${date}`, type: 'sleep', createdAt: `${date}T00:00:00Z`, dateKey: date, data: { extracted: { sleepScore: score, sleepDuration: '7h 0m', timeInBedMinutes: 450, sleepStartTime: `${date}T16:00:00Z`, sleepEndTime: `${date}T23:00:00Z`, sleepStageMinutes: { rem: 80, light: 260, deep: 80 }, hrv, restingHR, avgRespiratoryRate: 15 } } };
}

function workout(date: string): LocalHistoryItem {
  return { id: `workout-${date}`, type: 'workout', createdAt: `${date}T12:00:00Z`, dateKey: date, source: { provider: 'samsung_health', importType: 'health_connect', importedAt: `${date}T13:00:00Z` }, data: { extracted: { workoutKind: 'outdoor_run', duration: '30:00', avgHR: 150 } } };
}

describe('recovery trends', () => {
  it('builds calendar-aligned points without manufacturing missing nights', () => {
    const result = buildRecoveryTrend([
      sleep('2026-07-15', 70, 90, 52), sleep('2026-07-16', 75, 94, 51),
      sleep('2026-07-17', 78, 98, 50), sleep('2026-07-18', 82, 104, 48),
      workout('2026-07-18'),
    ], { maxHr: 195 }, 7, '2026-07-19');
    expect(result.points).toHaveLength(7);
    expect(result.points.at(-1)).toMatchObject({ date: '2026-07-19', recovery: null, sleep: null, strain: null, state: 'missing' });
    expect(result.points.find((point) => point.date === '2026-07-18')).toMatchObject({ state: 'scored' });
    expect(result.points.find((point) => point.date === '2026-07-18')?.sleep).toBeGreaterThan(0);
    expect(result.points.find((point) => point.date === '2026-07-18')?.strain).toBeGreaterThan(0);
    expect(result.insight.direction).toBe('up');
    expect(result.calibration).toMatchObject({
      confidence: 'limited',
      baselineNights: 3,
      availableSignalCount: 4,
      totalSignalCount: 4,
    });
  });

  it('filters the view to the requested 30-day calendar window', () => {
    const result = buildRecoveryTrend([sleep('2026-06-01', 90, 100, 50), sleep('2026-07-19', 80, 100, 50)], null, 30, '2026-07-19');
    expect(result.points[0].date).toBe('2026-06-20');
    expect(result.points.at(-1)?.date).toBe('2026-07-19');
    expect(result.points.some((point) => point.date === '2026-06-01')).toBe(false);
  });

  it('reports high confidence only with fresh data, baseline depth, and signal coverage', () => {
    const nights = Array.from({ length: 16 }, (_, index) => {
      const day = String(19 - index).padStart(2, '0');
      return sleep(`2026-07-${day}`, 78, 95 + index, 50 + index / 10);
    });
    const result = buildRecoveryTrend(nights, null, 30, '2026-07-19');
    expect(result.calibration).toMatchObject({
      confidence: 'high',
      label: 'High Confidence',
      freshness: 'current',
      baselineNights: 15,
      availableSignalCount: 4,
    });
  });

  it('keeps missing provider signals visible instead of treating them as available', () => {
    const nights = Array.from({ length: 10 }, (_, index) => ({
      id: `sleep-${index}`,
      type: 'sleep' as const,
      createdAt: `2026-07-${String(19 - index).padStart(2, '0')}T00:00:00Z`,
      dateKey: `2026-07-${String(19 - index).padStart(2, '0')}`,
      data: { extracted: { restingHR: 52 } },
    }));
    const result = buildRecoveryTrend(nights, null, 30, '2026-07-19');
    expect(result.calibration.confidence).toBe('limited');
    expect(result.calibration.availableSignalCount).toBe(1);
    expect(result.calibration.signals.find((signal) => signal.key === 'hrv')).toMatchObject({ available: false, detail: 'Missing from latest sleep' });
    expect(result.calibration.signals.find((signal) => signal.key === 'sleep_score')).toMatchObject({ available: false, detail: 'Sleep Duration is required' });
  });

  it('limits confidence when the newest Sleep record is stale', () => {
    const nights = Array.from({ length: 16 }, (_, index) => {
      const day = String(18 - index).padStart(2, '0');
      return sleep(`2026-07-${day}`, 78, 95 + index, 50 + index / 10);
    });
    const result = buildRecoveryTrend(nights, null, 30, '2026-07-19');
    expect(result.calibration).toMatchObject({ confidence: 'limited', freshness: 'stale', latestSleepDate: '2026-07-18' });
  });

  it('calculates every trend score independently of a provider Sleep Score', () => {
    const nights = ['2026-07-19', '2026-07-18', '2026-07-17', '2026-07-16'].map((date, index) => {
      const item = sleep(date, 80, 95 + index, 50);
      (item.data as { extracted: { sleepScore: number | null } }).extracted.sleepScore = null;
      return item;
    });
    const result = buildRecoveryTrend(nights, null, 7, '2026-07-19');
    expect(result.points.at(-1)?.sleep).not.toBeNull();
    expect(result.calibration.signals.find((signal) => signal.key === 'sleep_score')).toMatchObject({
      available: true,
      detail: 'Calculated from available Sleep details',
    });
  });
});
