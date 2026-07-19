import type { UserProfile } from '@/types/profile';

export type ProfileSettingsDraft = {
  maxHr: string;
  weightKg: string;
  weeklyTrainingDays: string;
  preferredLongRunDay: string;
  preferredRunTime: string;
  defaultWakeTime: string;
};

export function profileToSettingsDraft(profile: UserProfile): ProfileSettingsDraft {
  return {
    maxHr: profile.maxHr == null ? '' : String(profile.maxHr),
    weightKg: profile.weightKg == null ? '' : String(profile.weightKg),
    weeklyTrainingDays: profile.weeklyTrainingDays == null ? '' : String(profile.weeklyTrainingDays),
    preferredLongRunDay: normalizeDay(profile.preferredLongRunDay),
    preferredRunTime: profile.preferredRunTime ?? '',
    defaultWakeTime: '',
  };
}

export function applyProfileSettings(profile: UserProfile, draft: ProfileSettingsDraft): UserProfile {
  const error = validateProfileSettings(draft);
  if (error) throw new Error(error);
  return {
    ...profile,
    maxHr: optionalNumber(draft.maxHr),
    weightKg: optionalNumber(draft.weightKg),
    weeklyTrainingDays: optionalNumber(draft.weeklyTrainingDays),
    preferredLongRunDay: draft.preferredLongRunDay || undefined,
    preferredRunTime: isPreferredRunTime(draft.preferredRunTime) ? draft.preferredRunTime : undefined,
    timezone: 'Asia/Bangkok',
    fieldSources: changedSources(profile, draft),
  };
}

function changedSources(profile: UserProfile, draft: ProfileSettingsDraft): UserProfile['fieldSources'] {
  const sources: NonNullable<UserProfile['fieldSources']> = { ...profile.fieldSources, timezone: 'manual' };
  if (optionalNumber(draft.maxHr) !== profile.maxHr) sources.maxHr = 'manual';
  if (optionalNumber(draft.weightKg) !== profile.weightKg) sources.weightKg = 'manual';
  if (optionalNumber(draft.weeklyTrainingDays) !== profile.weeklyTrainingDays) sources.weeklyTrainingDays = 'manual';
  if ((draft.preferredLongRunDay || undefined) !== profile.preferredLongRunDay) sources.preferredLongRunDay = 'manual';
  if ((draft.preferredRunTime || undefined) !== profile.preferredRunTime) sources.preferredRunTime = 'manual';
  return sources;
}

export function validateProfileSettings(draft: ProfileSettingsDraft): string | null {
  const maxHr = optionalNumber(draft.maxHr);
  if (draft.maxHr && (maxHr == null || maxHr < 100 || maxHr > 240)) return 'Max Heart Rate Must Be Between 100 And 240 bpm.';
  const weight = optionalNumber(draft.weightKg);
  if (draft.weightKg && (weight == null || weight < 30 || weight > 300)) return 'Body Weight Must Be Between 30 And 300 kg.';
  const days = optionalNumber(draft.weeklyTrainingDays);
  if (draft.weeklyTrainingDays && (days == null || !Number.isInteger(days) || days < 1 || days > 7)) return 'Training Days Must Be A Whole Number Between 1 And 7.';
  if (draft.defaultWakeTime && !/^\d{2}:\d{2}$/.test(draft.defaultWakeTime)) return 'Choose A Valid Default Wake Time.';
  return null;
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
