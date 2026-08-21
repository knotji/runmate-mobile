import { describe, expect, it } from 'vitest';
import { buildTodayContinuity } from './todayContinuity';
import type { CoachContext } from './buildCoachContext';
import type { DailyRecommendation, DailyRecommendationAction } from './dailyRecommendation';

const yesterday = '2026-08-19';

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  return {
    yesterdayDate: yesterday,
    workoutsYesterday: null,
    raceGoal: null,
    racePlan: null,
    raceName: null,
    raceDate: null,
    raceDistance: null,
    targetTime: null,
    ...overrides,
  } as unknown as CoachContext;
}

function ready(action: DailyRecommendationAction, reason = 'Recovery is 41/100 today.'): DailyRecommendation {
  return { status: 'ready', action, label: '', reason, plannedWorkoutNote: null };
}

function weeklyPlan(entries: Array<{ date: string; workoutType: string; distanceKm?: number | null }>) {
  return { weeklyPlan: entries.map((entry) => ({ ...entry, date: entry.date, durationMin: null, targetPace: null, targetHR: null, description: '' })) };
}

describe('buildTodayContinuity', () => {
  it('is none when dailyRecommendation is not ready - never guesses a continuity story from raw data alone', () => {
    const result = buildTodayContinuity(context(), { status: 'insufficient_data', reason: 'not enough data' });
    expect(result).toEqual({ status: 'none' });
  });

  it('reports a favorable rest-day continuity when yesterday was rest and today supports normal/push training', () => {
    const ctx = context({ racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Rest' }]) });
    const result = buildTodayContinuity(ctx, ready('normal'));
    expect(result).toEqual({ status: 'ready', tone: 'up', message: 'You rested yesterday, and today supports a normal training day.' });
  });

  it('says nothing when yesterday was rest but today still says reduce/recover - does not force a positive story', () => {
    const ctx = context({ racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Rest' }]) });
    expect(buildTodayContinuity(ctx, ready('reduce'))).toEqual({ status: 'none' });
    expect(buildTodayContinuity(ctx, ready('recover'))).toEqual({ status: 'none' });
  });

  it('reports an overtrained-yesterday continuity when actual km exceeds planned and today says reduce/recover', () => {
    const ctx = context({
      racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Easy Run', distanceKm: 5 }]),
      workoutsYesterday: { date: yesterday, runs: [{ km: 8.5, durationMin: 50, avgHR: null, pace: null }], walks: [], other: [] },
    });
    const result = buildTodayContinuity(ctx, ready('reduce', 'Recovery is 41/100 today.'));
    expect(result).toEqual({ status: 'ready', tone: 'down', message: 'Yesterday you covered 8.5 km, more than the planned 5 km. Recovery is 41/100 today.' });
  });

  it('says nothing when yesterday matched the plan closely - no distinctive link to report', () => {
    const ctx = context({
      racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Easy Run', distanceKm: 5 }]),
      workoutsYesterday: { date: yesterday, runs: [{ km: 5.1, durationMin: 32, avgHR: null, pace: null }], walks: [], other: [] },
    });
    expect(buildTodayContinuity(ctx, ready('normal'))).toEqual({ status: 'none' });
  });

  it('says nothing when yesterday ran over but today is still push/normal - overtraining alone is not a story without a corresponding reduce/recover', () => {
    const ctx = context({
      racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Easy Run', distanceKm: 5 }]),
      workoutsYesterday: { date: yesterday, runs: [{ km: 9, durationMin: 55, avgHR: null, pace: null }], walks: [], other: [] },
    });
    expect(buildTodayContinuity(ctx, ready('normal'))).toEqual({ status: 'none' });
  });

  it('reports a data gap when a session was planned yesterday but nothing was logged - distinguishes this from a real rest day', () => {
    const ctx = context({ racePlan: weeklyPlan([{ date: yesterday, workoutType: 'Tempo Run', distanceKm: 8 }]) });
    const result = buildTodayContinuity(ctx, ready('normal'));
    expect(result).toEqual({ status: 'gap', message: "Yesterday's planned session hasn't synced yet, so it isn't reflected below." });
  });

  it('treats no plan at all for yesterday as a rest day, not a data gap', () => {
    const result = buildTodayContinuity(context(), ready('push'));
    expect(result).toEqual({ status: 'ready', tone: 'up', message: 'You rested yesterday, and today supports a strong training day.' });
  });
});
