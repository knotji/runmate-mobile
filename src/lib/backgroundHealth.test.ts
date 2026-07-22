import { describe, expect, it } from 'vitest';
import { backgroundHealthRecordKey, backgroundHealthSupported, describeBackgroundHealthIssue, isPreparedHealthSnapshotFresh, type BackgroundHealthStatus } from './backgroundHealth';

describe('background health', () => {
  it('uses the same stable record key as native notification dedupe', () => {
    expect(backgroundHealthRecordKey({ platformId: ' sleep-1 ', sourceId: 'source', startDate: 'start', endDate: 'end' })).toBe('sleep-1');
    expect(backgroundHealthRecordKey({ sourceId: 'source', startDate: 'start', endDate: 'end', workoutType: 'running' })).toBe('source|start|end|running');
  });
  it('stays unavailable in the browser test environment', () => {
    expect(backgroundHealthSupported()).toBe(false);
  });

  it('accepts only bounded, non-future prepared snapshots', () => {
    const now = Date.parse('2026-07-22T12:00:00.000Z');
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T11:00:00.000Z' }, now)).toBe(true);
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T10:00:00.000Z' }, now)).toBe(false);
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T12:01:00.000Z' }, now)).toBe(false);
  });

  it('explains actionable background restrictions and healthy status', () => {
    const status: BackgroundHealthStatus = {
      available: true,
      authorized: true,
      enabled: true,
      lastAttemptAt: '2026-07-22T11:00:00.000Z',
      lastSuccessAt: '2026-07-22T11:00:00.000Z',
      lastCompletedAt: '2026-07-22T11:00:00.000Z',
      lastOutcome: 'success',
      lastErrorCode: null,
      lastError: null,
      preparedAt: '2026-07-22T11:00:00.000Z',
      windowStart: '2026-07-20T23:00:00.000Z',
      windowEnd: '2026-07-22T11:00:00.000Z',
      nextExpectedAt: '2026-07-22T12:00:00.000Z',
      workerState: 'ENQUEUED',
      backgroundRestricted: false,
      batteryOptimizationActive: true,
      recordCounts: { sleep: 1, workouts: 2, heartRate: 50, heartRateVariability: 0, restingHeartRate: 1, respiratoryRate: 0, vo2Max: 0 },
    };

    expect(describeBackgroundHealthIssue(status, Date.parse('2026-07-22T11:30:00.000Z'))).toBeNull();
    expect(describeBackgroundHealthIssue({ ...status, backgroundRestricted: true })).toContain('restricting RunMate');
    expect(describeBackgroundHealthIssue({ ...status, authorized: false })).toContain('not allowed');
  });
});
