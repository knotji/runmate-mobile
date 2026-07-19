import { describe, expect, it } from 'vitest';
import { shouldSyncToday, TODAY_SYNC_COOLDOWN_MS } from './todayHealthSync';

describe('Today Health Sync cooldown', () => {
  it('syncs initially and skips a recent repeated tab entry', () => {
    expect(shouldSyncToday(0, 1000)).toBe(true);
    expect(shouldSyncToday(1000, 1000 + TODAY_SYNC_COOLDOWN_MS - 1)).toBe(false);
    expect(shouldSyncToday(1000, 1000 + TODAY_SYNC_COOLDOWN_MS)).toBe(true);
  });

  it('allows pull to refresh to force a sync during cooldown', () => {
    expect(shouldSyncToday(1000, 1100, true)).toBe(true);
  });
});
