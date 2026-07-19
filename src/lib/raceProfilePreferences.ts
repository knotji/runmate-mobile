import type { UserProfile } from '@/types/profile';
import type { RaceGoal } from '@/types/race';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function applyProfilePreferencesToRaceGoal(goal: RaceGoal, profile: UserProfile): RaceGoal {
  const trainingDays = profile.weeklyTrainingDays;
  const longRunDay = normalizeProfileDay(profile.preferredLongRunDay);
  return {
    ...goal,
    trainingDaysPerWeek: trainingDays != null && trainingDays >= 1 && trainingDays <= 7 ? trainingDays : goal.trainingDaysPerWeek,
    preferredLongRunDay: longRunDay ?? goal.preferredLongRunDay,
    currentLongestRunKm: profile.currentLongestRunKm ?? goal.currentLongestRunKm,
  };
}

export function normalizeProfileDay(value?: string): string | undefined {
  if (!value) return undefined;
  const english = DAYS.find((day) => day.toLowerCase() === value.toLowerCase());
  if (english) return english;
  const thaiDays: Record<string, string> = {
    'จันทร์': 'Monday', 'วันจันทร์': 'Monday', 'อังคาร': 'Tuesday', 'วันอังคาร': 'Tuesday',
    'พุธ': 'Wednesday', 'วันพุธ': 'Wednesday', 'พฤหัสบดี': 'Thursday', 'วันพฤหัสบดี': 'Thursday',
    'ศุกร์': 'Friday', 'วันศุกร์': 'Friday', 'เสาร์': 'Saturday', 'วันเสาร์': 'Saturday',
    'อาทิตย์': 'Sunday', 'วันอาทิตย์': 'Sunday',
  };
  return thaiDays[value];
}
