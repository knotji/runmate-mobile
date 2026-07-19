import { describe, expect, it } from 'vitest';
import { buildTrainingAdherence, buildTrainingAdherenceHistory } from './trainingAdherence';
import type { LocalHistoryItem } from './localHistory';
import type { WeekWorkout } from '@/types/race';

const plan = (day: string, workoutType: string, distanceKm: number | null = null): WeekWorkout => ({ day, workoutType, distanceKm, targetPace: null, targetHR: null, description: '' });
const actual = (dateKey: string, workoutKind: string, distanceKm?: number): LocalHistoryItem => ({ id: `${dateKey}-${workoutKind}`, type: 'workout', createdAt: `${dateKey}T12:00:00Z`, dateKey, data: { extracted: { workoutKind, distanceKm } } });

describe('buildTrainingAdherence', () => {
  it('matches completed and modified workouts without penalizing rest or recovery', () => {
    const result = buildTrainingAdherence([
      plan('SUN', 'Easy Run', 6), plan('MON', 'Rest'), plan('TUE', 'Intervals', 7), plan('WED', 'Recovery'),
    ], [actual('2026-07-19', 'outdoor_run', 6), actual('2026-07-21', 'strength')], '2026-07-22');
    expect(result).toMatchObject({ completed: 1, modified: 1, missed: 0, planned: 2, percentage: 100 });
    expect(result.days.map((day) => day.status)).toEqual(['completed', 'recovery', 'modified', 'recovery']);
  });

  it('marks an unmatched past session missed and a future session upcoming', () => {
    const result = buildTrainingAdherence([plan('MON', 'Easy Run'), plan('FRI', 'Long Run')], [], '2026-07-22');
    expect(result.days.map((day) => day.status)).toEqual(['missed', 'upcoming']);
    expect(result).toMatchObject({ missed: 1, planned: 2, percentage: 0 });
  });

  it('uses each historical plan week and leaves pre-plan weeks unavailable', () => {
    const weeks = buildTrainingAdherenceHistory({
      raceCountdownText: '', totalWeeks: 2, currentPhase: 'Build', planSummary: '', phases: [], safetyNotes: '', planStartDate: '2026-07-12',
      weeks: [
        { weekNumber: 1, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 5, longRunDistanceKm: 5, workouts: [plan('SUN', 'Easy Run', 5)] },
        { weekNumber: 2, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 6, longRunDistanceKm: 6, workouts: [plan('SUN', 'Easy Run', 6)] },
      ],
    }, [actual('2026-07-12', 'outdoor_run', 5), actual('2026-07-19', 'outdoor_run', 6)], '2026-07-19', 3);
    expect(weeks.map((week) => ({ start: week.weekStart, planned: week.planned, completed: week.completed, available: week.planAvailable }))).toEqual([
      { start: '2026-07-19', planned: 1, completed: 1, available: true },
      { start: '2026-07-12', planned: 1, completed: 1, available: true },
      { start: '2026-07-05', planned: 0, completed: 0, available: false },
    ]);
  });
});
