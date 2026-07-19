import { describe, expect, it } from 'vitest';
import { isMeaningfulRecoveryChange, isRestWorkout, preferredTrainingMinutes } from './notificationPreferences';

describe('Notification Rules', () => {
  it('maps Profile training preferences to reminder times', () => {
    expect(preferredTrainingMinutes('morning')).toBe(390);
    expect(preferredTrainingMinutes('evening')).toBe(1080);
    expect(preferredTrainingMinutes('flexible')).toBe(1050);
  });
  it('does not remind for rest days', () => expect(isRestWorkout('Rest Day')).toBe(true));
  it('alerts only for meaningful Recovery movement', () => {
    expect(isMeaningfulRecoveryChange(70, 84)).toBe(false);
    expect(isMeaningfulRecoveryChange(70, 85)).toBe(true);
  });
});
