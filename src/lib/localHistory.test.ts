import { describe, expect, it } from 'vitest';
import { isHealthConnectImportedItem, isHiddenFromRunMateData, type LocalHistoryItem } from '@/lib/localHistory';

const imported: LocalHistoryItem = {
  id: 'healthconnect-samsung-sleep-1',
  type: 'sleep',
  createdAt: '2026-08-01T00:00:00.000Z',
  source: { provider: 'samsung_health', importType: 'health_connect', importedAt: '2026-08-01T00:00:00.000Z' },
  data: {},
};

describe('RunMate history visibility', () => {
  it('identifies records imported through Health Connect', () => {
    expect(isHealthConnectImportedItem(imported)).toBe(true);
    expect(isHealthConnectImportedItem({ ...imported, source: { ...imported.source!, importType: 'image' } })).toBe(false);
  });

  it('recognizes only explicit hidden tombstones', () => {
    expect(isHiddenFromRunMateData({ hiddenFromRunMate: true })).toBe(true);
    expect(isHiddenFromRunMateData({ hiddenFromRunMate: false })).toBe(false);
    expect(isHiddenFromRunMateData(null)).toBe(false);
  });
});
