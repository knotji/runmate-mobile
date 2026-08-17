import { describe, expect, it } from 'vitest';
import { buildDailyFuelCoach } from '@/lib/dailyFuelCoach';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { UserProfile } from '@/types/profile';
import type { WeekWorkout } from '@/types/race';

const date = '2026-08-04';
const profile: UserProfile = { displayName: 'Runner', weightKg: 50 };
function item(id: string, type: LocalHistoryItem['type'], data: Record<string, unknown>): LocalHistoryItem {
  return { id, type, dateKey: date, createdAt: `${date}T12:00:00+07:00`, data };
}
function meal(id: string, proteinG?: number, carbsG?: number): LocalHistoryItem {
  return item(id, 'meal', { nutrition: { proteinG, carbsG } });
}
function planned(workoutType: string, description = ''): WeekWorkout {
  return { day: 'Tuesday', workoutType, description, distanceKm: 0, targetPace: '', targetHR: '' };
}

describe('Daily Fuel Coach', () => {
  it('calculates rest-day guidance from current body weight', () => {
    const coach = buildDailyFuelCoach({ date, items: [meal('breakfast', 20, 45)], profile });
    expect(coach).toMatchObject({ status: 'ready', dayType: 'rest', mealCount: 1, coverage: 'partial' });
    expect(coach.protein).toMatchObject({ logged: 20, minimum: 70, maximum: 80, remainingToMinimum: 50 });
    expect(coach.carbs).toMatchObject({ logged: 45, minimum: 150, maximum: 200, remainingToMinimum: 105 });
  });

  it('uses a planned quality workout before it has been completed', () => {
    const coach = buildDailyFuelCoach({ date, items: [meal('breakfast', 25, 80)], profile, plannedWorkout: planned('Intervals', '5 x 800 m') });
    expect(coach.dayType).toBe('hard');
    expect(coach.dayLabel).toBe('Interval Day');
    expect(coach.carbs).toMatchObject({ minimum: 225, maximum: 300 });
    expect(coach.recommendation.title).toBe('Prioritize Carbohydrate');
  });

  it('names a tempo plan specifically instead of using a generic quality label', () => {
    const coach = buildDailyFuelCoach({ date, items: [meal('breakfast', 25, 80)], profile, plannedWorkout: planned('Tempo Run') });
    expect(coach.dayLabel).toBe('Tempo Day');
  });

  it('uses the actual workout in preference to a conflicting plan', () => {
    const actual = item('long-run', 'workout', { extracted: { workoutKind: 'outdoor_run', workoutName: 'Long Run' } });
    const coach = buildDailyFuelCoach({ date, items: [meal('meal', 30, 100), actual], profile, plannedWorkout: planned('Rest') });
    expect(coach.dayType).toBe('long');
    expect(coach.carbs).toMatchObject({ minimum: 250, maximum: 350 });
    expect(coach.basedOnLoggedTraining).toBe(true);
  });

  it('does not flag a conflict when the logged training matches the plan', () => {
    const actual = item('easy-run', 'workout', { extracted: { workoutKind: 'outdoor_run', workoutName: 'Easy Run' } });
    const coach = buildDailyFuelCoach({ date, items: [meal('meal', 30, 100), actual], profile, plannedWorkout: planned('Easy Run') });
    expect(coach.basedOnLoggedTraining).toBe(false);
  });

  it('does not flag a conflict when there is no plan to compare against', () => {
    const actual = item('long-run', 'workout', { extracted: { workoutKind: 'outdoor_run', workoutName: 'Long Run' } });
    const coach = buildDailyFuelCoach({ date, items: [meal('meal', 30, 100), actual], profile });
    expect(coach.basedOnLoggedTraining).toBe(false);
  });

  it('honors explicit profile targets', () => {
    const custom = { ...profile, proteinTargetG: 95, carbTargetHardDayG: 280 };
    const coach = buildDailyFuelCoach({ date, items: [meal('meal', 95, 280)], profile: custom, plannedWorkout: planned('Tempo Run') });
    expect(coach.protein).toMatchObject({ minimum: 95, maximum: 95, source: 'profile', remainingToMinimum: 0 });
    expect(coach.carbs).toMatchObject({ minimum: 280, maximum: 280, source: 'profile', remainingToMinimum: 0 });
  });

  it('does not invent personal targets without body weight', () => {
    const coach = buildDailyFuelCoach({ date, items: [meal('meal', 20, 40)], profile: { displayName: 'Runner' } });
    expect(coach.status).toBe('needs_weight');
    expect(coach.protein).toBeNull();
    expect(coach.carbs).toBeNull();
  });

  it('keeps incomplete meal macros explicit', () => {
    const coach = buildDailyFuelCoach({ date, items: [meal('meal')], profile });
    expect(coach.recommendation.title).toBe('Complete The Macro Picture');
    expect(coach.protein?.logged).toBeNull();
  });
});
