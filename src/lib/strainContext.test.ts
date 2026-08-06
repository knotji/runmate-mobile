import { beforeEach, describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { AllDayHeartRateSummary } from '@/lib/allDayHeartRate';
import { buildHistoricalStrainDetailInsight, buildStrainDetailInsight, clearStrainCheckIns, loadDailyStrainCheckIn, saveDailyStrainCheckIn } from './strainContext';

const hr: AllDayHeartRateSummary = { date: '2026-08-06', buckets: [], averageBpm: null, minimumBpm: null, maximumBpm: null, coveragePercent: 0, lastSampleAt: null, lastSyncedAt: null, freshness: 'missing' };
const context = (overrides: Partial<CoachContext> = {}) => ({
  todayDate: '2026-08-06', todayWorkouts: [], mealsToday: [], activeSick: false, sleepBaseline30d: [],
  recoverySystem: { overallScore: 70, strain: { score: 6, level: 'light' } }, ...overrides,
} as unknown as CoachContext);

describe('strain contextual analysis', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps stress and environment as explicit user context', () => {
    saveDailyStrainCheckIn({ date: '2026-08-06', stress: 'high', environment: 'hot_humid', updatedAt: '' });
    const saved = loadDailyStrainCheckIn('2026-08-06');
    expect(saved.stress).toBe('high');
    expect(saved.environment).toBe('hot_humid');
    clearStrainCheckIns();
    expect(loadDailyStrainCheckIn('2026-08-06').stress).toBeNull();
  });

  it('labels reported stress and heat as confirmed context, not an HR diagnosis', () => {
    const result = buildStrainDetailInsight(context(), hr, { date: '2026-08-06', stress: 'high', environment: 'hot_humid', updatedAt: '' });
    expect(result.contributors.find((item) => item.key === 'stress')).toMatchObject({ confidence: 'high' });
    expect(result.contributors.find((item) => item.key === 'heat')?.detail).toContain('confirmed');
  });

  it('flags a combined resting-HR and HRV shift as possible rather than certain illness', () => {
    const result = buildStrainDetailInsight(context({ sleepBaseline30d: [
      { restingHR: 56, hrv: 40 }, { restingHR: 49, hrv: 55 }, { restingHR: 50, hrv: 52 }, { restingHR: 51, hrv: 54 }, { restingHR: 50, hrv: 56 },
    ] as CoachContext['sleepBaseline30d'] }), hr, { date: '2026-08-06', stress: null, environment: null, updatedAt: '' });
    expect(result.contributors.find((item) => item.key === 'illness')).toMatchObject({ confidence: 'possible' });
  });

  it('builds a historical day without borrowing today’s Recovery when it is missing', () => {
    const result = buildHistoricalStrainDetailInsight([], {
      date: '2026-08-05', recovery: null, sleep: null, strain: 7.2, state: 'missing', hrv: null, restingHR: null, respiratoryRate: null,
    }, { ...hr, date: '2026-08-05' }, { date: '2026-08-05', stress: 'moderate', environment: null, updatedAt: '' });
    expect(result).toMatchObject({ score: 7.2, compatibleRange: null, rangeStatus: null });
    expect(result.contributors.find((item) => item.key === 'stress')).toMatchObject({ confidence: 'high' });
  });
});
