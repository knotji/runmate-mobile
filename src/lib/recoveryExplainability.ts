import type { RecoveryFactor, RunMateRecoverySystem } from '@/lib/recoverySystem';

/**
 * Turns today's Recovery score into "what's helping / what's hurting" — derived
 * strictly from the same per-signal factors `buildRunMateRecoverySystem` already
 * computed the score from (see `RecoveryAxis.factors`). This never recomputes or
 * estimates a physiological value; it only classifies numbers that already exist.
 */
export type RecoveryExplainability =
  | { status: 'unavailable'; reason: string }
  | {
      status: 'ready';
      helping: RecoveryFactor[];
      hurting: RecoveryFactor[];
      unavailable: RecoveryFactor[];
    };

const SAFETY_CAP_KEYS = new Set<RecoveryFactor['key']>(['pain', 'sick']);

export function buildRecoveryExplainability(recovery: RunMateRecoverySystem): RecoveryExplainability {
  if (recovery.scoreState === 'stale') {
    return {
      status: 'unavailable',
      reason: `The latest sleep data is from ${recovery.dataFreshness.latestSleepDate ?? 'an earlier date'}, so today's Recovery can't be explained from an old night.`,
    };
  }
  if (recovery.scoreState === 'unscorable' || recovery.scoreState === 'pending') {
    return { status: 'unavailable', reason: 'Not enough data from last night yet to explain what\'s helping or hurting Recovery today.' };
  }

  const factors = recovery.recovery?.factors ?? [];
  const helping = factors
    .filter((factor) => factor.direction === 'helping')
    .sort((a, b) => b.weight - a.weight);
  const hurting = factors
    .filter((factor) => factor.direction === 'hurting')
    .sort((a, b) => {
      const aCap = SAFETY_CAP_KEYS.has(a.key) ? 1 : 0;
      const bCap = SAFETY_CAP_KEYS.has(b.key) ? 1 : 0;
      if (aCap !== bCap) return bCap - aCap;
      return b.weight - a.weight;
    });
  const unavailable = factors.filter((factor) => factor.direction === 'unavailable');

  return { status: 'ready', helping, hurting, unavailable };
}
