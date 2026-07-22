import { beforeEach, describe, expect, it } from 'vitest';
import type { RunMateRecoverySystem } from './recoverySystem';
import {
  clearRecoveryStartupSnapshot,
  loadRecoveryStartupSnapshot,
  saveRecoveryStartupSnapshot,
} from './recoveryStartupCache';

const recovery = {
  model: 'whoop_style_v1',
  scoreState: 'scored',
  overallScore: 72,
  strain: { score: 4 },
  sleepPerformance: { score: 76 },
} as RunMateRecoverySystem;

describe('Recovery startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('restores a snapshot only during the same Bangkok day', () => {
    saveRecoveryStartupSnapshot(recovery, '2026-07-22T01:00:00.000Z');

    expect(loadRecoveryStartupSnapshot('2026-07-22T12:00:00.000Z')).toEqual(recovery);
    expect(loadRecoveryStartupSnapshot('2026-07-22T18:00:00.000Z')).toBeNull();
  });

  it('removes invalid data instead of blocking Recovery startup', () => {
    window.localStorage.setItem('runmate:recovery-startup:v1', '{bad-json');

    expect(loadRecoveryStartupSnapshot('2026-07-22T12:00:00.000Z')).toBeNull();
    expect(window.localStorage.getItem('runmate:recovery-startup:v1')).toBeNull();
  });

  it('can be cleared when the account signs out', () => {
    saveRecoveryStartupSnapshot(recovery, '2026-07-22T12:00:00.000Z');
    clearRecoveryStartupSnapshot();

    expect(loadRecoveryStartupSnapshot('2026-07-22T12:00:00.000Z')).toBeNull();
  });
});
