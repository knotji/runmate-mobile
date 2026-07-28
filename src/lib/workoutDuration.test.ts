import { describe, expect, it } from 'vitest';
import { workoutDurationMinutes, workoutDurationText } from './workoutDuration';

describe('workout duration normalization', () => {
  it('preserves the supplied display duration', () => {
    expect(workoutDurationText({ duration: '48:55', activeDurationSeconds: 2935 })).toBe('48:55');
    expect(workoutDurationMinutes({ duration: '48:55', activeDurationSeconds: 2935 })).toBeCloseTo(48.9167, 3);
  });

  it('uses Health Connect active seconds when display duration is absent', () => {
    const extracted = { activeDurationSeconds: 2779 };
    expect(workoutDurationText(extracted)).toBe('46:19');
    expect(workoutDurationMinutes(extracted)).toBeCloseTo(46.3167, 3);
  });

  it('falls back to minute fields used by manual strength logs', () => {
    expect(workoutDurationText({}, { durationMin: 35 })).toBe('35 min');
    expect(workoutDurationMinutes({}, { durationMin: 35 })).toBe(35);
  });
});
