import { beforeEach, describe, expect, it } from 'vitest';
import { defaultProfile } from '@/types/profile';
import {
  clearProfileSettingsStartupSnapshot,
  loadProfileSettingsStartupSnapshot,
  saveProfileSettingsStartupSnapshot,
} from './profileSettingsStartupCache';

describe('Profile Settings startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('reuses prepared profile data only on the same Bangkok day', () => {
    const snapshot = {
      profile: { ...defaultProfile, maxHr: 195, weightKg: 51.6 },
      observedHr: { bpm: 195 },
      restingHrBaseline: 47,
      defaultWakeTime: 360,
    };
    saveProfileSettingsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');

    expect(loadProfileSettingsStartupSnapshot('2026-07-27T12:00:00.000Z')).toEqual(snapshot);
    expect(loadProfileSettingsStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('rejects malformed data and supports sign-out clearing', () => {
    window.localStorage.setItem('runmate:profile-settings-startup:v1', '{"dateKey":"2026-07-27"}');
    expect(loadProfileSettingsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    saveProfileSettingsStartupSnapshot({
      profile: defaultProfile,
      observedHr: null,
      restingHrBaseline: null,
      defaultWakeTime: null,
    }, '2026-07-27T05:00:00.000Z');
    clearProfileSettingsStartupSnapshot();
    expect(loadProfileSettingsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
