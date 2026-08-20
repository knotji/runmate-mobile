import { describe, expect, it } from 'vitest';
import { applyProfileSettings, birthDateBounds, profileToSettingsDraft, validateProfileSettings } from './profileSettings';
import type { UserProfile } from '@/types/profile';

const profile: UserProfile = { displayName: 'Runner', maxHr: 190, timezone: 'UTC', fieldSources: { maxHr: 'history_analysis' } };

describe('Profile Settings', () => {
  it('preserves the rest of the shared profile and marks edited fields as manual', () => {
    const next = applyProfileSettings(profile, { birthDate: '1994-04-10', vo2max: '46.2', maxHr: '188', weightKg: '68.5', weeklyTrainingDays: '5', preferredLongRunDay: 'Sunday', preferredRunTime: 'morning', defaultWakeTime: '06:30', primaryGoal: '', secondaryGoals: [] });
    expect(next).toMatchObject({ displayName: 'Runner', birthDate: '1994-04-10', vo2max: 46.2, maxHr: 188, weightKg: 68.5, weeklyTrainingDays: 5, preferredLongRunDay: 'Sunday', preferredRunTime: 'morning', timezone: 'Asia/Bangkok' });
    expect(next.fieldSources?.maxHr).toBe('manual');
  });

  it('maps an existing profile into editable values', () => {
    expect(profileToSettingsDraft({ ...profile, birthDate: '1994-04-10', vo2max: 46.2, weightKg: 70, weeklyTrainingDays: 4, preferredLongRunDay: 'friday', preferredRunTime: 'evening' })).toEqual({ birthDate: '1994-04-10', vo2max: '46.2', maxHr: '190', weightKg: '70', weeklyTrainingDays: '4', preferredLongRunDay: 'Friday', preferredRunTime: 'evening', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] });
  });

  it('maps an existing goal profile into editable values and round-trips it back through applyProfileSettings', () => {
    const goalProfile = { primaryGoal: 'running_consistency' as const, secondaryGoals: ['six_pack' as const], guardrailGoals: ['stress_balance' as const] };
    const withGoals: UserProfile = { ...profile, goalProfile };
    const draft = profileToSettingsDraft(withGoals);
    expect(draft.primaryGoal).toBe('running_consistency');
    expect(draft.secondaryGoals).toEqual(['six_pack']);

    const next = applyProfileSettings(withGoals, { ...draft, primaryGoal: 'six_pack', secondaryGoals: ['running_consistency'] });
    expect(next.goalProfile).toEqual({ primaryGoal: 'six_pack', secondaryGoals: ['running_consistency'], guardrailGoals: ['stress_balance'] });
  });

  it('does not mark unchanged Health Connect weight as manual', () => {
    const healthProfile: UserProfile = { ...profile, weightKg: 68.5, fieldSources: { weightKg: 'health_connect' } };
    const next = applyProfileSettings(healthProfile, { birthDate: '', vo2max: '', maxHr: '190', weightKg: '68.5', weeklyTrainingDays: '', preferredLongRunDay: '', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] });
    expect(next.fieldSources?.weightKg).toBe('health_connect');
  });

  it('rejects unsafe physiological and planning values', () => {
    expect(validateProfileSettings({ birthDate: '', vo2max: '', maxHr: '300', weightKg: '70', weeklyTrainingDays: '4', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] })).toContain('Max Heart Rate');
    expect(validateProfileSettings({ birthDate: '', vo2max: '', maxHr: '190', weightKg: '20', weeklyTrainingDays: '4', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] })).toContain('Body Weight');
    expect(validateProfileSettings({ birthDate: '', vo2max: '', maxHr: '190', weightKg: '70', weeklyTrainingDays: '3.5', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] })).toContain('Whole Number');
    expect(validateProfileSettings({ birthDate: '', vo2max: '120', maxHr: '190', weightKg: '70', weeklyTrainingDays: '4', preferredLongRunDay: 'Sunday', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '', secondaryGoals: [] })).toContain('VO₂ Max');
  });

  it('uses Bangkok calendar boundaries for ages 18 through 100', () => {
    const base = { birthDate: '', vo2max: '', maxHr: '', weightKg: '', weeklyTrainingDays: '', preferredLongRunDay: '', preferredRunTime: '', defaultWakeTime: '', primaryGoal: '' as const, secondaryGoals: [] };
    expect(birthDateBounds('2026-08-04')).toEqual({ minimum: '1925-08-05', maximum: '2008-08-04' });
    expect(validateProfileSettings({ ...base, birthDate: '2008-08-04' }, '2026-08-04')).toBeNull();
    expect(validateProfileSettings({ ...base, birthDate: '2008-08-05' }, '2026-08-04')).toContain('Birth Date');
    expect(validateProfileSettings({ ...base, birthDate: '1925-08-04' }, '2026-08-04')).toContain('Birth Date');
    expect(validateProfileSettings({ ...base, birthDate: '2026-02-30' }, '2026-08-04')).toContain('Birth Date');
  });
});
