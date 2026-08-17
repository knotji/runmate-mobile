import { describe, expect, it } from 'vitest';
import type { RacePlan, WeekWorkout } from '@/types/race';
import { buildRacePlanDiff, prepareActivePlanVersion, prepareLegacyActivePlanVersion } from './racePlanVersions';

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

  it('matches an old plan whose day field is an ISO date instead of a weekday name against the new plan\'s real weekday, instead of showing every day as "No Session" (regression: this previously used its own 4th duplicate of the weekday-matching logic that had the same blind spot as the "202" bug)', () => {
    const diff = buildRacePlanDiff(
      plan([workout('2026-08-17', 'Easy Run')]),
      plan([workout('Monday', 'Tempo Run')]),
    );
    expect(diff).toHaveLength(1);
    expect(diff[0]).toMatchObject({ day: 'Mon', kind: 'changed' });
    expect(diff[0].before?.workoutType).toBe('Easy Run');
    expect(diff[0].after?.workoutType).toBe('Tempo Run');
  });

  it('creates a new active version that points to the previous active snapshot', () => {
    const next = prepareActivePlanVersion(plan([]), [{
      id: 'plan-2', version: 2, status: 'active', createdAt: null, plan: { ...plan([]), planVersion: 2 },
    }], { restoredFromPlanId: 'plan-1' });
    expect(next).toMatchObject({
      planVersion: 3,
      planStatus: 'active',
      supersedesPlanId: 'plan-2',
      restoredFromPlanId: 'plan-1',
    });
  });

  it('does not let imported legacy rows inflate the governed version number', () => {
    const next = prepareActivePlanVersion(plan([]), [{
      id: 'legacy-8', version: 8, status: 'legacy', createdAt: null, plan: plan([]),
    }]);
    expect(next.planVersion).toBe(1);
  });

  it('promotes the reconciled legacy plan as the first active version', () => {
    const legacy = { ...plan([]), storageId: 'legacy-current' };
    expect(prepareLegacyActivePlanVersion(legacy)).toMatchObject({
      storageId: null,
      planVersion: 1,
      planStatus: 'active',
      supersedesPlanId: 'legacy-current',
    });
  });
});
