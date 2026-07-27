import { buildCoachContextFromData, type CoachContext } from '@/lib/buildCoachContext';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { loadRaceResults } from '@/lib/raceResults';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { pushTodayPlanToWidget } from '@/lib/todayPlanWidget';
import { useCoachContextStore } from '@/lib/context/coachContextStore';

const COACH_CONTEXT_CACHE_MS = 30_000;
export const RECOVERY_CONTEXT_LOOKBACK_DAYS = 45;
const RECOVERY_CORE_ROW_LIMIT = 500;
const RECOVERY_SECONDARY_ROW_LIMIT = 700;
let cachedCoachContext: { value: CoachContext; loadedAt: number } | null = null;
let activeCoachContextLoad: Promise<CoachContext> | null = null;
let cachedRecoveryCoreContext: { value: CoachContext; loadedAt: number } | null = null;
let cachedRecoveryPageContext: { value: CoachContext; loadedAt: number } | null = null;
let activeRecoveryCoreLoad: Promise<CoachContext> | null = null;
let activeRecoveryPageLoad: Promise<CoachContext> | null = null;
let coachContextRevision = 0;

// buildCoachContextFromSupabase/buildRecoveryCoreContextFromSupabase/
// buildRecoveryPageContextFromSupabase all resolve independently and all
// write the same shared coachContextStore slot. Without this guard, a
// slower older call (e.g. the full page context) could resolve after a
// newer call (e.g. a fresh core-dial fetch) and clobber the store with a
// stale/less-complete value. Only ever apply the result of the most
// recently *started* call.
let latestContextRequestId = 0;
function nextContextRequestId(): number {
  latestContextRequestId += 1;
  return latestContextRequestId;
}
function applyContextIfLatest(requestId: number, value: CoachContext): void {
  if (requestId === latestContextRequestId) useCoachContextStore.getState().setContext(value);
}

export function invalidateCoachContextCache(): void {
  cachedCoachContext = null;
  cachedRecoveryCoreContext = null;
  cachedRecoveryPageContext = null;
  coachContextRevision += 1;
  useCoachContextStore.getState().invalidate();
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
  const requestId = nextContextRequestId();
  activeCoachContextLoad = loadCoachContextFromSupabase()
    .then((value) => {
      if (loadRevision === coachContextRevision) cachedCoachContext = { value, loadedAt: Date.now() };
      applyContextIfLatest(requestId, value);
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
export function buildRecoveryCoreContextFromSupabase(options: { force?: boolean } = {}): Promise<CoachContext> {
  const now = Date.now();
  if (!options.force && cachedRecoveryCoreContext && now - cachedRecoveryCoreContext.loadedAt < COACH_CONTEXT_CACHE_MS) {
    return Promise.resolve(cachedRecoveryCoreContext.value);
  }
  if (activeRecoveryCoreLoad) return activeRecoveryCoreLoad;

  const loadRevision = coachContextRevision;
  const requestId = nextContextRequestId();
  activeRecoveryCoreLoad = (async () => {
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
    applyContextIfLatest(requestId, value);
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
  })().finally(() => { activeRecoveryCoreLoad = null; });
  return activeRecoveryCoreLoad;
}

/** Loads the rest of the Recovery page without downloading the full history table. */
export function buildRecoveryPageContextFromSupabase(options: { force?: boolean } = {}): Promise<CoachContext> {
  const now = Date.now();
  if (!options.force && cachedRecoveryPageContext && now - cachedRecoveryPageContext.loadedAt < COACH_CONTEXT_CACHE_MS) {
    return Promise.resolve(cachedRecoveryPageContext.value);
  }
  if (activeRecoveryPageLoad) return activeRecoveryPageLoad;

  const loadRevision = coachContextRevision;
  const requestId = nextContextRequestId();
  activeRecoveryPageLoad = (async () => {
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
    applyContextIfLatest(requestId, value);
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
  })().finally(() => { activeRecoveryPageLoad = null; });
  return activeRecoveryPageLoad;
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
