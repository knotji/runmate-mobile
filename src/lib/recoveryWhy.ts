import type { RecoveryFactor, RunMateRecoverySystem } from '@/lib/recoverySystem';
import { buildRecoveryExplainability } from '@/lib/recoveryExplainability';

/**
 * "Recovery Why" — turns the score into a short, human-readable list of what's
 * shaping it today. Purely a UI-shaping adapter over buildRecoveryExplainability()
 * (recoveryExplainability.ts): it never classifies a signal itself, never invents
 * a factor, and never renders anything when the underlying explanation isn't
 * ready — the deterministic engine is the only source of truth for what counts
 * as helping/hurting/unavailable.
 */
export type RecoveryWhyTone = 'up' | 'down' | 'unavailable';
export type RecoveryWhyFactor = { key: string; label: string; detail: string; tone: RecoveryWhyTone };
export type RecoveryWhy =
  | { status: 'unavailable' }
  | { status: 'ready'; factors: RecoveryWhyFactor[] };

const MAX_FACTORS = 3;

export function buildRecoveryWhy(recovery: RunMateRecoverySystem): RecoveryWhy {
  const explainability = buildRecoveryExplainability(recovery);
  if (explainability.status !== 'ready') return { status: 'unavailable' };

  const ranked: Array<{ factor: RecoveryFactor; tone: RecoveryWhyTone }> = [
    ...explainability.helping.map((factor) => ({ factor, tone: 'up' as const })),
    ...explainability.hurting.map((factor) => ({ factor, tone: 'down' as const })),
  ];
  if (ranked.length === 0) return { status: 'unavailable' };

  // A missing signal that could have explained the score is worth surfacing
  // too, muted, when there's still room — but real helping/hurting factors
  // always come first, and it's never shown alone (that's the 'unavailable'
  // status above, not a single dim line pretending to be an explanation).
  const withGap = ranked.length < MAX_FACTORS && explainability.unavailable.length > 0
    ? [...ranked, { factor: explainability.unavailable[0], tone: 'unavailable' as const }]
    : ranked;

  return {
    status: 'ready',
    factors: withGap.slice(0, MAX_FACTORS).map(({ factor, tone }) => ({ key: factor.key, label: factor.label, detail: factor.detail, tone })),
  };
}
