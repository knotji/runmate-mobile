import { describe, expect, it } from 'vitest';
import { HEALTH_HISTORY_LOOKBACK_DAYS, describeTodayHealthSyncPerformance, hasHealthChanges } from './healthSyncService';

describe('Health Sync Service', () => {
  it('keeps the manual history window at 30 days', () => {
    expect(HEALTH_HISTORY_LOOKBACK_DAYS).toBe(30);
  });

  it('reports changes only when Sleep or Workout records were added or updated', () => {
    expect(hasHealthChanges({ added: 0, updated: 0 }, { added: 0, updated: 0 })).toBe(false);
    expect(hasHealthChanges({ added: 1, updated: 0 }, { added: 0, updated: 0 })).toBe(true);
    expect(hasHealthChanges({ added: 0, updated: 0 }, { added: 0, updated: 2 })).toBe(true);
  });

  it('describes whether Recovery used prepared or live Health Connect data', () => {
    const counts = { status: 'synced' as const, imported: 1, added: 0, updated: 0, unchanged: 1, failed: 0 };
    expect(describeTodayHealthSyncPerformance({
      performed: true,
      changed: false,
      sleep: { ...counts, dataSource: 'prepared' },
      workout: { ...counts, dataSource: 'live' },
    })).toMatchObject({ variant: 'mixed', detail: expect.stringContaining('snapshot plus live read') });
    expect(describeTodayHealthSyncPerformance({ performed: false, changed: false, sleep: null, workout: null }))
      .toMatchObject({ status: 'skipped', variant: 'cooldown' });
  });
});
