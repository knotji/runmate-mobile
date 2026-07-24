import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { activityRecentHistoryOptions, mergeActivityHistoryItems, sortHistoryItemsByEventTimeDesc, uploadedActivityDateFromEvent } from './activityHistoryLoad';

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

  it('selects the saved date only for a reviewed image upload', () => {
    const uploadEvent = new CustomEvent('runmate:cloud-data-updated', {
      detail: { action: 'save', savedItems: [{ id: 'meal-1', dateKey: '2026-07-14', provider: 'generic_image' }] },
    });
    const healthSyncEvent = new CustomEvent('runmate:cloud-data-updated', {
      detail: { action: 'save', savedItems: [{ id: 'sleep-1', dateKey: '2026-07-20', provider: 'samsung_health' }] },
    });

    expect(uploadedActivityDateFromEvent(uploadEvent)).toBe('2026-07-14');
    expect(uploadedActivityDateFromEvent(healthSyncEvent)).toBeNull();
    expect(uploadedActivityDateFromEvent(new Event('runmate:cloud-data-updated'))).toBeNull();
  });

  it('sorts activity items by actual event time, not upload order', () => {
    const breakfast: LocalHistoryItem = { id: 'meal-1', type: 'meal', createdAt: '2026-07-20T09:00:00.000Z', recordedAt: '2026-07-20T07:30:00.000Z', dateKey: '2026-07-20', data: {} };
    const workout: LocalHistoryItem = { id: 'workout-1', type: 'workout', createdAt: '2026-07-20T18:20:00.000Z', recordedAt: '2026-07-20T17:00:00.000Z', dateKey: '2026-07-20', data: {} };
    const sleep: LocalHistoryItem = { id: 'sleep-1', type: 'sleep', createdAt: '2026-07-20T06:00:00.000Z', recordedAt: '2026-07-20T06:00:00.000Z', dateKey: '2026-07-20', data: {} };
    // Uploaded in an order that does not match when each activity actually happened.
    const uploadOrder = [sleep, breakfast, workout];

    expect(sortHistoryItemsByEventTimeDesc(uploadOrder).map((item) => item.id)).toEqual(['workout-1', 'meal-1', 'sleep-1']);
  });

  it('falls back to createdAt when an item has no recordedAt', () => {
    const withRecordedAt: LocalHistoryItem = { id: 'has-recorded-at', type: 'meal', createdAt: '2026-07-20T10:00:00.000Z', recordedAt: '2026-07-20T12:00:00.000Z', dateKey: '2026-07-20', data: {} };
    const withoutRecordedAt: LocalHistoryItem = { id: 'no-recorded-at', type: 'meal', createdAt: '2026-07-20T09:00:00.000Z', dateKey: '2026-07-20', data: {} };

    expect(sortHistoryItemsByEventTimeDesc([withRecordedAt, withoutRecordedAt]).map((item) => item.id)).toEqual(['has-recorded-at', 'no-recorded-at']);
  });
});
