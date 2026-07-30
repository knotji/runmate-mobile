import { describe, expect, it } from 'vitest';
import type { RacePlan, WeekWorkout } from '@/types/race';
import { buildRacePlanDiff, prepareActivePlanVersion } from './racePlanVersions';

const workout = (day: string, workoutType: string): WeekWorkout => ({
  day, workoutType, distanceKm: 5, targetPace: null, targetHR: null, description: workoutType,
});
const plan = (weeklyPlan: WeekWorkout[]): RacePlan => ({
  raceCountdownText: '', totalWeeks: 1, currentPhase: '', planSummary: '', phases: [], weeks: [],
  safetyNotes: '', weeklyPlan,
});

describe('race plan versions', () => {
  it('builds a day-level preview without hiding unchanged sessions', () => {
    const diff = buildRacePlanDiff(
      plan([workout('Monday', 'Rest'), workout('Tuesday', 'Intervals')]),
      plan([workout('Monday', 'Rest'), workout('Tuesday', 'Tempo Run')]),
    );
    expect(diff.map(({ day, kind }) => [day, kind])).toEqual([
      ['Mon', 'unchanged'],
      ['Tue', 'changed'],
    ]);
  });

  it('creates a new active version that points to the previous active snapshot', () => {
    const next = prepareActivePlanVersion(plan([]), [{
      id: 'plan-2', version: 2, status: 'active', createdAt: null, plan: plan([]),
    }], { restoredFromPlanId: 'plan-1' });
    expect(next).toMatchObject({
      planVersion: 3,
      planStatus: 'active',
      supersedesPlanId: 'plan-2',
      restoredFromPlanId: 'plan-1',
    });
  });
});
