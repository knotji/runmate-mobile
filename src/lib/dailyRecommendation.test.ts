import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { RecoveryExplainability } from '@/lib/recoveryExplainability';
import type { WeekWorkout } from '@/types/race';
import { buildDailyRecommendation } from '@/lib/dailyRecommendation';

const readyExplainability: RecoveryExplainability = { status: 'ready', helping: [], hurting: [], unavailable: [] };

function context(values: Record<string, unknown> = {}): CoachContext {
  return {
    activePain: false,
    activeSick: false,
    runDays7d: 3,
    recoverySystem: {
      scoreState: 'scored',
      overallScore: 72,
      strain: { score: 6 },
      sleepPerformance: { state: 'scored', score: 78 },
    },
    ...values,
  } as unknown as CoachContext;
}

const workout = (overrides: Partial<WeekWorkout> = {}): WeekWorkout => ({
  day: 'Monday',
  workoutType: 'Easy Run',
  distanceKm: 5,
  targetPace: null,
  targetHR: null,
  description: '',
  ...overrides,
});

describe('buildDailyRecommendation', () => {
  it('returns insufficient_data instead of guessing an action when Recovery is stale', () => {
    const result = buildDailyRecommendation(
      context({ recoverySystem: { scoreState: 'stale', overallScore: 0, strain: { score: 0 }, sleepPerformance: { state: 'unscorable', score: 0 } } }),
      { status: 'unavailable', reason: 'stale sleep' },
      null,
    );

    expect(result.status).toBe('insufficient_data');
  });

  it('recommends recover when Recovery score is low', () => {
    const result = buildDailyRecommendation(
      context({ recoverySystem: { scoreState: 'scored', overallScore: 25, strain: { score: 2 }, sleepPerformance: { state: 'scored', score: 60 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.action).toBe('recover');
  });

  it('recommends recover when active pain overrides an otherwise fine score', () => {
    const result = buildDailyRecommendation(
      context({ activePain: true, recoverySystem: { scoreState: 'scored', overallScore: 70, strain: { score: 4 }, sleepPerformance: { state: 'scored', score: 80 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.action).toBe('recover');
      expect(result.reason).toContain('pain');
    }
  });

  it('recommends reduce when today’s Strain is already high even though Recovery is good', () => {
    const result = buildDailyRecommendation(
      context({ recoverySystem: { scoreState: 'scored', overallScore: 75, strain: { score: 16 }, sleepPerformance: { state: 'scored', score: 80 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.action).toBe('reduce');
      expect(result.reason).toContain('Strain');
    }
  });

  it('recommends reduce for a heavy training week even when today’s signals look fine', () => {
    const result = buildDailyRecommendation(
      context({ weeklyTrainingLoad7d: 300, recoverySystem: { scoreState: 'scored', overallScore: 75, strain: { score: 4 }, sleepPerformance: { state: 'scored', score: 80 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.action).toBe('reduce');
  });

  it('recommends reduce for a heavy week driven by a few hard sessions, not just many easy ones (the runDays7d limitation this replaces)', () => {
    const result = buildDailyRecommendation(
      context({ runDays7d: 3, weeklyTrainingLoad7d: 270, recoverySystem: { scoreState: 'scored', overallScore: 75, strain: { score: 4 }, sleepPerformance: { state: 'scored', score: 80 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.action).toBe('reduce');
  });

  it('recommends push only when Recovery, Strain, and Sleep are all strongly favorable', () => {
    const result = buildDailyRecommendation(
      context({ runDays7d: 2, recoverySystem: { scoreState: 'scored', overallScore: 85, strain: { score: 3 }, sleepPerformance: { state: 'scored', score: 90 } } }),
      readyExplainability,
      null,
    );

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.action).toBe('push');
  });

  it('recommends normal for a balanced day that is not strongly good or bad', () => {
    const result = buildDailyRecommendation(context(), readyExplainability, null);

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.action).toBe('normal');
  });

  it('is advisory only: it never mutates the planned workout, only describes it', () => {
    const planned = workout();
    const frozen = JSON.stringify(planned);
    const result = buildDailyRecommendation(context(), readyExplainability, planned);

    expect(JSON.stringify(planned)).toBe(frozen);
    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.plannedWorkoutNote).toBe('Easy Run · 5 km');
  });

  it('describes a planned rest day without a distance/duration suffix', () => {
    const result = buildDailyRecommendation(context(), readyExplainability, workout({ workoutType: 'Rest Day', distanceKm: null }));

    expect(result.status).toBe('ready');
    if (result.status === 'ready') expect(result.plannedWorkoutNote).toBe('Rest Day');
  });

  it('keeps every label and reason in English across all four actions, since the Today UI is English-only', () => {
    const thaiCharacters = /[฀-๿]/;
    const scenarios: Array<[string, Record<string, unknown>]> = [
      ['recover (pain)', { activePain: true, recoverySystem: { scoreState: 'scored', overallScore: 70, strain: { score: 4 }, sleepPerformance: { state: 'scored', score: 80 } } }],
      ['reduce (strain)', { recoverySystem: { scoreState: 'scored', overallScore: 75, strain: { score: 16 }, sleepPerformance: { state: 'scored', score: 80 } } }],
      ['reduce (heavy week)', { weeklyTrainingLoad7d: 300, recoverySystem: { scoreState: 'scored', overallScore: 75, strain: { score: 4 }, sleepPerformance: { state: 'scored', score: 80 } } }],
      ['push', { runDays7d: 2, recoverySystem: { scoreState: 'scored', overallScore: 85, strain: { score: 3 }, sleepPerformance: { state: 'scored', score: 90 } } }],
      ['normal', {}],
    ];
    for (const [, overrides] of scenarios) {
      const result = buildDailyRecommendation(context(overrides), readyExplainability, null);
      expect(result.status).toBe('ready');
      if (result.status === 'ready') {
        expect(result.label).not.toMatch(thaiCharacters);
        expect(result.reason).not.toMatch(thaiCharacters);
      }
    }
  });
});
