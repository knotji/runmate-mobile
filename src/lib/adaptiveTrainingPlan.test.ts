import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { WeekWorkout } from '@/types/race';
import {
  buildAdaptiveTrainingRecommendation,
} from '@/lib/adaptiveTrainingPlan';

const planned: WeekWorkout = {
  day: 'Monday',
  workoutType: 'Intervals',
  distanceKm: 8,
  durationMin: 60,
  targetPace: '5:00–5:30 min/km',
  targetHR: 'Zone 4',
  description: 'Hard interval session',
};

function context(input: {
  score?: number;
  scoreState?: 'scored' | 'calibrating' | 'unscorable' | 'stale';
  sleepScore?: number;
  strain?: number;
  activePain?: boolean;
  activeSick?: boolean;
  runDays7d?: number;
  weeklyTrainingDays?: number;
} = {}): CoachContext {
  return {
    todayDate: '2026-07-20',
    todayWorkouts: [],
    activePain: input.activePain ?? false,
    activeSick: input.activeSick ?? false,
    runDays7d: input.runDays7d ?? 3,
    profile: input.weeklyTrainingDays == null ? {} : { weeklyTrainingDays: input.weeklyTrainingDays },
    recoverySystem: {
      overallScore: input.score ?? 75,
      scoreState: input.scoreState ?? 'scored',
      dataFreshness: { status: 'today' },
      strain: { score: input.strain ?? 3 },
      sleepPerformance: { score: input.sleepScore ?? 80, state: 'scored' },
    },
  } as unknown as CoachContext;
}

describe('buildAdaptiveTrainingRecommendation', () => {
  it('keeps a supported plan unchanged', () => {
    const result = buildAdaptiveTrainingRecommendation(context(), planned);
    expect(result?.action).toBe('keep');
    expect(result?.suggestedWorkout).toEqual(planned);
  });

  it('reduces a demanding workout when Recovery is moderate', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 55 }), planned);
    expect(result?.action).toBe('reduce');
    expect(result?.suggestedWorkout.distanceKm).toBe(5.5);
    expect(result?.suggestedWorkout.durationMin).toBe(40);
    expect(result?.suggestedWorkout.targetHR).toBe('Zone 1–2');
  });

  it('rests instead of a demanding workout when Recovery is low', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 20 }), planned);
    expect(result?.action).toBe('rest');
    expect(result?.suggestedWorkout.workoutType).toBe('Rest Day');
  });

  it('swaps an easy workout for recovery movement when Recovery is low', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 20 }), { ...planned, workoutType: 'Easy Run', description: 'Easy aerobic run' });
    expect(result?.action).toBe('swap');
    expect(result?.suggestedWorkout.workoutType).toBe('Recovery Walk');
  });

  it('uses pain and illness as safety caps regardless of score', () => {
    expect(buildAdaptiveTrainingRecommendation(context({ activePain: true }), planned)?.action).toBe('rest');
    expect(buildAdaptiveTrainingRecommendation(context({ activeSick: true }), planned)?.action).toBe('rest');
  });

  it('does not adapt from stale or insufficient Recovery data', () => {
    expect(buildAdaptiveTrainingRecommendation(context({ scoreState: 'stale' }), planned)?.action).toBe('keep');
    expect(buildAdaptiveTrainingRecommendation(context({ scoreState: 'unscorable' }), planned)?.action).toBe('keep');
  });

  it('does not recommend a second session after training is logged', () => {
    const ctx = context({ score: 20 });
    ctx.todayWorkouts = [{ kind: 'run' } as CoachContext['todayWorkouts'][number]];
    expect(buildAdaptiveTrainingRecommendation(ctx, planned)).toBeNull();
  });

  it('reduces a demanding workout when this week’s Workout Load is already heavy, even with good Recovery', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 80, runDays7d: 6 }), planned);
    expect(result?.action).toBe('reduce');
    expect(result?.reasons.join(' ')).toContain('6 of the last 7 days');
  });

  it('does not reduce a demanding workout for high weekly volume alone when few days were run', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 80, runDays7d: 3 }), planned);
    expect(result?.action).toBe('keep');
  });

  it('notes meeting the weekly training-day target when keeping the original plan', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 80, runDays7d: 4, weeklyTrainingDays: 4 }), planned);
    expect(result?.action).toBe('keep');
    expect(result?.reasons.join(' ')).toContain('weekly training-day target (4/4)');
  });

  it('does not mention the weekly target when it has not been met', () => {
    const result = buildAdaptiveTrainingRecommendation(context({ score: 80, runDays7d: 2, weeklyTrainingDays: 4 }), planned);
    expect(result?.reasons.join(' ')).not.toContain('weekly training-day target');
  });
});
