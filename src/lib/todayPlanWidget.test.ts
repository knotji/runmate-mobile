import { describe, expect, it } from 'vitest';
import { buildTodayPlanWidgetData } from '@/lib/todayPlanWidget';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { WeekWorkout } from '@/types/race';

const TODAY = '2026-07-24'; // Friday

const workout = (day: string, overrides: Partial<WeekWorkout> = {}): WeekWorkout => ({
  day, workoutType: 'Easy Run', distanceKm: 8, targetPace: null, targetHR: null, description: '', ...overrides,
});

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    todayDate: TODAY,
    todayWorkouts: [],
    racePlan: { weeklyPlan: [workout('Friday')] },
    ...overrides,
  } as unknown as CoachContext;
}

describe('buildTodayPlanWidgetData', () => {
  it('reports no_plan when there is no active race plan', () => {
    const data = buildTodayPlanWidgetData(context({ racePlan: null }));
    expect(data).toEqual({ date: TODAY, workoutType: null, description: null, distanceKm: null, pace: null, status: 'no_plan' });
  });

  it('reports rest for a rest day', () => {
    const data = buildTodayPlanWidgetData(context({ racePlan: { weeklyPlan: [workout('Friday', { workoutType: 'Rest' })] } }));
    expect(data.status).toBe('rest');
    expect(data.workoutType).toBe('Rest Day');
  });

  it('reports pending when nothing is logged today', () => {
    const data = buildTodayPlanWidgetData(context());
    expect(data.status).toBe('pending');
    expect(data.workoutType).toBe('Easy Run');
    expect(data.distanceKm).toBe(8);
  });

  it('reports completed when a matching workout was logged today', () => {
    const data = buildTodayPlanWidgetData(context({ todayWorkouts: [{ kind: 'run' }] as CoachContext['todayWorkouts'] }));
    expect(data.status).toBe('completed');
  });

  it('reports logged_different when a mismatched workout was logged today', () => {
    const data = buildTodayPlanWidgetData(context({ todayWorkouts: [{ kind: 'strength' }] as CoachContext['todayWorkouts'] }));
    expect(data.status).toBe('logged_different');
  });

  it('carries pace through translation and drops a description that repeats the workout type', () => {
    const data = buildTodayPlanWidgetData(context({
      racePlan: { weeklyPlan: [workout('Friday', { targetPace: 'ไม่เกิน 5:30', description: 'Easy Run' })] },
    }));
    expect(data.pace).toBe('Max 5:30');
    expect(data.description).toBeNull();
  });
});
