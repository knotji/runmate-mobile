import { describe, expect, it } from 'vitest';
import { buildTrainingAdherence } from './trainingAdherence';
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
});
