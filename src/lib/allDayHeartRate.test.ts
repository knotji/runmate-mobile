import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthSample } from '@capgo/capacitor-health';
import { clearAllDayHeartRateStore, describeAllDayHeartRateSync, loadAllDayHeartRateStore, mergeHeartRateSamples, summarizeAllDayHeartRate, type AllDayHeartRateSyncResult } from './allDayHeartRate';

const sample = (at: string, value: number, sourceId = 'samsung'): HealthSample => ({
  dataType: 'heartRate', value, unit: 'bpm', startDate: at, endDate: at, sourceId,
});

describe('all-day heart rate timeline', () => {
  beforeEach(() => { window.localStorage.clear(); vi.useRealTimers(); });

  it('groups samples into five-minute buckets and removes duplicates', () => {
    const input = [
      sample('2026-08-06T01:01:00.000Z', 80),
      sample('2026-08-06T01:02:00.000Z', 100),
      sample('2026-08-06T01:02:00.000Z', 100),
      sample('2026-08-06T01:06:00.000Z', 70),
    ];
    const result = mergeHeartRateSamples(loadAllDayHeartRateStore(), input, {
      readStart: '2026-08-06T01:00:00.000Z', syncedAt: '2026-08-06T02:00:00.000Z', fullSyncDate: '2026-08-06',
    });
    expect(result.store.buckets).toEqual([
      { start: '2026-08-06T01:00:00.000Z', averageBpm: 90, minimumBpm: 80, maximumBpm: 100, sampleCount: 2 },
      { start: '2026-08-06T01:05:00.000Z', averageBpm: 70, minimumBpm: 70, maximumBpm: 70, sampleCount: 1 },
    ]);
  });

  it('replaces the overlap window instead of double-counting a repeated incremental read', () => {
    const first = mergeHeartRateSamples(loadAllDayHeartRateStore(), [sample('2026-08-06T01:01:00.000Z', 80)], {
      readStart: '2026-08-06T01:00:00.000Z', syncedAt: '2026-08-06T01:10:00.000Z',
    }).store;
    const second = mergeHeartRateSamples(first, [sample('2026-08-06T01:01:00.000Z', 82)], {
      readStart: '2026-08-06T01:00:00.000Z', syncedAt: '2026-08-06T01:15:00.000Z',
    }).store;
    expect(second.buckets).toHaveLength(1);
    expect(second.buckets[0].averageBpm).toBe(82);
  });

  it('reports timeline coverage and freshness without inventing missing samples', () => {
    const store = mergeHeartRateSamples(loadAllDayHeartRateStore(), [
      sample('2026-08-06T01:00:00.000Z', 70), sample('2026-08-06T01:10:00.000Z', 80),
    ], { readStart: '2026-08-06T01:00:00.000Z', syncedAt: '2026-08-06T01:15:00.000Z' }).store;
    const summary = summarizeAllDayHeartRate(store, '2026-08-06', Date.parse('2026-08-06T01:30:00.000Z'));
    expect(summary.coveragePercent).toBe(67);
    expect(summary.averageBpm).toBe(75);
    expect(summary.freshness).toBe('current');
  });

  it('clears locally retained health-rate data', () => {
    window.localStorage.setItem('runmate:all-day-heart-rate:v1', '{}');
    clearAllDayHeartRateStore();
    expect(window.localStorage.length).toBe(0);
  });

  it('keeps permission and provider-delay states distinct when no samples exist', () => {
    const summary = summarizeAllDayHeartRate(loadAllDayHeartRateStore(), '2026-08-06');
    const result = (status: AllDayHeartRateSyncResult['status']): AllDayHeartRateSyncResult => ({
      status, dataSource: 'none', samplesRead: 0, bucketsUpdated: 0, summary,
    });
    expect(describeAllDayHeartRateSync(summary, result('permission_required'), false, true)).toMatchObject({ kind: 'permission', action: 'permissions' });
    expect(describeAllDayHeartRateSync(summary, result('unavailable'), false, false)).toMatchObject({ kind: 'unavailable', action: null });
    expect(describeAllDayHeartRateSync(summary, result('synced'), false, true)).toMatchObject({ kind: 'provider_wait', action: 'sync' });
  });

  it('keeps the latest timeline visible while a refresh is running', () => {
    const store = mergeHeartRateSamples(loadAllDayHeartRateStore(), [sample('2026-08-06T01:01:00.000Z', 80)], {
      readStart: '2026-08-06T01:00:00.000Z', syncedAt: '2026-08-06T01:10:00.000Z',
    }).store;
    const summary = summarizeAllDayHeartRate(store, '2026-08-06', Date.parse('2026-08-06T01:15:00.000Z'));
    expect(describeAllDayHeartRateSync(summary, null, true, true)).toMatchObject({ kind: 'loading', title: 'Updating heart-rate data' });
  });
});
