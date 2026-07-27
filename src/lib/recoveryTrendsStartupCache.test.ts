import { beforeEach, describe, expect, it } from 'vitest';
import { buildRecoveryTrend } from './recoveryTrends';
import {
  clearRecoveryTrendsStartupSnapshot,
  loadRecoveryTrendsStartupSnapshot,
  saveRecoveryTrendsStartupSnapshot,
} from './recoveryTrendsStartupCache';

describe('Recovery Trends startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('reuses both ranges only on the same Bangkok day', () => {
    const snapshot = {
      sevenDay: buildRecoveryTrend([], null, 7, '2026-07-27'),
      thirtyDay: buildRecoveryTrend([], null, 30, '2026-07-27'),
    };
    saveRecoveryTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');

    expect(loadRecoveryTrendsStartupSnapshot('2026-07-27T12:00:00.000Z')).toEqual(snapshot);
    expect(loadRecoveryTrendsStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('rejects malformed data and supports sign-out clearing', () => {
    window.localStorage.setItem('runmate:recovery-trends-startup:v1', '{"dateKey":"2026-07-27"}');
    expect(loadRecoveryTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    const snapshot = {
      sevenDay: buildRecoveryTrend([], null, 7, '2026-07-27'),
      thirtyDay: buildRecoveryTrend([], null, 30, '2026-07-27'),
    };
    saveRecoveryTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');
    clearRecoveryTrendsStartupSnapshot();
    expect(loadRecoveryTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
