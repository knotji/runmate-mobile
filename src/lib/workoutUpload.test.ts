import { describe, expect, it } from 'vitest';
import { normalizeWorkoutForReview } from '@/lib/workoutUpload';
import type { WorkoutAnalysis } from '@/types/logs';

function workout(avgPace: string | null): WorkoutAnalysis {
  return {
    extracted: {
      workoutKind: 'outdoor_run', date: null, distanceKm: 10.16, duration: '1:00:00', avgPace,
      avgSpeedKmh: null, avgHR: 169, maxHR: null, cadence: 166, calories: 552,
      elevationGain: 1, vo2Max: 47.7, sweatLossMl: 870, visibleMetrics: [],
    },
    coach: {
      workoutSummary: '', intensityAssessment: '', trainingLoadNote: '', wasTooHard: false,
      recoveryAdvice: '', nutritionAfterWorkout: '', nextWorkoutSuggestion: '', coachNote: '',
    },
  };
}

describe('normalizeWorkoutForReview', () => {
  it('normalizes Samsung pace notation for review', () => {
    const input = workout(`05'54"`);
    input.extracted.maxHR = 187;
    input.extracted.maxPace = `04'37"/km`;
    const result = normalizeWorkoutForReview(input);

    expect(result.extracted.avgPace).toBe('5:54/km');
    expect(result.extracted.maxPace).toBe('4:37/km');
    expect(result.extracted.maxHR).toBe(187);
  });

  it('preserves an unrecognized pace value', () => {
    const input = workout('Easy Pace');
    expect(normalizeWorkoutForReview(input)).toBe(input);
  });

  it('recognizes swimming data and preserves pace per 100 meters', () => {
    const input = workout(`06'39"/100 m`);
    input.extracted.workoutKind = 'other';
    input.extracted.swimKind = 'pool';
    input.extracted.distanceM = 200;

    const result = normalizeWorkoutForReview(input);

    expect(result.extracted.workoutKind).toBe('swimming');
    expect(result.extracted.avgPace).toBe(`06'39"/100 m`);
  });

  it('recognizes circuit training as strength from its visible workout name', () => {
    const input = workout(null);
    input.extracted.workoutKind = 'other';
    input.extracted.workoutName = 'Circuit training';

    expect(normalizeWorkoutForReview(input).extracted.workoutKind).toBe('strength');
  });
});
