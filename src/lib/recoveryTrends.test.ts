import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { buildRecoveryTrend } from './recoveryTrends';

function sleep(date: string, score: number, hrv: number, restingHR: number): LocalHistoryItem {
  return { id: `sleep-${date}`, type: 'sleep', createdAt: `${date}T00:00:00Z`, dateKey: date, data: { extracted: { sleepScore: score, hrv, restingHR, avgRespiratoryRate: 15 } } };
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
    expect(result.points.find((point) => point.date === '2026-07-18')).toMatchObject({ sleep: 82, state: 'scored' });
    expect(result.points.find((point) => point.date === '2026-07-18')?.strain).toBeGreaterThan(0);
    expect(result.insight.direction).toBe('up');
  });

  it('filters the view to the requested 30-day calendar window', () => {
    const result = buildRecoveryTrend([sleep('2026-06-01', 90, 100, 50), sleep('2026-07-19', 80, 100, 50)], null, 30, '2026-07-19');
    expect(result.points[0].date).toBe('2026-06-20');
    expect(result.points.at(-1)?.date).toBe('2026-07-19');
    expect(result.points.some((point) => point.date === '2026-06-01')).toBe(false);
  });
});
