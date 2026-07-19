import { describe, expect, it } from 'vitest';
import { findHighestObservedHeartRate } from './observedHeartRate';
import type { LocalHistoryItem } from './localHistory';

describe('findHighestObservedHeartRate', () => {
  it('returns the highest plausible workout maximum without treating average HR as a maximum', () => {
    const items = [
      item('a', 'workout', { extracted: { maxHR: 187, avgHR: 169 } }),
      item('b', 'strength', { extracted: { maxHr: 152 } }),
      item('c', 'workout', { extracted: { avgHR: 194 } }),
    ];
    expect(findHighestObservedHeartRate(items)).toMatchObject({ bpm: 187 });
  });

  it('rejects implausible values and non-workout records', () => {
    expect(findHighestObservedHeartRate([item('a', 'workout', { extracted: { maxHR: 280 } }), item('b', 'meal', { maxHR: 180 })])).toBeNull();
  });
});

function item(id: string, type: LocalHistoryItem['type'], data: unknown): LocalHistoryItem {
  return { id, type, data, createdAt: '2026-07-19T01:00:00.000Z' };
}
