import { describe, expect, it } from 'vitest';
import { buildRecoveryWhy } from './recoveryWhy';
import type { RunMateRecoverySystem } from './recoverySystem';

function recovery(scoreState: string, factors: Array<{ key: string; label: string; direction: string; detail: string; weight: number }>): RunMateRecoverySystem {
  return { scoreState, dataFreshness: { latestSleepDate: '2026-08-19' }, recovery: { factors } } as unknown as RunMateRecoverySystem;
}

describe('buildRecoveryWhy', () => {
  it('surfaces helping factors before hurting ones, ready status', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'sleepPerformance', label: 'Sleep Performance', direction: 'helping', detail: 'Sleep helped — 7h 40m, above your need', weight: 0.2 },
      { key: 'restingHR', label: 'Resting HR', direction: 'hurting', detail: 'Resting HR was above baseline — 58 vs 52 bpm', weight: 0.4 },
    ]));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.factors.map((f) => f.tone)).toEqual(['up', 'down']);
    expect(result.factors[0].detail).toContain('Sleep helped');
  });

  it('caps at 3 factors', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'a', label: 'A', direction: 'helping', detail: 'a', weight: 0.4 },
      { key: 'b', label: 'B', direction: 'helping', detail: 'b', weight: 0.3 },
      { key: 'c', label: 'C', direction: 'hurting', detail: 'c', weight: 0.2 },
      { key: 'd', label: 'D', direction: 'hurting', detail: 'd', weight: 0.1 },
    ]));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.factors).toHaveLength(3);
  });

  it('surfaces a real safety-cap hurting factor even though its weight is 0 (pain/sick are not scored, but are real)', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'pain', label: 'Active Pain', direction: 'hurting', detail: "Active pain (level 6/10) is capping today's Recovery score for safety.", weight: 0 },
    ]));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.factors[0].label).toBe('Active Pain');
  });

  it('includes one unavailable factor when there is room, muted, rather than silently dropping it', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'sleepPerformance', label: 'Sleep Performance', direction: 'helping', detail: 'Sleep helped', weight: 0.2 },
      { key: 'restingHR', label: 'Resting HR', direction: 'hurting', detail: 'Resting HR elevated', weight: 0.4 },
      { key: 'hrv', label: 'HRV', direction: 'unavailable', detail: 'Still building your personal HRV baseline.', weight: 0 },
    ]));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.factors).toHaveLength(3);
    expect(result.factors.at(-1)).toMatchObject({ key: 'hrv', tone: 'unavailable' });
  });

  it('does not add an unavailable factor once helping+hurting already fill the cap', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'a', label: 'A', direction: 'helping', detail: 'a', weight: 0.4 },
      { key: 'b', label: 'B', direction: 'helping', detail: 'b', weight: 0.3 },
      { key: 'c', label: 'C', direction: 'hurting', detail: 'c', weight: 0.2 },
      { key: 'hrv', label: 'HRV', direction: 'unavailable', detail: 'unavailable', weight: 0 },
    ]));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.factors.some((f) => f.tone === 'unavailable')).toBe(false);
  });

  it('is unavailable — no factor lines at all — when the underlying explanation is not ready (stale)', () => {
    expect(buildRecoveryWhy(recovery('stale', []))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable — no factor lines at all — when the underlying explanation is not ready (pending/unscorable)', () => {
    expect(buildRecoveryWhy(recovery('pending', []))).toEqual({ status: 'unavailable' });
    expect(buildRecoveryWhy(recovery('unscorable', []))).toEqual({ status: 'unavailable' });
  });

  it('is unavailable when scored but every factor came back unavailable (nothing real to explain the score with)', () => {
    const result = buildRecoveryWhy(recovery('scored', [
      { key: 'hrv', label: 'HRV', direction: 'unavailable', detail: 'unavailable', weight: 0 },
      { key: 'restingHR', label: 'Resting HR', direction: 'unavailable', detail: 'unavailable', weight: 0 },
    ]));
    expect(result).toEqual({ status: 'unavailable' });
  });
});
