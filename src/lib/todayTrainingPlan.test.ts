import { describe, expect, it } from 'vitest';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { RacePlan, WeekWorkout } from '@/types/race';
import {
  buildTodayTrainingPlanGuidance,
  getTodayPlannedWorkout,
  getTodayTrainingPlanStatus,
  translatePlanFieldToEnglish,
} from '@/lib/todayTrainingPlan';

function workout(overrides?: Partial<WeekWorkout> & { date?: string }): WeekWorkout & { date?: string } {
  return {
    day: 'Monday',
    workoutType: 'Easy Run',
    distanceKm: 5,
    targetPace: '6:30/km',
    targetHR: 'Zone 2',
    description: 'Easy aerobic run',
    ...overrides,
  };
}

function planContext(input?: {
  racePlan?: RacePlan | null;
  todayDate?: string;
  todayWorkouts?: CoachContext['todayWorkouts'];
  overallScore?: number;
  scoreState?: 'scored' | 'calibrating' | 'unscorable' | 'stale';
}): CoachContext {
  return {
    racePlan: input?.racePlan ?? null,
    todayDate: input?.todayDate ?? '2026-07-20',
    todayWorkouts: input?.todayWorkouts ?? [],
    recoverySystem: {
      overallScore: input?.overallScore ?? 70,
      scoreState: input?.scoreState ?? 'scored',
    },
  } as CoachContext;
}

describe('getTodayPlannedWorkout', () => {
  it('returns null when there is no active race plan', () => {
    expect(getTodayPlannedWorkout(planContext({ racePlan: null }))).toBeNull();
  });

  it('matches an explicit date in weeklyPlan over other strategies', () => {
    const plan: RacePlan = {
      raceCountdownText: '',
      totalWeeks: 1,
      currentPhase: '',
      planSummary: '',
      phases: [],
      weeks: [],
      safetyNotes: '',
      weeklyPlan: [
        workout({ day: 'Sunday', date: '2026-07-19' }),
        { ...workout({ day: 'Monday' }), date: '2026-07-20', workoutType: 'Tempo Run' } as WeekWorkout,
      ],
    };
    const result = getTodayPlannedWorkout(planContext({ racePlan: plan, todayDate: '2026-07-20' }));
    expect(result?.workoutType).toBe('Tempo Run');
  });

  it('falls back to weekday label match when no date matches', () => {
    const plan: RacePlan = {
      raceCountdownText: '',
      totalWeeks: 1,
      currentPhase: '',
      planSummary: '',
      phases: [],
      weeks: [],
      safetyNotes: '',
      weeklyPlan: [workout({ day: 'Monday', workoutType: 'Long Run' })],
    };
    // 2026-07-20 is a Monday
    const result = getTodayPlannedWorkout(planContext({ racePlan: plan, todayDate: '2026-07-20' }));
    expect(result?.workoutType).toBe('Long Run');
  });

  it('falls back to planStartDate offset when no date or weekday matches', () => {
    const plan: RacePlan = {
      raceCountdownText: '',
      totalWeeks: 1,
      currentPhase: '',
      planSummary: '',
      phases: [],
      weeks: [],
      safetyNotes: '',
      planStartDate: '2026-07-18',
      weeklyPlan: [
        workout({ day: 'Unknown', workoutType: 'Day0' }),
        workout({ day: 'Unknown', workoutType: 'Day1' }),
        workout({ day: 'Unknown', workoutType: 'Day2' }),
      ],
    };
    const result = getTodayPlannedWorkout(planContext({ racePlan: plan, todayDate: '2026-07-20' }));
    expect(result?.workoutType).toBe('Day2');
  });

  it('returns plan.todayWorkout when weeklyPlan is empty', () => {
    const plan: RacePlan = {
      raceCountdownText: '',
      totalWeeks: 1,
      currentPhase: '',
      planSummary: '',
      phases: [],
      weeks: [],
      safetyNotes: '',
      todayWorkout: workout({ workoutType: 'Rest Day' }),
    };
    const result = getTodayPlannedWorkout(planContext({ racePlan: plan }));
    expect(result?.workoutType).toBe('Rest Day');
  });
});

describe('getTodayTrainingPlanStatus', () => {
  it('is pending when nothing was logged today', () => {
    expect(getTodayTrainingPlanStatus(planContext(), workout({ workoutType: 'Easy Run' }))).toBe('pending');
  });

  it('is completed when a run is logged and the plan calls for a run', () => {
    const context = planContext({ todayWorkouts: [{ kind: 'run' } as CoachContext['todayWorkouts'][number]] });
    expect(getTodayTrainingPlanStatus(context, workout({ workoutType: 'Tempo Run' }))).toBe('completed');
  });

  it('is logged_different when a run is logged but the plan calls for strength', () => {
    const context = planContext({ todayWorkouts: [{ kind: 'run' } as CoachContext['todayWorkouts'][number]] });
    expect(getTodayTrainingPlanStatus(context, workout({ workoutType: 'Strength' }))).toBe('logged_different');
  });

  it('is logged_different when a strength session is logged but the plan calls for a recovery walk', () => {
    const context = planContext({ todayWorkouts: [{ kind: 'strength' } as CoachContext['todayWorkouts'][number]] });
    expect(getTodayTrainingPlanStatus(context, workout({ workoutType: 'Recovery Walk' }))).toBe('logged_different');
  });
});

describe('buildTodayTrainingPlanGuidance', () => {
  it('returns null when there is no planned workout', () => {
    expect(buildTodayTrainingPlanGuidance(planContext(), null)).toBeNull();
  });

  it('recommends scaling back when Recovery is low', () => {
    const context = planContext({ overallScore: 20, scoreState: 'scored' });
    expect(buildTodayTrainingPlanGuidance(context, workout())?.headline).toBe('Scale This Back');
  });

  it('stays silent when Recovery is in the green zone to avoid repeating Training Guidance', () => {
    const context = planContext({ overallScore: 80, scoreState: 'scored' });
    expect(buildTodayTrainingPlanGuidance(context, workout())).toBeNull();
  });

  it('defers to the plan as written when Recovery is not scorable', () => {
    const context = planContext({ scoreState: 'unscorable' });
    expect(buildTodayTrainingPlanGuidance(context, workout())?.headline).toBe('Follow The Plan');
  });
});

describe('translatePlanFieldToEnglish', () => {
  it('normalizes pace ranges to half-minute boundaries', () => {
    expect(translatePlanFieldToEnglish('5:15-5:25 min/km')).toBe('5:00-5:30 min/km');
    expect(translatePlanFieldToEnglish('6:45-7:00 min/km')).toBe('6:30-7:00 min/km');
  });

  it('translates common Thai HR/pace terms to English', () => {
    expect(translatePlanFieldToEnglish('โซน 2 · ไม่เกิน 145 bpm')).toBe('Zone 2 · Max 145 bpm');
  });

  it('leaves already-English text unchanged', () => {
    expect(translatePlanFieldToEnglish('Zone 2 · Max 145 bpm')).toBe('Zone 2 · Max 145 bpm');
  });
});
