import { describe, expect, it } from 'vitest';
import { buildPeriodAdherence, buildPeriodTrainingSummary, buildWeeklyRecapHighlights } from './weeklyRecapHighlights';
import type { LocalHistoryItem } from './localHistory';
import type { RecoveryTrendInsight, RecoveryTrendPoint } from './recoveryTrends';
import type { RacePlan, WeekWorkout } from '@/types/race';

const workout = (dateKey: string, workoutKind: string, distanceKm?: number, duration?: number): LocalHistoryItem => ({
  id: `${dateKey}-${workoutKind}-${Math.random()}`,
  type: 'workout',
  createdAt: `${dateKey}T12:00:00Z`,
  dateKey,
  data: { extracted: { workoutKind, distanceKm, duration } },
});

const plan = (day: string, workoutType: string, distanceKm: number | null = null): WeekWorkout => ({ day, workoutType, distanceKm, targetPace: null, targetHR: null, description: '' });

const racePlan = (weeklyPlan: WeekWorkout[]): RacePlan => ({
  raceCountdownText: '', totalWeeks: 1, currentPhase: 'Build', planSummary: '', phases: [], safetyNotes: '',
  weeks: [], weeklyPlan,
});

const point = (date: string, recovery: number | null, sleep: number | null): RecoveryTrendPoint => ({
  date, recovery, sleep, strain: null, state: recovery != null ? 'scored' : 'missing', hrv: null, restingHR: null, respiratoryRate: null,
});

const insight = (title = 'Steady', summary = 'Your Recovery held steady this period.'): RecoveryTrendInsight => ({
  direction: 'steady', change: 0, title, summary, factors: [],
});

describe('buildPeriodTrainingSummary', () => {
  it('sums distance/minutes and classifies sessions into a training mix', () => {
    const items = [
      workout('2026-07-20', 'outdoor_run', 5, 30),
      workout('2026-07-21', 'outdoor_run', 6, 35),
      workout('2026-07-22', 'walking', 2, 20),
      workout('2026-07-23', 'strength', undefined, 45),
    ];
    const result = buildPeriodTrainingSummary(items, '2026-07-19', '2026-07-25');
    expect(result.sessions).toBe(4);
    expect(result.distanceKm).toBe(13);
    expect(result.activeMinutes).toBe(130);
    expect(result.activeDays).toBe(4);
    expect(result.activeDateKeys).toEqual(['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23']);
    expect(result.trainingMix).toEqual([
      { label: 'Running', sessions: 2 },
      { label: 'Walking', sessions: 1 },
      { label: 'Other Training', sessions: 1 },
    ]);
  });

  it('excludes items outside the requested window', () => {
    const items = [workout('2026-07-10', 'outdoor_run', 5, 30), workout('2026-07-20', 'outdoor_run', 6, 35)];
    const result = buildPeriodTrainingSummary(items, '2026-07-19', '2026-07-25');
    expect(result.sessions).toBe(1);
    expect(result.distanceKm).toBe(6);
  });

  it('returns zeroed stats for an empty window', () => {
    const result = buildPeriodTrainingSummary([], '2026-07-19', '2026-07-25');
    expect(result).toEqual({ sessions: 0, distanceKm: 0, activeMinutes: 0, activeDays: 0, activeDateKeys: [], trainingMix: [] });
  });
});

