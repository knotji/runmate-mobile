import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import {
  clearActivityStartupSnapshot,
  loadActivityStartupSnapshot,
  saveActivityStartupSnapshot,
} from './activityStartupCache';

function item(id: string, dateKey: string): LocalHistoryItem {
  return { id, type: 'workout', createdAt: `${dateKey}T05:00:00.000Z`, dateKey, data: { distanceKm: 5 } };
}

describe('Activity startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps only today items for same-day startup', () => {
    saveActivityStartupSnapshot(
      [item('today', '2026-07-27'), item('older', '2026-07-26')],
      '2026-07-27T05:00:00.000Z',
    );

    expect(loadActivityStartupSnapshot('2026-07-27T12:00:00.000Z')?.map((entry) => entry.id)).toEqual(['today']);
    expect(loadActivityStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('removes invalid data and can be cleared on sign out', () => {
    window.localStorage.setItem('runmate:activity-startup:v1', '{bad-json');
    expect(loadActivityStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    saveActivityStartupSnapshot([item('today', '2026-07-27')], '2026-07-27T05:00:00.000Z');
    clearActivityStartupSnapshot();
    expect(loadActivityStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
