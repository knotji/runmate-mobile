import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import { recoveryShareComposition, weeklyShareComposition, workoutShareComposition } from '@/lib/shareComposition';
import type { WeeklyRecapHighlights } from '@/lib/weeklyRecapHighlights';

describe('share compositions', () => {
  it('keeps only selected real workout metrics', () => {
    const composition = workoutShareComposition({
      title: 'Strength Session',
      type: 'strength',
      distanceKm: 5,
      durationSeconds: 1800,
      paceFormatted: '6:00/km',
      loadScore: 54,
    }, ['distance', 'pace', 'duration', 'load']);
    expect(composition.hero).toMatchObject({ label: 'Time', value: '30:00' });
    expect(composition.metrics.map((metric) => metric.key)).toEqual(['load']);
  });

  it('omits unavailable Recovery and Energy values', () => {
    const context = {
      todayDate: '2026-08-11',
      recoverySystem: {
        scoreState: 'scored', overallScore: 78, overallLabel: 'Good',
        dataFreshness: { status: 'today', latestSleepDate: '2026-08-11', ageDays: 0 },
        sleepPerformance: { state: 'unscorable', score: 0 },
        strain: { score: 3.25 },
      },
    } as unknown as CoachContext;
    const composition = recoveryShareComposition(context, null);
    expect(composition.hero?.value).toBe('78');
    expect(composition.metrics).toEqual([{ key: 'strain', label: 'Strain', value: '3.3', unit: '/21' }]);
  });

  it('does not add dash placeholders to recap exports', () => {
    const recap = {
      period: 'week', periodTitle: 'Your Week', periodStart: '2026-08-10', periodEnd: '2026-08-16',
      periodStartWeekday: 1, periodDates: [], dateRangeLabel: 'Aug 10 – 16', recoveryAverage: null,
      recoveryInsightTitle: 'A Quiet Week', recoveryInsightSummary: '', sleepBestScore: null, sleepScoredNights: 0,
      adherencePercentage: 0, adherenceCompleted: 0, adherenceModified: 0, adherenceMissed: 0, adherencePlanned: 0,
      sessions: 0, distanceKm: 0, activeMinutes: 0, activeDateKeys: [], topTrainingMixLabel: null,
    } satisfies WeeklyRecapHighlights;
    const composition = weeklyShareComposition(recap);
    expect(composition.hero).toBeUndefined();
    expect(composition.metrics).toEqual([]);
    expect(JSON.stringify(composition)).not.toContain('—');
  });
});
