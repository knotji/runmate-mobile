import { beforeEach, describe, expect, it } from 'vitest';
import type { RunMateRecoverySystem } from './recoverySystem';
import type { CoachContext } from './buildCoachContext';
import {
  clearRecoveryStartupSnapshot,
  loadRecoveryContextStartupSnapshot,
  loadRecoveryContextStartupEntry,
  loadRecoveryStartupEntry,
  loadRecoveryStartupSnapshot,
  saveRecoveryContextStartupSnapshot,
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

  it('exposes the saved timestamp for freshness and fallback UI', () => {
    saveRecoveryStartupSnapshot(recovery, '2026-07-22T01:00:00.000Z');

    expect(loadRecoveryStartupEntry('2026-07-22T12:00:00.000Z')).toMatchObject({
      dateKey: '2026-07-22',
      savedAt: '2026-07-22T01:00:00.000Z',
      recovery,
    });
  });

  it('removes invalid data instead of blocking Recovery startup', () => {
    window.localStorage.setItem('runmate:recovery-startup:v1', '{bad-json');

    expect(loadRecoveryStartupSnapshot('2026-07-22T12:00:00.000Z')).toBeNull();
    expect(window.localStorage.getItem('runmate:recovery-startup:v1')).toBeNull();
  });

  it('can be cleared when the account signs out', () => {
    saveRecoveryStartupSnapshot(recovery, '2026-07-22T12:00:00.000Z');
    saveRecoveryContextStartupSnapshot({
      todayDate: '2026-07-22',
      recoverySystem: recovery,
      recoveryLoop: {},
    } as CoachContext, '2026-07-22T12:00:00.000Z');
    clearRecoveryStartupSnapshot();

    expect(loadRecoveryStartupSnapshot('2026-07-22T12:00:00.000Z')).toBeNull();
    expect(loadRecoveryContextStartupSnapshot('2026-07-22T12:00:00.000Z')).toBeNull();
  });

  it('restores full-page context only during the same Bangkok day', () => {
    const context = {
      todayDate: '2026-07-22',
      recoverySystem: recovery,
      recoveryLoop: {},
    } as CoachContext;
    saveRecoveryContextStartupSnapshot(context, '2026-07-22T01:00:00.000Z');

    expect(loadRecoveryContextStartupSnapshot('2026-07-22T12:00:00.000Z')).toEqual(context);
    expect(loadRecoveryContextStartupSnapshot('2026-07-22T18:00:00.000Z')).toBeNull();
  });

  it('exposes full-context saved time for downstream freshness guards', () => {
    const context = {
      todayDate: '2026-07-22',
      recoverySystem: recovery,
      recoveryLoop: {},
    } as CoachContext;
    saveRecoveryContextStartupSnapshot(context, '2026-07-22T01:00:00.000Z');

    expect(loadRecoveryContextStartupEntry('2026-07-22T12:00:00.000Z')?.savedAt).toBe('2026-07-22T01:00:00.000Z');
  });
});
