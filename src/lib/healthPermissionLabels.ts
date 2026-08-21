import type { HealthDataType } from '@capgo/capacitor-health';

/** Mirrors HealthTestPage's refreshConnection() permission grouping so connect()'s message names exactly what was denied, instead of only ever mentioning Sleep. */
export function missingPermissionLabels(readAuthorized: HealthDataType[]): string[] {
  const missing: string[] = [];
  if (!readAuthorized.includes('sleep')) missing.push('Sleep');
  if (!['workouts', 'heartRate', 'distance', 'calories', 'vo2Max'].every((type) => readAuthorized.includes(type as HealthDataType))) missing.push('Workouts');
  if (!['heartRateVariability', 'restingHeartRate', 'respiratoryRate'].every((type) => readAuthorized.includes(type as HealthDataType))) missing.push('Recovery Signals');
  if (!readAuthorized.includes('weight')) missing.push('Weight');
  return missing;
}
