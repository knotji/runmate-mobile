import { describe, expect, it } from 'vitest';
import type { CoachContext } from './buildCoachContext';
import type { LocalHistoryItem } from './localHistory';
import { buildCalendarTrainingSummary, buildWeeklyTrainingSummary } from './weeklyTrainingSummary';

describe('Weekly Training Summary', () => {
  it('combines deduped weekly training, sleep and logged nutrition facts', () => {
    const context = {
      todayDate: '2026-07-19',
      totalSessions: 4,
      totalRunKm: 15.5,
      sleepAvg7dHours: 6.8,
      sleepNightCount7d: 6,
      workouts7d: [
        { date: '2026-07-19', runs: [{ km: 10, durationMin: 60, avgHR: 150, pace: '6:00/km' }], walks: [], other: [] },
        { date: '2026-07-18', runs: [], walks: [{ km: 2, durationMin: 25 }], other: [{ label: 'Strength', durationMin: 40 }, { label: 'Swimming', durationMin: 30 }] },
        { date: '2026-07-12', runs: [{ km: 99, durationMin: 600, avgHR: 150, pace: null }], walks: [], other: [] },
      ],
      nutrition7d: [
        { date: '2026-07-19', mealCount: 3, caloriesKcal: 1800, proteinG: 90, carbsG: 210, fatG: 55, notes: [] },
        { date: '2026-07-18', mealCount: 2, caloriesKcal: 1400, proteinG: 70, carbsG: 150, fatG: 45, notes: [] },
        { date: '2026-07-12', mealCount: 9, caloriesKcal: 5000, proteinG: 300, carbsG: null, fatG: null, notes: [] },
      ],
    } as unknown as CoachContext;

    expect(buildWeeklyTrainingSummary(context)).toEqual({
      sessions: 4,
      distanceKm: 10,
      activeMinutes: 155,
      activeDays: 2,
      sleepAverageHours: 6.8,
      sleepNights: 6,
      mealCount: 5,
      mealDays: 2,
      averageCaloriesPerLoggedDay: 1600,
      averageProteinPerLoggedDay: 80,
      trainingMix: [{ label: 'Running', sessions: 1 }, { label: 'Walking', sessions: 1 }, { label: 'Other Training', sessions: 2 }],
    });
  });

  it('summarizes workout, sleep, and meals inside an explicit calendar period', () => {
    const items = [
      historyItem('run', 'workout', '2026-07-27', { extracted: { distanceKm: 5, duration: '30 min', workoutKind: 'running' } }),
      historyItem('sleep', 'sleep', '2026-07-28', { extracted: { actualSleepDurationMinutes: 420 } }),
      historyItem('meal-1', 'meal', '2026-07-28', { nutrition: { caloriesKcal: 600, proteinG: 35 } }),
      historyItem('meal-2', 'meal', '2026-07-28', { nutrition: { caloriesKcal: 700, proteinG: 45 } }),
      historyItem('old', 'workout', '2026-07-20', { extracted: { distanceKm: 99, duration: '9 hr', workoutType: 'Running' } }),
    ];

    expect(buildCalendarTrainingSummary(items, '2026-07-27', '2026-08-02')).toEqual({
      sessions: 1,
      distanceKm: 5,
      activeMinutes: 30,
      activeDays: 1,
      sleepAverageHours: 7,
      sleepNights: 1,
      mealCount: 2,
      mealDays: 1,
      averageCaloriesPerLoggedDay: 1300,
      averageProteinPerLoggedDay: 80,
      trainingMix: [{ label: 'Running', sessions: 1 }],
    });
  });
});

function historyItem(id: string, type: LocalHistoryItem['type'], dateKey: string, data: unknown): LocalHistoryItem {
  return { id, type, dateKey, createdAt: `${dateKey}T12:00:00.000Z`, data };
}
