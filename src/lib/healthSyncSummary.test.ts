import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { classifyHealthSyncItems, selectChangedHealthSyncItems } from './healthSyncSummary';

function item(id: string, distanceKm: number, importedAt: string): LocalHistoryItem {
  return {
    id, type: 'workout', createdAt: '2026-07-19T02:00:00Z', dateKey: '2026-07-19', recordedAt: '2026-07-19T01:00:00Z',
    source: { provider: 'samsung_health', importType: 'health_connect', importedAt },
    data: { extracted: { workoutKind: 'outdoor_run', distanceKm }, platformId: id },
  };
}

describe('Health Sync Summary', () => {
  it('separates added, updated and unchanged records while ignoring import time', () => {
    const existing = [item('same', 5, '2026-07-19T02:00:00Z'), item('changed', 5, '2026-07-19T02:00:00Z')];
    const incoming = [item('same', 5, '2026-07-19T03:00:00Z'), item('changed', 5.2, '2026-07-19T03:00:00Z'), item('new', 3, '2026-07-19T03:00:00Z')];
    expect(classifyHealthSyncItems(incoming, existing)).toEqual({ added: 1, updated: 1, unchanged: 1, failed: 0 });
    expect(selectChangedHealthSyncItems(incoming, existing).map((entry) => entry.id)).toEqual(['changed', 'new']);
  });

  it('updates an existing workout when a later sync adds its heart rate timeline', () => {
    const existing = item('workout', 5, '2026-07-19T02:00:00Z');
    const incomingBase = item('workout', 5, '2026-07-19T03:00:00Z');
    const incoming = {
      ...incomingBase,
      data: {
        ...(incomingBase.data as Record<string, unknown>),
        heartRateSamples: [
          { at: '2026-07-19T01:00:00Z', bpm: 130 },
          { at: '2026-07-19T01:01:00Z', bpm: 135 },
        ],
      },
    };
    expect(classifyHealthSyncItems([incoming], [existing]).updated).toBe(1);
    expect(selectChangedHealthSyncItems([incoming], [existing])).toHaveLength(1);
  });
});