describe('buildPeriodAdherence', () => {
  it('aggregates completed/modified/missed across a multi-week month window', () => {
    const plannedPlan = racePlan([plan('SUN', 'Easy Run', 5), plan('WED', 'Intervals', 6)]);
    const actualItems = [workout('2026-07-05', 'outdoor_run', 5), workout('2026-07-19', 'outdoor_run', 5)];
    const result = buildPeriodAdherence(plannedPlan, actualItems, '2026-07-01', '2026-07-22', '2026-07-22');
    expect(result.planned).toBeGreaterThan(0);
    expect(result.completed).toBeGreaterThanOrEqual(1);
    expect(result.percentage).toBeGreaterThanOrEqual(0);
    expect(result.days.every((day) => day.date >= '2026-07-01' && day.date <= '2026-07-22')).toBe(true);
  });

  it('returns zero adherence when there is no active plan', () => {
    const result = buildPeriodAdherence(null, [], '2026-07-19', '2026-07-25', '2026-07-25');
    expect(result).toMatchObject({ completed: 0, modified: 0, missed: 0, planned: 0, percentage: 0 });
  });

  it('resolves a fully-elapsed past week using its own historical plan, not the live current-week plan', () => {
    // Real today is in a later week; periodEnd/periodStart describe a past, fully-elapsed week.
    const plannedPlan: RacePlan = {
      raceCountdownText: '', totalWeeks: 2, currentPhase: 'Build', planSummary: '', phases: [], safetyNotes: '',
      planStartDate: '2026-07-12',
      weeks: [{ weekNumber: 1, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 5, longRunDistanceKm: 5, workouts: [plan('SUN', 'Easy Run', 5)] }],
      weeklyPlan: [plan('SUN', 'Different Live Plan Workout', 99)],
    };
    const actualItems = [workout('2026-07-12', 'outdoor_run', 5)];
    const result = buildPeriodAdherence(plannedPlan, actualItems, '2026-07-12', '2026-07-18', '2026-07-26');
    expect(result.planned).toBe(1);
    expect(result.completed).toBe(1);
  });
});

describe('buildWeeklyRecapHighlights', () => {
  const baseAdherence = { completed: 3, modified: 1, missed: 1, planned: 5, percentage: 80, days: [] };
  const baseSummary = { sessions: 4, distanceKm: 13, activeMinutes: 130, activeDays: 4, activeDateKeys: ['2026-07-20', '2026-07-22'], trainingMix: [{ label: 'Running', sessions: 3 }] };

  it('averages Recovery and picks the best Sleep score from provided points', () => {
    const result = buildWeeklyRecapHighlights({
      period: 'week',
      periodStart: '2026-07-19',
      periodEnd: '2026-07-25',
      summary: baseSummary,
      adherence: baseAdherence,
      recoveryPoints: [point('2026-07-24', 60, 70), point('2026-07-25', 80, 90)],
      recoveryInsight: insight(),
    });
    expect(result.recoveryAverage).toBe(70);
    expect(result.sleepBestScore).toBe(90);
    expect(result.sleepScoredNights).toBe(2);
    expect(result.periodTitle).toBe('Your Week');
    expect(result.topTrainingMixLabel).toBe('Running');
    expect(result.dateRangeLabel).toBe('Jul 19 – 25');
    expect(result.activeDateKeys).toEqual(['2026-07-20', '2026-07-22']);
    expect(result.periodStartWeekday).toBe(0);
    expect(result.periodDates).toEqual(['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25']);
  });

  it('handles a period with no scored Recovery/Sleep nights at all', () => {
    const result = buildWeeklyRecapHighlights({
      period: 'month',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-25',
      summary: { sessions: 0, distanceKm: 0, activeMinutes: 0, activeDays: 0, activeDateKeys: [], trainingMix: [] },
      adherence: { completed: 0, modified: 0, missed: 0, planned: 0, percentage: 0, days: [] },
      recoveryPoints: [point('2026-07-24', null, null), point('2026-07-25', null, null)],
      recoveryInsight: insight('No Recovery Yet', 'Log a sleep session to get started.'),
    });
    expect(result.recoveryAverage).toBeNull();
    expect(result.sleepBestScore).toBeNull();
    expect(result.sleepScoredNights).toBe(0);
    expect(result.topTrainingMixLabel).toBeNull();
    expect(result.periodTitle).toBe('Your Month');
    expect(result.dateRangeLabel).toBe('Jul 1 – 25');
    expect(result.periodStartWeekday).toBe(3);
    expect(result.periodDates).toHaveLength(25);
  });

  it('formats a date range spanning two months', () => {
    const result = buildWeeklyRecapHighlights({
      period: 'week',
      periodStart: '2026-07-26',
      periodEnd: '2026-08-01',
      summary: baseSummary,
      adherence: baseAdherence,
      recoveryPoints: [],
      recoveryInsight: insight(),
    });
    expect(result.dateRangeLabel).toBe('Jul 26 – Aug 1');
  });
});
