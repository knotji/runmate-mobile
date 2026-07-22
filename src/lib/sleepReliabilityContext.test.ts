import { describe, expect, it } from 'vitest';
import { buildCoachContextFromData } from '@/lib/buildCoachContext';
import type { LocalHistoryItem } from '@/lib/localHistory';

describe('sleep reliability context', () => {
  it('keeps reconciled source and field provenance for Sleep Details', () => {
    const date = new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
    const upload: LocalHistoryItem = {
      id: 'sleep-upload', type: 'sleep', createdAt: `${date}T00:30:00Z`, dateKey: date,
      source: { provider: 'generic_image', importType: 'image', importedAt: `${date}T00:31:00Z` },
      data: {
        extracted: { sleepDuration: '6h', actualSleepDurationMinutes: 360, sleepScore: 80 },
        reconciliationInput: { userCorrectedFields: ['sleepDuration'] },
      },
    };
    const health: LocalHistoryItem = {
      id: 'healthconnect-samsung-sleep', type: 'sleep', createdAt: `${date}T00:25:00Z`, dateKey: date,
      source: { provider: 'samsung_health', importType: 'health_connect', importedAt: `${date}T00:32:00Z` },
      data: { extracted: { actualSleepDurationMinutes: 350, timeInBedMinutes: 400 } },
    };

    const context = buildCoachContextFromData({ items: [upload, health], profile: null, raceGoal: null, racePlan: null });

    expect(context.sleepHistory[0]).toMatchObject({
      durationMinutes: 360,
      sources: ['Manual Upload', 'Samsung Health'],
      fieldSources: { actualSleepDurationMinutes: 'User Corrected', timeInBedMinutes: 'Samsung Health' },
      lastImportedAt: `${date}T00:32:00Z`,
    });
  });
});
