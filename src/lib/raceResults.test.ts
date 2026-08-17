import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RaceGoal } from '@/types/race';
import type { WorkoutAnalysis } from '@/types/logs';
import type { LocalHistoryItem } from '@/lib/localHistory';

const { loadActiveRaceGoalAndPlanMock, markRaceGoalCompletedMock, getStateMock } = vi.hoisted(() => ({
  loadActiveRaceGoalAndPlanMock: vi.fn(),
  markRaceGoalCompletedMock: vi.fn(),
  getStateMock: vi.fn(),
}));

vi.mock('@/lib/raceStorage', () => ({
  loadActiveRaceGoalAndPlan: loadActiveRaceGoalAndPlanMock,
  markRaceGoalCompleted: markRaceGoalCompletedMock,
}));

vi.mock('@/lib/race/racePlanStore', () => ({
  useRacePlanStore: { getState: getStateMock },
}));

import { buildRaceResultFromWorkout, detectRaceMatch, maybeCompleteRaceFromWorkoutItem } from '@/lib/raceResults';

const goal: RaceGoal = { id: 'goal-1', raceName: 'Bangkok 10K', raceDate: '2026-08-16', raceDistance: '10K', goalType: 'finish', targetTime: '55:00' };

function workoutAnalysis(overrides: Partial<WorkoutAnalysis['extracted']> = {}): WorkoutAnalysis {
  return {
    extracted: { date: '2026-08-16', distanceKm: 10.2, duration: '54:51', avgPace: '5:24', workoutKind: 'outdoor_run', ...overrides },
    coach: {}, confidence: 'high', unclearFields: [],
  } as unknown as WorkoutAnalysis;
}

function historyItem(data: WorkoutAnalysis, overrides: Partial<LocalHistoryItem> = {}): LocalHistoryItem {
  return { id: 'item-1', type: 'workout', dateKey: '2026-08-16', createdAt: '2026-08-16T12:00:00+07:00', data, ...overrides };
}

describe('detectRaceMatch', () => {
  it('matches when the workout date equals the active goal race date', () => {
    const match = detectRaceMatch(workoutAnalysis(), goal);
    expect(match).toMatchObject({ distanceMatches: true, workoutDate: '2026-08-16' });
  });

  it('does not match a different date', () => {
    expect(detectRaceMatch(workoutAnalysis({ date: '2026-08-10' }), goal)).toBeNull();
  });

  it('flags distance mismatch without rejecting the match entirely', () => {
    const match = detectRaceMatch(workoutAnalysis({ distanceKm: 3 }), goal);
    expect(match).toMatchObject({ distanceMatches: false });
  });
});

describe('buildRaceResultFromWorkout', () => {
  it('marks a "finish" goal type as completed once distance matches (regression: was checking a Thai string never used on mobile)', () => {
    const result = buildRaceResultFromWorkout({ workout: workoutAnalysis(), goal: { ...goal, targetTime: undefined }, linkedHistoryItemId: 'item-1' });
    expect(result.goalResult).toBe('completed');
  });

  it('marks a target-time goal as achieved when the actual time beats the target', () => {
    const targetTimeGoal: RaceGoal = { ...goal, goalType: 'target_time' };
    const result = buildRaceResultFromWorkout({ workout: workoutAnalysis({ duration: '50:00' }), goal: targetTimeGoal, linkedHistoryItemId: 'item-1' });
    expect(result.goalResult).toBe('achieved');
  });

  it('marks a target-time goal as missed when the actual time is slower than the target', () => {
    const targetTimeGoal: RaceGoal = { ...goal, goalType: 'target_time' };
    const result = buildRaceResultFromWorkout({ workout: workoutAnalysis({ duration: '60:00' }), goal: targetTimeGoal, linkedHistoryItemId: 'item-1' });
    expect(result.goalResult).toBe('missed');
  });
});

describe('maybeCompleteRaceFromWorkoutItem', () => {
  beforeEach(() => {
    getStateMock.mockReturnValue({ goal });
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('is a no-op for non-workout history items', async () => {
    const result = await maybeCompleteRaceFromWorkoutItem(historyItem(workoutAnalysis(), { type: 'sleep' }));
    expect(result).toEqual({ completed: false });
    expect(loadActiveRaceGoalAndPlanMock).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no active race goal, without ever calling saveRaceResult', async () => {
    getStateMock.mockReturnValue({ goal: null });
    loadActiveRaceGoalAndPlanMock.mockResolvedValue({ ok: true, goal: null, plan: null });
    const result = await maybeCompleteRaceFromWorkoutItem(historyItem(workoutAnalysis()));
    expect(result).toEqual({ completed: false });
    expect(loadActiveRaceGoalAndPlanMock).toHaveBeenCalledOnce();
  });

  it('fetches a fresh goal when the store has not been hydrated yet this session', async () => {
    getStateMock.mockReturnValue({ goal: null });
    loadActiveRaceGoalAndPlanMock.mockResolvedValue({ ok: true, goal, plan: null });
    await maybeCompleteRaceFromWorkoutItem(historyItem(workoutAnalysis({ date: '2026-08-10' })));
    expect(loadActiveRaceGoalAndPlanMock).toHaveBeenCalledOnce();
  });

  it('is a no-op when the workout date does not match the race date', async () => {
    const result = await maybeCompleteRaceFromWorkoutItem(historyItem(workoutAnalysis({ date: '2026-08-10' })));
    expect(result).toEqual({ completed: false });
    expect(markRaceGoalCompletedMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the date matches but the distance does not (an unrelated workout logged on race day)', async () => {
    const result = await maybeCompleteRaceFromWorkoutItem(historyItem(workoutAnalysis({ distanceKm: 3 })));
    expect(result).toEqual({ completed: false });
    expect(markRaceGoalCompletedMock).not.toHaveBeenCalled();
  });
});
