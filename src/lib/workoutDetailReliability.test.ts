import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';

describe('workout detail reliability', () => {
  it('summarizes reconciled sources and preserved user corrections', () => {
    const item = {
      id: 'reconciled-run', type: 'workout', createdAt: '2026-07-19T06:54:00.000Z',
      source: { provider: 'samsung_health', importType: 'health_connect', importedAt: '2026-07-19T07:00:00.000Z' },
      data: { extracted: { workoutKind: 'outdoor_run', duration: '30:00', avgHR: 155 } },
      reconciledSources: ['Samsung Health', 'Upload'],
      fieldSources: { duration: 'Samsung Health', avgHR: 'User Corrected' },
    } as LocalHistoryItem & { reconciledSources: string[]; fieldSources: Record<string, string> };

    expect(buildWorkoutDetail(item).reliability).toEqual({
      status: 'Reconciled',
      sources: 'Samsung Health + Upload',
      userCorrectedCount: 1,
      lastImportedAt: '2026-07-19T07:00:00.000Z',
    });
  });
});
