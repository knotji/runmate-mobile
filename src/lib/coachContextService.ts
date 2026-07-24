import { buildCoachContextFromData, type CoachContext } from '@/lib/buildCoachContext';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { loadRaceResults } from '@/lib/raceResults';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { pushTodayPlanToWidget } from '@/lib/todayPlanWidget';

const COACH_CONTEXT_CACHE_MS = 30_000;
export const RECOVERY_CONTEXT_LOOKBACK_DAYS = 45;
const RECOVERY_CORE_ROW_LIMIT = 500;
const RECOVERY_SECONDARY_ROW_LIMIT = 700;
let cachedCoachContext: { value: CoachContext; loadedAt: number } | null = null;
let activeCoachContextLoad: Promise<CoachContext> | null = null;
let cachedRecoveryCoreContext: { value: CoachContext; loadedAt: number } | null = null;
let cachedRecoveryPageContext: { value: CoachContext; loadedAt: number } | null = null;
let coachContextRevision = 0;

export function invalidateCoachContextCache(): void {
  cachedCoachContext = null;
  cachedRecoveryCoreContext = null;
  cachedRecoveryPageContext = null;
  coachContextRevision += 1;
}

export function buildCoachContextFromSupabase(options: { force?: boolean } = {}): Promise<CoachContext> {
  const now = Date.now();
  if (!options.force && cachedCoachContext && now - cachedCoachContext.loadedAt < COACH_CONTEXT_CACHE_MS) {
    return Promise.resolve(cachedCoachContext.value);
  }
  if (activeCoachContextLoad) {
    return options.force
      ? activeCoachContextLoad.then(() => buildCoachContextFromSupabase({ force: true }))
      : activeCoachContextLoad;
  }

  const loadRevision = coachContextRevision;
  activeCoachContextLoad = loadCoachContextFromSupabase()
    .then((value) => {
      if (loadRevision === coachContextRevision) cachedCoachContext = { value, loadedAt: Date.now() };
      void pushTodayPlanToWidget(value);
      return value;
    })
    .finally(() => { activeCoachContextLoad = null; });
  return activeCoachContextLoad;
}

/**
 * Fast path for the three Recovery dials. It keeps every physiological and
 * safety input, while leaving nutrition, race, and long-form coaching data for
 * the progressive page load.
 */
export async function buildRecoveryCoreContextFromSupabase(options: { force?: boolean } = {}): Promise<CoachContext> {
  const now = Date.now();
  if (!options.force && cachedRecoveryCoreContext && now - cachedRecoveryCoreContext.loadedAt < COACH_CONTEXT_CACHE_MS) {
    return cachedRecoveryCoreContext.value;
  }

  const loadRevision = coachContextRevision;
  try {
    const [historyResult, profileResult] = await Promise.all([
      loadHistoryItems(
        ['sleep', 'workout', 'pain', 'strength', 'sick'],
        recoveryHistoryOptions(RECOVERY_CORE_ROW_LIMIT),
      ),
      loadProfileFromSupabase(),
    ]);

    const value = buildCoachContextFromData({
      items: historyResult.ok ? historyResult.items : [],
      profile: profileResult.ok ? profileResult.profile ?? null : null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });
    if (loadRevision === coachContextRevision) cachedRecoveryCoreContext = { value, loadedAt: Date.now() };
    return value;
  } catch {
    if (cachedRecoveryCoreContext) return cachedRecoveryCoreContext.value;
    if (cachedCoachContext) return cachedCoachContext.value;
    return buildCoachContextFromData({
      items: [],
      profile: null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });
  }
}

/** Loads the rest of the Recovery page without downloading the full history table. */
export async function buildRecoveryPageContextFromSupabase(options: { force?: boolean } = {}): Promise<CoachContext> {
  const now = Date.now();
  if (!options.force && cachedRecoveryPageContext && now - cachedRecoveryPageContext.loadedAt < COACH_CONTEXT_CACHE_MS) {
    return cachedRecoveryPageContext.value;
  }

  const loadRevision = coachContextRevision;
  try {
    const [recentResult, durableResult, profileResult, raceResult, completedRaceResult] = await Promise.all([
      loadHistoryItems(
        ['sleep', 'workout', 'meal', 'pain', 'strength', 'sick'],
        recoveryHistoryOptions(RECOVERY_SECONDARY_ROW_LIMIT),
      ),
      loadHistoryItems(['body', 'health_check'], { limit: 10 }),
      loadProfileFromSupabase(),
      loadActiveRaceGoalAndPlan(),
      loadRaceResults(5),
    ]);
    const value = buildCoachContextFromData({
      items: mergeHistoryItems(
        recentResult.ok ? recentResult.items : [],
        durableResult.ok ? durableResult.items : [],
      ),
      profile: profileResult.ok ? profileResult.profile ?? null : null,
      raceGoal: raceResult.ok ? raceResult.goal : null,
      racePlan: raceResult.ok ? raceResult.plan : null,
      raceResults: completedRaceResult.ok ? completedRaceResult.results : [],
    });
    if (loadRevision === coachContextRevision) cachedRecoveryPageContext = { value, loadedAt: Date.now() };
    return value;
  } catch {
    if (cachedRecoveryPageContext) return cachedRecoveryPageContext.value;
    if (cachedCoachContext) return cachedCoachContext.value;
    return buildCoachContextFromData({
      items: [],
      profile: null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });
  }
}

async function loadCoachContextFromSupabase(): Promise<CoachContext> {
  try {
    const [historyResult, profileResult, raceResult, completedRaceResult] = await Promise.all([
      loadHistoryItems(['sleep', 'workout', 'body', 'meal', 'pain', 'strength', 'health_check', 'sick']),
      loadProfileFromSupabase(),
      loadActiveRaceGoalAndPlan(),
      loadRaceResults(5),
    ]);

    return buildCoachContextFromData({
      items: historyResult.ok ? historyResult.items : [],
      profile: profileResult.ok ? profileResult.profile ?? null : null,
      raceGoal: raceResult.ok ? raceResult.goal : null,
      racePlan: raceResult.ok ? raceResult.plan : null,
      raceResults: completedRaceResult.ok ? completedRaceResult.results : [],
    });
  } catch {
    if (cachedCoachContext) return cachedCoachContext.value;
    return buildCoachContextFromData({
      items: [],
      profile: null,
      raceGoal: null,
      racePlan: null,
      raceResults: [],
    });
  }
}

function recoveryHistoryOptions(limit: number) {
  return {
    limit,
    createdAfter: new Date(Date.now() - RECOVERY_CONTEXT_LOOKBACK_DAYS * 86_400_000).toISOString(),
  };
}

function mergeHistoryItems(...groups: LocalHistoryItem[][]): LocalHistoryItem[] {
  const byId = new Map<string, LocalHistoryItem>();
  for (const item of groups.flat()) byId.set(item.id, item);
  return [...byId.values()];
}

if (typeof window !== 'undefined') {
  window.addEventListener('runmate:cloud-data-updated', invalidateCoachContextCache);
}
