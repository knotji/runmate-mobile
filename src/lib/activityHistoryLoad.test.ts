import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { activityRecentHistoryOptions, mergeActivityHistoryItems } from './activityHistoryLoad';

function item(id: string, type: LocalHistoryItem['type'], marker: string): LocalHistoryItem {
  return { id, type, createdAt: '2026-07-20T00:00:00.000Z', dateKey: '2026-07-20', data: { marker } };
}

describe('Activity History Loading', () => {
  it('uses a bounded 45-day fast path', () => {
    const now = Date.parse('2026-07-21T00:00:00.000Z');
    expect(activityRecentHistoryOptions(now)).toEqual({
      limit: 700,
      createdAfter: '2026-06-06T00:00:00.000Z',
    });
  });

  it('keeps archive records while allowing newer records to replace the same id', () => {
    const merged = mergeActivityHistoryItems(
      [item('old', 'meal', 'archive'), item('same', 'meal', 'before')],
      [item('same', 'meal', 'after'), item('new', 'workout', 'recent')],
    );

    expect(merged.map((entry) => entry.id).sort()).toEqual(['new', 'old', 'same']);
    expect(merged.find((entry) => entry.id === 'same')?.data).toEqual({ marker: 'after' });
  });
});
