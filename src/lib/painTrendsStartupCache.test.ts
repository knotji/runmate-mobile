import { beforeEach, describe, expect, it } from 'vitest';
import { buildPainTrend } from './painTrends';
import {
  clearPainTrendsStartupSnapshot,
  loadPainTrendsStartupSnapshot,
  savePainTrendsStartupSnapshot,
} from './painTrendsStartupCache';

describe('Pain Trends startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('reuses both ranges only on the same Bangkok day', () => {
    const snapshot = {
      sevenDay: buildPainTrend([], 7, '2026-07-27'),
      thirtyDay: buildPainTrend([], 30, '2026-07-27'),
    };
    savePainTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');

    expect(loadPainTrendsStartupSnapshot('2026-07-27T12:00:00.000Z')).toEqual(snapshot);
    expect(loadPainTrendsStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('rejects malformed data and supports sign-out clearing', () => {
    window.localStorage.setItem('runmate:pain-trends-startup:v1', '{"dateKey":"2026-07-27"}');
    expect(loadPainTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    const snapshot = {
      sevenDay: buildPainTrend([], 7, '2026-07-27'),
      thirtyDay: buildPainTrend([], 30, '2026-07-27'),
    };
    savePainTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');
    clearPainTrendsStartupSnapshot();
    expect(loadPainTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
