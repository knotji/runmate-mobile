import { vi } from 'vitest';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { buildCoachContextFromSupabase, invalidateCoachContextCache } from '@/lib/coachContextService';

vi.mock('@/lib/cloudHistory', () => ({ loadHistoryItems: vi.fn(async () => ({ ok: true, items: [] })) }));
vi.mock('@/lib/profileStorage', () => ({ loadProfileFromSupabase: vi.fn(async () => ({ ok: true, profile: null })) }));
vi.mock('@/lib/raceStorage', () => ({ loadActiveRaceGoalAndPlan: vi.fn(async () => ({ ok: true, goal: null, plan: null })) }));
vi.mock('@/lib/raceResults', () => ({ loadRaceResults: vi.fn(async () => ({ ok: true, results: [] })) }));

describe('coachContextService', () => {
  beforeEach(() => {
    invalidateCoachContextCache();
    vi.clearAllMocks();
  });

  it('shares an active load and reuses the short-lived cache', async () => {
    const [first, second] = await Promise.all([
      buildCoachContextFromSupabase(),
      buildCoachContextFromSupabase(),
    ]);
    const cached = await buildCoachContextFromSupabase();

    expect(first).toBe(second);
    expect(cached).toBe(first);
    expect(loadHistoryItems).toHaveBeenCalledTimes(1);
  });

  it('loads fresh data after invalidation', async () => {
    await buildCoachContextFromSupabase();
    invalidateCoachContextCache();
    await buildCoachContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenCalledTimes(2);
  });
});
