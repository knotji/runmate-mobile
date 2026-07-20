import { describe, expect, it } from 'vitest';
import { HEALTH_HISTORY_LOOKBACK_DAYS, hasHealthChanges } from './healthSyncService';

describe('Health Sync Service', () => {
  it('keeps the manual history window at 30 days', () => {
    expect(HEALTH_HISTORY_LOOKBACK_DAYS).toBe(30);
  });

  it('reports changes only when Sleep or Workout records were added or updated', () => {
    expect(hasHealthChanges({ added: 0, updated: 0 }, { added: 0, updated: 0 })).toBe(false);
    expect(hasHealthChanges({ added: 1, updated: 0 }, { added: 0, updated: 0 })).toBe(true);
    expect(hasHealthChanges({ added: 0, updated: 0 }, { added: 0, updated: 2 })).toBe(true);
  });
});
