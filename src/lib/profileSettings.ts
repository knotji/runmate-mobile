import type { UserProfile } from '@/types/profile';
import { shiftDate, todayBangkokDateKey } from '@/lib/date';
import type { GoalType } from '@/lib/goals/goalTypes';

export type ProfileSettingsDraft = {
  birthDate: string;
  vo2max: string;
  maxHr: string;
  weightKg: string;
  weeklyTrainingDays: string;
  preferredLongRunDay: string;
  preferredRunTime: string;
  defaultWakeTime: string;
  primaryGoal: GoalType | '';
  secondaryGoals: GoalType[];
};

export function profileToSettingsDraft(profile: UserProfile): ProfileSettingsDraft {
  return {
    birthDate: profile.birthDate ?? '',
    vo2max: profile.vo2max == null ? '' : String(profile.vo2max),
    maxHr: profile.maxHr == null ? '' : String(profile.maxHr),
    weightKg: profile.weightKg == null ? '' : String(profile.weightKg),
    weeklyTrainingDays: profile.weeklyTrainingDays == null ? '' : String(profile.weeklyTrainingDays),
    preferredLongRunDay: normalizeDay(profile.preferredLongRunDay),
    preferredRunTime: profile.preferredRunTime ?? '',
    defaultWakeTime: '',
    primaryGoal: profile.goalProfile?.primaryGoal ?? '',
    secondaryGoals: profile.goalProfile?.secondaryGoals ?? [],
  };
}

export function applyProfileSettings(profile: UserProfile, draft: ProfileSettingsDraft): UserProfile {
  const error = validateProfileSettings(draft);
  if (error) throw new Error(error);
  return {
    ...profile,
    birthDate: draft.birthDate || undefined,
    vo2max: optionalNumber(draft.vo2max),
    maxHr: optionalNumber(draft.maxHr),
    weightKg: optionalNumber(draft.weightKg),
    weeklyTrainingDays: optionalNumber(draft.weeklyTrainingDays),
    preferredLongRunDay: draft.preferredLongRunDay || undefined,
    preferredRunTime: isPreferredRunTime(draft.preferredRunTime) ? draft.preferredRunTime : undefined,
    timezone: 'Asia/Bangkok',
    fieldSources: changedSources(profile, draft),
    // guardrailGoals/raceGoal/bodyGoal/lifestyleGoal have no editor yet — keep
    // whatever the profile already had for them, only primaryGoal/
    // secondaryGoals are editable from this page.
    goalProfile: draft.primaryGoal ? {
      ...profile.goalProfile,
      primaryGoal: draft.primaryGoal,
      secondaryGoals: draft.secondaryGoals,
      guardrailGoals: profile.goalProfile?.guardrailGoals ?? [],
    } : profile.goalProfile,
  };
}

function changedSources(profile: UserProfile, draft: ProfileSettingsDraft): UserProfile['fieldSources'] {
  const sources: NonNullable<UserProfile['fieldSources']> = { ...profile.fieldSources, timezone: 'manual' };
  if ((draft.birthDate || undefined) !== profile.birthDate) sources.birthDate = 'manual';
  if (optionalNumber(draft.vo2max) !== profile.vo2max) sources.vo2max = 'manual';
  if (optionalNumber(draft.maxHr) !== profile.maxHr) sources.maxHr = 'manual';
  if (optionalNumber(draft.weightKg) !== profile.weightKg) sources.weightKg = 'manual';
  if (optionalNumber(draft.weeklyTrainingDays) !== profile.weeklyTrainingDays) sources.weeklyTrainingDays = 'manual';
  if ((draft.preferredLongRunDay || undefined) !== profile.preferredLongRunDay) sources.preferredLongRunDay = 'manual';
  if ((draft.preferredRunTime || undefined) !== profile.preferredRunTime) sources.preferredRunTime = 'manual';
  return sources;
}

export function validateProfileSettings(draft: ProfileSettingsDraft, today = todayBangkokDateKey()): string | null {
  if (draft.birthDate) {
    const age = ageOnDate(draft.birthDate, today);
    if (age == null || age < 18 || age > 100) return 'Birth Date Must Give An Age Between 18 And 100.';
  }
  const vo2max = optionalNumber(draft.vo2max);
  if (draft.vo2max && (vo2max == null || vo2max < 10 || vo2max > 100)) return 'VO₂ Max Must Be Between 10 And 100.';
  const maxHr = optionalNumber(draft.maxHr);
  if (draft.maxHr && (maxHr == null || maxHr < 100 || maxHr > 240)) return 'Max Heart Rate Must Be Between 100 And 240 bpm.';
  const weight = optionalNumber(draft.weightKg);
  if (draft.weightKg && (weight == null || weight < 30 || weight > 300)) return 'Body Weight Must Be Between 30 And 300 kg.';
  const days = optionalNumber(draft.weeklyTrainingDays);
  if (draft.weeklyTrainingDays && (days == null || !Number.isInteger(days) || days < 1 || days > 7)) return 'Training Days Must Be A Whole Number Between 1 And 7.';
  if (draft.defaultWakeTime && !/^\d{2}:\d{2}$/.test(draft.defaultWakeTime)) return 'Choose A Valid Default Wake Time.';
  return null;
}

export function birthDateBounds(today = todayBangkokDateKey()): { minimum: string; maximum: string } {
  return { minimum: shiftDate(shiftYear(today, -101), 1), maximum: shiftYear(today, -18) };
}

function ageOnDate(birthDate: string, today: string): number | null {
  if (!isDateKey(birthDate) || !isDateKey(today)) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
  return todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function shiftYear(dateKey: string, years: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function isPreferredRunTime(value: string): value is NonNullable<UserProfile['preferredRunTime']> {
  return ['morning', 'evening', 'night', 'flexible'].includes(value);
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeDay(value: string | undefined): string {
  if (!value) return '';
  const match = DAYS.find((day) => day.toLowerCase() === value.toLowerCase());
  return match ?? '';
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
