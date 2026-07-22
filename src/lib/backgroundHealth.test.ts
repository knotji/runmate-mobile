import { describe, expect, it } from 'vitest';
import { backgroundHealthSupported, isPreparedHealthSnapshotFresh } from './backgroundHealth';

describe('background health', () => {
  it('stays unavailable in the browser test environment', () => {
    expect(backgroundHealthSupported()).toBe(false);
  });

  it('accepts only bounded, non-future prepared snapshots', () => {
    const now = Date.parse('2026-07-22T12:00:00.000Z');
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T11:00:00.000Z' }, now)).toBe(true);
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T10:00:00.000Z' }, now)).toBe(false);
    expect(isPreparedHealthSnapshotFresh({ capturedAt: '2026-07-22T12:01:00.000Z' }, now)).toBe(false);
  });
});
