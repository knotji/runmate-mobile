import { describe, expect, it } from 'vitest';
import { buildWeeklyPlanCalendar } from '@/lib/weeklyPlanCalendar';
import type { CoachContext, DayWorkoutSummary } from '@/lib/buildCoachContext';
import type { WeekWorkout } from '@/types/race';

const workout = (day: string, workoutType: string): WeekWorkout => ({
  day, workoutType, distanceKm: 8, targetPace: null, targetHR: null, description: '',
});

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    todayDate: '2026-07-24', // Friday
    todayWorkouts: [],
    workouts7d: [],
    racePlan: {
      weeklyPlan: [
        workout('Monday', 'Easy Run'),
        workout('Tuesday', 'Rest'),
        workout('Wednesday', 'Tempo Run'),
        workout('Thursday', 'Rest'),
        workout('Friday', 'Interval'),
        workout('Saturday', 'Long Run'),
        workout('Sunday', 'Rest'),
      ],
    },
    ...overrides,
  } as unknown as CoachContext;
}

describe('buildWeeklyPlanCalendar', () => {
  it('builds Monday through Sunday of the current week, in order', () => {
    const days = buildWeeklyPlanCalendar(context());
    expect(days.map((day) => day.date)).toEqual([
      '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26',
    ]);
    expect(days.map((day) => day.weekdayLabel)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('matches each day to its planned workout by weekday label', () => {
    const days = buildWeeklyPlanCalendar(context());
    expect(days[0].planned?.workoutType).toBe('Easy Run');
    expect(days[4].planned?.workoutType).toBe('Interval');
  });

  it('marks rest days regardless of past/present/future', () => {
    const days = buildWeeklyPlanCalendar(context());
    expect(days[1].status).toBe('rest'); // Tuesday, past
    expect(days[6].status).toBe('rest'); // Sunday, future
  });

  it('marks a past day with no logged activity as missed', () => {
    const days = buildWeeklyPlanCalendar(context({ workouts7d: [] }));
    expect(days[0].status).toBe('missed'); // Monday, planned Easy Run, nothing logged
  });

  it('marks a past day with logged activity as completed', () => {
    const monday: DayWorkoutSummary = { date: '2026-07-20', runs: [{ km: 8, durationMin: 45, avgHR: 140, pace: '5:30/km' }], walks: [], other: [] };
    const days = buildWeeklyPlanCalendar(context({ workouts7d: [monday] }));
    expect(days[0].status).toBe('completed');
  });

  it('marks future days as upcoming', () => {
    const days = buildWeeklyPlanCalendar(context());
    expect(days[5].status).toBe('upcoming'); // Saturday, planned Long Run
  });

  it('marks today as today_pending when nothing has been logged yet', () => {
    const days = buildWeeklyPlanCalendar(context());
    expect(days[4].status).toBe('today_pending'); // Friday
    expect(days[4].isToday).toBe(true);
  });

  it('marks today as today_completed when a matching workout was logged', () => {
    const days = buildWeeklyPlanCalendar(context({
      todayWorkouts: [{ kind: 'run' } as CoachContext['todayWorkouts'][number]],
    }));
    expect(days[4].status).toBe('today_completed');
  });

  it('marks a day with no plan entry as no_plan', () => {
    const days = buildWeeklyPlanCalendar(context({ racePlan: { weeklyPlan: [] } }));
    expect(days.every((day) => day.status === 'no_plan')).toBe(true);
  });
});
