import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { buildWorkoutLoadTrend } from './workoutLoadTrend';

describe('Workout Load Trend', () => {
  it('aggregates measured HRR load across the latest and previous seven days', () => {
    const items = [
      workout('current-1', '2026-07-19', true),
      workout('current-2', '2026-07-18', true),
      workout('current-sparse', '2026-07-17', false),
      workout('previous-1', '2026-07-12', true),
    ];
    const result = buildWorkoutLoadTrend({ items, todayDate: '2026-07-19', maxHr: 150, restingHr: 50 });

    expect(result.total).toBe(10);
    expect(result.previousTotal).toBe(5);
    expect(result.changePercentage).toBe(100);
    expect(result.status).toBe('Rising Quickly');
    expect(result.sessions).toBe(3);
    expect(result.measuredSessions).toBe(2);
    expect(result.days.at(-1)).toMatchObject({ date: '2026-07-19', load: 5, measuredSessions: 1 });
  });

  it('keeps load unavailable when physiology is missing', () => {
    const result = buildWorkoutLoadTrend({ items: [workout('one', '2026-07-19', true)], todayDate: '2026-07-19', maxHr: null, restingHr: 50 });
    expect(result.total).toBeNull();
    expect(result.measuredSessions).toBe(0);
    expect(result.sessions).toBe(1);
    expect(result.status).toBe('Starting Point');
  });
});

function workout(id: string, date: string, complete: boolean): LocalHistoryItem {
  const points = complete
    ? [90, 110, 120, 130, 140, 140].map((bpm, index) => ({ at: `${date}T00:0${index}:00.000Z`, bpm }))
    : [{ at: `${date}T00:00:00.000Z`, bpm: 130 }, { at: `${date}T00:01:00.000Z`, bpm: 130 }];
  return {
    id,
    type: 'workout',
    createdAt: `${date}T00:05:00.000Z`,
    dateKey: date,
    data: {
      extracted: { workoutKind: 'outdoor_run', duration: complete ? '5:00' : '60:00' },
      workoutStartTime: `${date}T00:00:00.000Z`,
      workoutEndTime: complete ? `${date}T00:05:00.000Z` : `${date}T01:00:00.000Z`,
      heartRateSamples: points,
    },
  };
}
