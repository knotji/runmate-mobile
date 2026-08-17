import type { DayWorkoutSummary } from '@/lib/context/contextTypes';

/**
 * A 7-day training-load proxy that reuses recoveryLoop.ts's calcDayLoad() weights
 * (run: distanceKm*6 + durationMin*0.4, +HR bonus, capped 90/day; walk:
 * durationMin*0.25, capped 35/day; other/strength: durationMin*0.5, capped 50/day)
 * instead of inventing new ones — the two proxies should stay in agreement about
 * what a "hard" vs "easy" session is worth.
 *
 * This exists specifically for the "heavy week" gate in dailyRecommendation.ts and
 * adaptiveTrainingPlan.ts, which previously used a plain runDays7d >= 6 day-count
 * and so could not tell 3 easy runs apart from 3 hard ones. It does not replace
 * runDays7d anywhere else — readinessV2.ts's Recovery/Readiness score formula
 * still uses the plain day-count and must not change.
 */
/**
 * Calibrated so both "6 easy run days" and "3 hard run days" land above it (roughly
 * 250-270 either way with recoveryLoop.ts's weights) — the two patterns the old
 * runDays7d >= 6 day-count gate could never treat the same way.
 */
export const HEAVY_WEEKLY_TRAINING_LOAD_THRESHOLD = 250;

export function calcWeeklyTrainingLoad(workouts7d: DayWorkoutSummary[]): number {
  return Math.round(workouts7d.reduce((total, day) => total + calcDayTrainingLoad(day), 0));
}

function calcDayTrainingLoad(day: DayWorkoutSummary): number {
  let total = 0;
  for (const run of day.runs) {
    let contribution = (run.km ?? 0) * 6 + (run.durationMin ?? 0) * 0.4;
    if (run.avgHR != null) {
      if (run.avgHR >= 165) contribution += 10;
      else if (run.avgHR >= 145) contribution += 3;
    }
    total += clamp(contribution, 0, 90);
  }
  for (const walk of day.walks) {
    total += clamp((walk.durationMin ?? 0) * 0.25, 0, 35);
  }
  for (const other of day.other) {
    total += clamp((other.durationMin ?? 0) * 0.5, 0, 50);
  }
  return total;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
