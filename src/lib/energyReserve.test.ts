import { describe, expect, it } from 'vitest';
import { buildEnergyReserve } from '@/lib/energyReserve';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';

function recovery(overrides: Partial<RunMateRecoverySystem> = {}): RunMateRecoverySystem {
  return {
    model: 'whoop_style_v1',
    scoreState: 'scored',
    dataFreshness: { status: 'today', latestSleepDate: '2026-08-10', ageDays: 0 },
    overallScore: 76,
    overallLabel: 'Good',
    overallDisplayStatus: { score: 76, label: 'Good', thaiLabel: '', displayLabel: 'Good', cautionLevel: 'none' },
    coachingState: 'maintain',
    headline: '',
    recovery: { key: 'recovery', score: 76, status: 'high', label: '', summary: '', reasons: [] },
    strain: { score: 6, scaleMax: 21, level: 'moderate', label: '', summary: '', estimated: false, reasons: [], weeklyTrend: { sessions: 0, distanceKm: 0 } },
    sleepPerformance: { score: 80, state: 'scored', label: '', summary: '', estimated: false, sleepNeedMinutes: 480, actualSleepMinutes: 450, sufficiencyScore: 90, consistencyScore: 80, qualityScore: 80, efficiencyScore: 90, sleepDebtMinutes: 30, targetWakeTime: null, targetSleepTime: null, recommendedInBedTime: null, reasons: [], missing: [] },
    fuelInsight: { status: 'ready', label: '', summary: 'Fuel is on track.', reasons: [] },
    axes: {
      recovery: { key: 'recovery', score: 76, status: 'high', label: '', summary: '', reasons: [] },
      load: { key: 'load', score: 20, status: 'low', label: '', summary: '', reasons: [] },
      sleep: { key: 'sleep', score: 80, status: 'high', label: '', summary: '', reasons: [] },
      fuel: { key: 'fuel', score: 80, status: 'high', label: '', summary: '', reasons: [] },
    },
    guardrails: [],
    recommendedIntensity: 'moderate',
    sourceCoverage: { used: [], missing: [] },
    ...overrides,
  };
}

describe('buildEnergyReserve', () => {
  it('starts from Recovery and applies nonlinear recorded Strain drain', () => {
    const result = buildEnergyReserve({ recovery: recovery() });
    expect(result).toMatchObject({ available: true, startingRecovery: 76, strainDrain: 11, contextDrain: 0, used: 11, score: 65, level: 'steady' });
  });

  it('uses only confirmed stress and heat as lifestyle drain', () => {
    const result = buildEnergyReserve({ recovery: recovery(), checkIn: { date: '2026-08-10', stress: 'high', environment: 'hot_humid', updatedAt: new Date().toISOString() } });
    expect(result.contextDrain).toBe(11);
    expect(result.score).toBe(54);
    expect(result.context).toEqual(['High stress check-in', 'Hot or humid conditions']);
  });

  it('keeps Fuel separate from the numeric estimate while adapting the action', () => {
    const ready = buildEnergyReserve({ recovery: recovery() });
    const low = buildEnergyReserve({ recovery: recovery({ fuelInsight: { status: 'low', label: '', summary: 'More fuel is needed.', reasons: [] } }) });
    expect(low.score).toBe(ready.score);
    expect(low.fuel.label).toBe('Fuel Low');
    expect(low.action.title).toBe('Fuel Before Adding Load');
  });

  it('describes missing fuel data as not logged instead of unknown', () => {
    const result = buildEnergyReserve({ recovery: recovery({ fuelInsight: { status: 'unknown', label: '', summary: 'No meal data yet.', reasons: [] } }) });
    expect(result.fuel.label).toBe('Fuel Not Logged');
  });

  it.each(['stale', 'unscorable', 'pending'] as const)('does not show a reserve for %s Recovery', (scoreState) => {
    const result = buildEnergyReserve({ recovery: recovery({ scoreState }) });
    expect(result).toMatchObject({ available: false, score: null, startingRecovery: null });
  });
});
