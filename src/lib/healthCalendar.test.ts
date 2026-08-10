import { describe, expect, it } from 'vitest';
import { buildHabitImpactInsights, buildHealthCalendarDays } from '@/lib/healthCalendar';
import type { LocalHistoryItem } from '@/lib/localHistory';

function item(id: string, type: LocalHistoryItem['type'], dateKey: string, data: unknown): LocalHistoryItem {
  return { id, type, dateKey, createdAt: `${dateKey}T12:00:00+07:00`, data };
}

describe('Health Calendar', () => {
  it('summarizes sleep, training, meals, caffeine, and check-in context per day', () => {
    const items = [
      item('s', 'sleep', '2026-08-10', { extracted: { actualSleepDurationMinutes: 390, sleepScore: 82, hrv: 80 } }),
      item('w', 'workout', '2026-08-10', { extracted: { durationMinutes: 40, distanceKm: 6 } }),
      item('m', 'meal', '2026-08-10', { loggedAt: '2026-08-10T08:00:00Z', detectedFoods: [{ name: 'Coffee' }], nutrition: { caloriesKcal: 120 } }),
    ];
    const [day] = buildHealthCalendarDays(items, ['2026-08-10'], [{ date: '2026-08-10', stress: 'high', environment: null, updatedAt: '' }]);
    expect(day).toMatchObject({ sleepMinutes: 390, sleepScore: 82, hrv: 80, workoutCount: 1, workoutMinutes: 40, distanceKm: 6, mealCount: 1, caffeineLogged: true, lateCaffeineLogged: true, stress: 'high' });
  });

  it('requires at least three paired outcomes in both groups before showing an impact', () => {
    const items: LocalHistoryItem[] = [];
    for (let day = 1; day <= 8; day++) {
      const date = `2026-08-${String(day).padStart(2, '0')}`;
      const next = `2026-08-${String(day + 1).padStart(2, '0')}`;
      items.push(item(`meal-${day}`, 'meal', date, { loggedAt: `${date}T08:00:00Z`, detectedFoods: [{ name: day <= 4 ? 'Coffee' : 'Rice' }] }));
      items.push(item(`sleep-${day}`, 'sleep', next, { extracted: { actualSleepDurationMinutes: day <= 4 ? 360 : 420 } }));
    }
    const caffeine = buildHabitImpactInsights(items).find((insight) => insight.key === 'late_caffeine');
    expect(caffeine).toMatchObject({ status: 'ready', withHabitDays: 4, comparisonDays: 4, deltaMinutes: -60, confidence: 'Early Signal' });
  });

  it('keeps zero-valued sleep physiology missing instead of presenting it as measured', () => {
    const [day] = buildHealthCalendarDays([
      item('s', 'sleep', '2026-08-10', { extracted: { actualSleepDurationMinutes: 357, sleepScore: 0, restingHR: 0, hrv: 0 } }),
    ], ['2026-08-10']);

    expect(day).toMatchObject({ sleepMinutes: 357, sleepScore: null, restingHr: null, hrv: null });
  });
});
