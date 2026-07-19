import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { buildWorkoutDetail } from './workoutDetail';

describe('Workout Detail HR Zones', () => {
  it('builds HRR zones only when measured samples and physiology are available', () => {
    const item: LocalHistoryItem = {
      id: 'samsung-run-1', type: 'workout', createdAt: '2026-07-19T01:05:00.000Z',
      data: {
        extracted: { workoutKind: 'outdoor_run', duration: '5:00', avgHR: 130, maxHR: 150 },
        workoutStartTime: '2026-07-19T01:00:00.000Z', workoutEndTime: '2026-07-19T01:05:00.000Z',
        heartRateSamples: [90, 110, 120, 130, 140, 140].map((bpm, index) => ({ at: `2026-07-19T01:0${index}:00.000Z`, bpm })),
      },
    };

    expect(buildWorkoutDetail(item).heartRateZones).toBeNull();
    const zones = buildWorkoutDetail(item, { maxHr: 150, restingHr: 50 }).heartRateZones;
    expect(zones?.coveragePercentage).toBe(100);
    expect(zones?.zones.find((zone) => zone.zone === 5)?.seconds).toBe(60);
  });
});
