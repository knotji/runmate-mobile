import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';

/**
 * Single source of truth for "compare today's signal against this person's own
 * recent history" math. Recovery scoring, Today's Brief, and any explainability/
 * recommendation feature must all read the same baseline numbers for the same
 * night — computing HRV baseline one way in one file and another way elsewhere
 * is how two cards on the same screen end up disagreeing.
 */

export type BaselineState = 'insufficient' | 'calibrating' | 'ready';

export type SignalBaseline = {
  /** Median of the available samples, excluding the current/latest value being compared. null when no samples exist. */
  value: number | null;
  sampleCount: number;
  state: BaselineState;
};

export type PersonalBaseline = {
  /** Nights considered for the baseline (latest night already excluded). */
  nightsConsidered: number;
  hrv: SignalBaseline;
  restingHR: SignalBaseline;
  respiratoryRate: SignalBaseline;
  sleepDurationMinutes: SignalBaseline;
};

const DEFAULT_READY_SAMPLES = 4;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Computes a personal baseline for one physiological signal from a set of historical
 * values. `readySamples` mirrors the Recovery model's existing calibration threshold
 * (`sleepBaseline30d.length < 4` => 'calibrating') so every baseline in the app
 * calibrates on the same amount of evidence.
 */
export function computeSignalBaseline(values: Array<number | null | undefined>, readySamples = DEFAULT_READY_SAMPLES): SignalBaseline {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  const value = median(valid);
  const state: BaselineState = valid.length === 0 ? 'insufficient' : valid.length < readySamples ? 'calibrating' : 'ready';
  return { value, sampleCount: valid.length, state };
}

/**
 * Builds every personal baseline the app needs from `CoachContext.sleepBaseline30d`,
 * which already excludes nothing — the current/latest night is still index 0.
 * The Recovery data-freshness contract requires baselines to exclude the current
 * sleep session, so this always drops the first (latest) row before computing.
 */
export function buildPersonalBaseline(context: CoachContext | null): PersonalBaseline {
  const nights: WeekSleepRow[] = context?.sleepBaseline30d ?? [];
  const baselineNights = nights.slice(1);
  return {
    nightsConsidered: baselineNights.length,
    hrv: computeSignalBaseline(baselineNights.map((night) => night.hrv)),
    restingHR: computeSignalBaseline(baselineNights.map((night) => night.restingHR)),
    respiratoryRate: computeSignalBaseline(baselineNights.map((night) => night.respiratoryRate)),
    sleepDurationMinutes: computeSignalBaseline(baselineNights.map((night) => night.durationMinutes)),
  };
}
