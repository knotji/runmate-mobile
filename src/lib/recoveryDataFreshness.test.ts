import { describe, expect, it } from 'vitest';
import { recoveryDataStatusCopy, resolveRecoveryDataStatus } from './recoveryDataFreshness';

describe('Recovery data freshness', () => {
  it('keeps visible data while a refresh is running', () => {
    expect(resolveRecoveryDataStatus({
      savedAt: '2026-07-30T00:00:00.000Z',
      refreshing: true,
      refreshFailed: false,
      now: '2026-07-30T00:30:00.000Z',
    })).toBe('refreshing');
  });

  it('marks a failed refresh as fallback instead of fresh', () => {
    expect(resolveRecoveryDataStatus({
      savedAt: '2026-07-30T00:00:00.000Z',
      refreshing: false,
      refreshFailed: true,
      now: '2026-07-30T00:01:00.000Z',
    })).toBe('fallback');
  });

  it('marks successful snapshots stale after fifteen minutes', () => {
    expect(resolveRecoveryDataStatus({
      savedAt: '2026-07-30T00:00:00.000Z',
      refreshing: false,
      refreshFailed: false,
      now: '2026-07-30T00:16:00.000Z',
    })).toBe('stale');
  });

  it('formats the saved Bangkok time without changing the score', () => {
    expect(recoveryDataStatusCopy('fallback', '2026-07-30T00:42:00.000Z').detail).toContain('7:42 AM');
  });
});
