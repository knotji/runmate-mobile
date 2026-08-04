import { describe, expect, it } from 'vitest';
import { buildFitnessAge } from '@/lib/fitnessAge';
import { shiftDate } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { UserProfile } from '@/types/profile';

const today = '2026-08-04';
const profile: UserProfile = { displayName: 'Runner', birthDate: '1994-04-10', gender: 'male', vo2max: 48 };

function item(type: LocalHistoryItem['type'], date: string, data: Record<string, unknown>): LocalHistoryItem {
  return { id: `${type}-${date}`, type, createdAt: `${date}T12:00:00+07:00`, dateKey: date, data };
}

function completeHistory(): LocalHistoryItem[] {
  const sleeps = Array.from({ length: 12 }, (_, index) => item('sleep', shiftDate(today, -(index * 3)), {
    extracted: { actualSleepDurationMinutes: 450, restingHR: 50, hrv: 72 },
  }));
  const workouts = Array.from({ length: 6 }, (_, index) => item('workout', shiftDate(today, -(index * 6)), {
    extracted: { vo2Max: 48, workoutKind: 'outdoor_run' },
  }));
  return [...sleeps, ...workouts];
}

describe('RunMate Fitness Age', () => {
  it('builds a bounded, explainable estimate only after minimum coverage', () => {
    const result = buildFitnessAge(profile, completeHistory(), today);
    expect(result.status).toBe('ready');
    expect(result.chronologicalAge).toBe(32);
    expect(result.fitnessAge).toBeGreaterThanOrEqual(22);
    expect(result.fitnessAge).toBeLessThan(32);
    expect(result.confidence).toBe('medium');
    expect(result.signals.map((signal) => signal.key)).toEqual(expect.arrayContaining(['vo2', 'sleep', 'rhr', 'hrv', 'training']));
  });

  it('shows a building state instead of guessing when required signals are missing', () => {
    const result = buildFitnessAge({ ...profile, vo2max: undefined }, completeHistory().filter((entry) => entry.type === 'sleep'), today);
    expect(result.status).toBe('building');
    expect(result.fitnessAge).toBeNull();
    expect(result.missing).toEqual(expect.arrayContaining(['VO₂ Max', '4 more workout days']));
  });

  it('calculates chronological age against the Bangkok calendar date', () => {
    expect(buildFitnessAge({ ...profile, birthDate: '1994-08-05' }, completeHistory(), today).chronologicalAge).toBe(31);
  });

  it('never moves the estimate more than ten years from actual age', () => {
    const result = buildFitnessAge({ ...profile, vo2max: 100 }, completeHistory(), today);
    expect(result.fitnessAge).toBeGreaterThanOrEqual(22);
  });

  it('uses the latest workout VO₂ Max while retaining the 90-day average', () => {
    const history = completeHistory();
    const latest = history.find((entry) => entry.type === 'workout' && entry.dateKey === today)!;
    latest.data = { extracted: { vo2Max: 47.8, workoutKind: 'outdoor_run' } };
    const older = history.find((entry) => entry.type === 'workout' && entry.dateKey === shiftDate(today, -6))!;
    older.data = { extracted: { vo2Max: 46.8, workoutKind: 'outdoor_run' } };
    const result = buildFitnessAge(profile, history, today);
    expect(result.metrics.vo2Max).toBe(47.8);
    expect(result.metrics.vo2MaxAverage).toBeCloseTo(47.77, 1);
    expect(result.metrics.vo2MaxDate).toBe(today);
    expect(result.signals.find((signal) => signal.key === 'vo2')?.detail).toContain('90-day average 47.8');
  });
});
