import { buildCoachContextFromData, type CoachContext } from '@/lib/buildCoachContext';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { loadRaceResults } from '@/lib/raceResults';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';

const COACH_CONTEXT_CACHE_MS = 30_000;
let cachedCoachContext: { value: CoachContext; loadedAt: number } | null = null;
let activeCoachContextLoad: Promise<CoachContext> | null = null;
let coachContextRevision = 0;

export function invalidateCoachContextCache(): void {
  cachedCoachContext = null;
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
      return value;
    })
    .finally(() => { activeCoachContextLoad = null; });
  return activeCoachContextLoad;
}

async function loadCoachContextFromSupabase(): Promise<CoachContext> {
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
}

if (typeof window !== 'undefined') {
  window.addEventListener('runmate:cloud-data-updated', invalidateCoachContextCache);
}
