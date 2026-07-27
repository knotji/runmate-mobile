import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import {
  clearWeeklySummaryHistorySnapshot,
  loadWeeklySummaryHistorySnapshot,
  saveWeeklySummaryHistorySnapshot,
} from './weeklySummaryStartupCache';

const item: LocalHistoryItem = {
  id: 'workout-1',
  type: 'workout',
  createdAt: '2026-07-27T00:00:00.000Z',
  data: {},
};

describe('Weekly Summary startup cache', () => {
  beforeEach(clearWeeklySummaryHistorySnapshot);

  it('reuses recent history during the app session', () => {
    saveWeeklySummaryHistorySnapshot([item], 1_000);
    expect(loadWeeklySummaryHistorySnapshot(2_000)).toEqual([item]);
  });

  it('expires history after five minutes', () => {
    saveWeeklySummaryHistorySnapshot([item], 1_000);
    expect(loadWeeklySummaryHistorySnapshot(301_001)).toBeNull();
  });
});
