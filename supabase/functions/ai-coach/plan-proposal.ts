// A concrete change to one planned session, offered only when the runner asked
// for one.
//
// Additive to the coach response: a client that does not know this key keeps
// working unchanged — the same way WholeMate already ignores `nextMeal`, and
// RunMate will ignore this. Both read the answer by picking the fields they
// know rather than by validating the whole object, so a new key costs them
// nothing.
//
// The server proposes and never persists. Anything unusable is dropped to null
// here rather than passed through half-built, because a partial proposal is one
// a client could offer to apply.
//
// Extracted into its own module for the same reason prompt-policy is: index.ts
// is a Deno entry point and cannot be imported by the test runner.

export type PlanProposal = {
  /** Weekday name as the training plan spells it. The app matches days by name. */
  day: string;
  dateKey: string | null;
  workoutType: string;
  durationMin: number | null;
  distanceKm: number | null;
  description: string | null;
  purpose: string | null;
  targetPace: string | null;
  targetHr: string | null;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function text(value: unknown, length: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, length) : null;
}

function bounded(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function normalizePlanProposal(value: unknown): PlanProposal | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const proposal = value as Record<string, unknown>;

  // Two fields carry the whole meaning: which day, and what it becomes. Without
  // either there is nothing a client could place or describe.
  const day = text(proposal.day, 40);
  const workoutType = text(proposal.workoutType, 80);
  if (!day || !workoutType) return null;

  // Only a date the model actually supplied in exactly the expected shape.
  //
  // Validated before any trimming: truncating first would accept
  // "2026-09-01T20:00:00Z" as "2026-09-01", which silently picks the UTC date
  // and lands on the wrong day in Bangkok. Deriving a date from a weekday has
  // the same problem, and a confidently wrong date is worse than none.
  const rawDateKey = typeof proposal.dateKey === 'string' ? proposal.dateKey.trim() : null;

  return {
    day,
    dateKey: rawDateKey && DATE_KEY.test(rawDateKey) ? rawDateKey : null,
    workoutType,
    // Out-of-range numbers are dropped rather than clamped: a clamped value is
    // a prescription nobody wrote.
    durationMin: bounded(proposal.durationMin, 0, 600),
    distanceKm: bounded(proposal.distanceKm, 0, 500),
    description: text(proposal.description, 1000),
    purpose: text(proposal.purpose, 500),
    targetPace: text(proposal.targetPace, 60),
    targetHr: text(proposal.targetHr, 60),
  };
}
