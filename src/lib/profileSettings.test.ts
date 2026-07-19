import { describe, expect, it } from 'vitest';
import { applyProfileSettings, profileToSettingsDraft, validateProfileSettings } from './profileSettings';
import type { UserProfile } from '@/types/profile';

const profile: UserProfile = { displayName: 'Runner', maxHr: 190, timezone: 'UTC', fieldSources: { maxHr: 'history_analysis' } };

describe('Profile Settings', () => {
  it('preserves the rest of the shared profile and marks edited fields as manual', () => {
    const next = applyProfileSettings(profile, { maxHr: '188', weightKg: '68.5', weeklyTrainingDays: '5', preferredLongRunDay: 'Sunday', preferredRunTime: 'morning', defaultWakeTime: '06:30' });
    expect(next).toMatchObject({ displayName: 'Runner', maxHr: 188, weightKg: 68.5, weeklyTrainingDays: 5, preferredLongRunDay: 'Sunday', preferredRunTime: 'morning', timezone: 'Asia/Bangkok' });
    expect(next.fieldSources?.maxHr).toBe('manual');
  });

  it('maps an existing profile into editable values', () => {
    expect(profileToSettingsDraft({ ...profile, weightKg: 70, weeklyTrainingDays: 4, preferredLongRunDay: 'friday', preferredRunTime: 'evening' })).toEqual({ maxHr: '190', weightKg: '70', weeklyTrainingDays: '4', preferredLongRunDay: 'Friday', preferredRunTime: 'evening', defaultWakeTime: '' });
  });

  it('does not mark unchanged Health Connect weight as manual', () => {
    const healthProfile: UserProfile = { ...profile, weightKg: 68.5, fieldSources: { weightKg: 'health_connect' } };
    const next = applyProfileSettings(healthProfile, { maxHr: '190', weightKg: '68.5', weeklyTrainingDays: '', preferredLongRunDay: '', preferredRunTime: '', defaultWakeTime: '' });
    expect(next.fieldSources?.weightKg).toBe('health_connect');
  });

  it('rejects unsafe physiological and planning values', () => {
    expect(validateProfileSettings({ maxHr: '300', weightKg: '70', weeklyTrainingDays: '4', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '' })).toContain('Max Heart Rate');
    expect(validateProfileSettings({ maxHr: '190', weightKg: '20', weeklyTrainingDays: '4', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '' })).toContain('Body Weight');
    expect(validateProfileSettings({ maxHr: '190', weightKg: '70', weeklyTrainingDays: '3.5', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '' })).toContain('Whole Number');
  });
});
