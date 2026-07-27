import { beforeEach, describe, expect, it } from 'vitest';
import { buildBodyWeightTrend } from './bodyWeightTrend';
import {
  clearBodyWeightTrendStartupSnapshot,
  loadBodyWeightTrendStartupSnapshot,
  saveBodyWeightTrendStartupSnapshot,
} from './bodyWeightTrendStartupCache';

describe('Body Weight Trend startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('reuses both ranges only on the same Bangkok day', () => {
    const snapshot = {
      sevenDay: buildBodyWeightTrend([], 7, '2026-07-27'),
      thirtyDay: buildBodyWeightTrend([], 30, '2026-07-27'),
    };
    saveBodyWeightTrendStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');

    expect(loadBodyWeightTrendStartupSnapshot('2026-07-27T12:00:00.000Z')).toEqual(snapshot);
    expect(loadBodyWeightTrendStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('rejects malformed data and supports sign-out clearing', () => {
    window.localStorage.setItem('runmate:body-weight-trend-startup:v1', '{"dateKey":"2026-07-27"}');
    expect(loadBodyWeightTrendStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    const snapshot = {
      sevenDay: buildBodyWeightTrend([], 7, '2026-07-27'),
      thirtyDay: buildBodyWeightTrend([], 30, '2026-07-27'),
    };
    saveBodyWeightTrendStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');
    clearBodyWeightTrendStartupSnapshot();
    expect(loadBodyWeightTrendStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
