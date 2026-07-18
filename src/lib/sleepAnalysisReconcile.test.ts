import { describe, expect, it } from 'vitest';
import { reconcileSleepAnalysis } from '@/lib/sleepAnalysisReconcile';
import type { SleepAnalysis } from '@/types/logs';

function analysis(extracted: Partial<SleepAnalysis['extracted']>): SleepAnalysis {
  return {
    extracted: {
      date: null, sleepDuration: null, sleepScore: null, energyScore: null, restingHR: null,
      hrv: null, sleepQualityLabel: null, visibleNotes: null, ...extracted,
    },
    coach: {
      readinessScore: 0, readinessLabel: 'Low', aiSummary: '', todayRecommendation: '',
      nutritionFocus: '', recoveryFocus: '', sleepFocus: '', warningNotes: '',
    },
  };
}

describe('reconcileSleepAnalysis', () => {
  it('corrects Sleep Duration when it was copied from Time In Bed', () => {
    const result = reconcileSleepAnalysis(analysis({
      sleepDuration: '7h 15m', actualSleepDurationMinutes: 435, timeInBedMinutes: 435,
      sleepStageAwakeMinutes: 55, sleepStageRemMinutes: 111,
      sleepStageLightMinutes: 213, sleepStageDeepMinutes: 56,
    }));

    expect(result.extracted.sleepDuration).toBe('6h 20m');
    expect(result.extracted.actualSleepDurationMinutes).toBe(380);
    expect(result.needsReview).toBe(true);
  });

  it('does not change metrics when stages do not reconcile with Time In Bed', () => {
    const input = analysis({
      sleepDuration: '7h 15m', actualSleepDurationMinutes: 435, timeInBedMinutes: 435,
      sleepStageAwakeMinutes: 55, sleepStageRemMinutes: 90,
      sleepStageLightMinutes: 180, sleepStageDeepMinutes: 50,
    });

    expect(reconcileSleepAnalysis(input)).toBe(input);
  });
});
