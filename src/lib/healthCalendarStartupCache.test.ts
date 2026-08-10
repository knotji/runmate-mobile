import { beforeEach, describe, expect, it } from 'vitest';
import { clearHealthCalendarSnapshot, loadHealthCalendarSnapshot, saveHealthCalendarSnapshot } from './healthCalendarStartupCache';
import type { LocalHistoryItem } from './localHistory';

const item: LocalHistoryItem = { id: 'sleep-1', type: 'sleep', createdAt: '2026-08-10T00:00:00Z', data: {} };

describe('Health Calendar startup cache', () => {
  beforeEach(() => clearHealthCalendarSnapshot());

  it('reuses a recent prepared history snapshot', () => {
    saveHealthCalendarSnapshot([item], 1_000);
    expect(loadHealthCalendarSnapshot(1_000 + 4 * 60 * 1000)).toEqual([item]);
  });

  it('does not reuse an expired snapshot', () => {
    saveHealthCalendarSnapshot([item], 1_000);
    expect(loadHealthCalendarSnapshot(1_000 + 5 * 60 * 1000 + 1)).toBeNull();
  });
});
