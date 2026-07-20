import { beforeEach, describe, expect, it } from 'vitest';
import { getPersistedTodaySyncAt, shouldSyncToday, TODAY_SYNC_COOLDOWN_MS, TODAY_SYNC_STORAGE_KEY } from './todayHealthSync';

describe('Today Health Sync cooldown', () => {
  beforeEach(() => window.localStorage.clear());

  it('syncs initially and skips a recent repeated tab entry', () => {
    expect(shouldSyncToday(0, 1000)).toBe(true);
    expect(shouldSyncToday(1000, 1000 + TODAY_SYNC_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldSyncToday(1000, 1000 + TODAY_SYNC_COOLDOWN_MS)).toBe(true);
  });

  it('allows pull to refresh to force a sync during cooldown', () => {
    expect(shouldSyncToday(1000, 1100, true)).toBe(true);
  });

  it('restores the last successful sync time after an app restart', () => {
    window.localStorage.setItem(TODAY_SYNC_STORAGE_KEY, '12345');
    expect(getPersistedTodaySyncAt()).toBe(12345);
  });

  it('syncs immediately after the Bangkok date changes', () => {
    const beforeMidnight = Date.parse('2026-07-19T23:59:00+07:00');
    const afterMidnight = Date.parse('2026-07-20T00:01:00+07:00');
    expect(shouldSyncToday(beforeMidnight, afterMidnight)).toBe(true);
  });
});
