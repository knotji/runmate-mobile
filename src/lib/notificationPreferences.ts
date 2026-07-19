export type NotificationPreferences = {
  bedtime: boolean;
  missingSleep: boolean;
  plannedWorkout: boolean;
  recoveryChange: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  bedtime: true,
  missingSleep: true,
  plannedWorkout: true,
  recoveryChange: true,
};

const KEY = 'runmate:notification-preferences:v1';

export function loadNotificationPreferences(): NotificationPreferences {
  try { return { ...defaultNotificationPreferences, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return defaultNotificationPreferences; }
}

export function saveNotificationPreferences(value: NotificationPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(value));
}

export function preferredTrainingMinutes(value?: string): number {
  if (value === 'morning') return 6 * 60 + 30;
  if (value === 'evening') return 18 * 60;
  if (value === 'night') return 20 * 60;
  return 17 * 60 + 30;
}

export function isRestWorkout(workoutType?: string): boolean {
  return /rest|recovery day|พัก/i.test(workoutType ?? '');
}

export function isMeaningfulRecoveryChange(previous: number | null, current: number | null, threshold = 15): boolean {
  return previous != null && current != null && Math.abs(current - previous) >= threshold;
}
