import { describe, expect, it } from 'vitest';
import { missingPermissionLabels } from '@/lib/healthPermissionLabels';

describe('missingPermissionLabels', () => {
  it('names every denied permission group, not just Sleep', () => {
    // Regression coverage for HealthTestPage's connect() previously gating the
    // *entire* sync on Sleep alone and only ever mentioning Sleep in its message,
    // even when Workouts, Recovery Signals, or Weight permission was also denied.
    expect(missingPermissionLabels([])).toEqual(['Sleep', 'Workouts', 'Recovery Signals', 'Weight']);
    expect(missingPermissionLabels(['workouts', 'heartRate', 'distance', 'calories', 'vo2Max', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate', 'weight'])).toEqual(['Sleep']);
    expect(missingPermissionLabels(['sleep', 'workouts', 'heartRate', 'distance', 'calories', 'vo2Max', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate'])).toEqual(['Weight']);
    expect(missingPermissionLabels(['sleep', 'workouts', 'heartRate', 'distance', 'calories', 'vo2Max', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate', 'weight'])).toEqual([]);
  });
});
