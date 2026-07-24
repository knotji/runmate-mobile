import { describe, expect, it } from 'vitest';
import { calculateHeartRateZones, classifyHeartRateZone, getHeartRateZoneBoundaries, restingHeartRateBaseline } from './hrZones';

describe('HRR Heart Rate Zones', () => {
  it('classifies Zone 0 through Zone 5 from personal heart-rate reserve', () => {
    expect(classifyHeartRateZone(89, 50, 150)).toBe(0);
    expect(classifyHeartRateZone(90, 50, 150)).toBe(1);
    expect(classifyHeartRateZone(110, 50, 150)).toBe(2);
    expect(classifyHeartRateZone(120, 50, 150)).toBe(3);
    expect(classifyHeartRateZone(130, 50, 150)).toBe(4);
    expect(classifyHeartRateZone(140, 50, 150)).toBe(5);
  });

  it('measures sample intervals, coverage, and an estimated load', () => {
    const result = calculateHeartRateZones({
      workoutStart: '2026-07-19T00:00:00.000Z', workoutEnd: '2026-07-19T00:05:00.000Z', maxHr: 150, restingHr: 50,
      points: [90, 110, 120, 130, 140, 140].map((bpm, index) => ({ at: `2026-07-19T00:0${index}:00.000Z`, bpm })),
    });
    expect(result?.zones.map((zone) => zone.seconds)).toEqual([0, 60, 60, 60, 60, 60]);
    expect(result?.coveragePercentage).toBe(100);
    expect(result?.load).toEqual({ score: 5, level: 'Light' });
  });

  it('does not calculate load from sparse coverage', () => {
    const result = calculateHeartRateZones({
      workoutStart: '2026-07-19T00:00:00.000Z', workoutEnd: '2026-07-19T01:00:00.000Z', maxHr: 190, restingHr: 50,
      points: [{ at: '2026-07-19T00:00:00.000Z', bpm: 130 }, { at: '2026-07-19T00:01:00.000Z', bpm: 130 }],
    });
    expect(result?.coveragePercentage).toBe(2);
    expect(result?.load).toBeNull();
  });

  it('uses the median of plausible recent resting-HR values', () => {
    expect(restingHeartRateBaseline([49, 55, null, 51, 200])).toBe(51);
    expect(restingHeartRateBaseline([])).toBeNull();
  });

  it('derives personal Zone 0-5 bpm ranges from Max HR and Resting HR', () => {
    const boundaries = getHeartRateZoneBoundaries(150, 50);
    expect(boundaries).toEqual([
      { zone: 0, label: 'Restorative', lowerBpm: null, upperBpm: 89 },
      { zone: 1, label: 'Recovery', lowerBpm: 90, upperBpm: 109 },
      { zone: 2, label: 'Endurance', lowerBpm: 110, upperBpm: 119 },
      { zone: 3, label: 'Aerobic', lowerBpm: 120, upperBpm: 129 },
      { zone: 4, label: 'Anaerobic', lowerBpm: 130, upperBpm: 139 },
      { zone: 5, label: 'Peak', lowerBpm: 140, upperBpm: null },
    ]);
  });

  it('returns null zone boundaries when Max HR and Resting HR are not usable', () => {
    expect(getHeartRateZoneBoundaries(Number.NaN, 50)).toBeNull();
    expect(getHeartRateZoneBoundaries(150, 150)).toBeNull();
  });
});
