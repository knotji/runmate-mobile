import { vi } from 'vitest';
import { loadHistoryItems } from '@/lib/cloudHistory';
import {
  buildCoachContextFromSupabase,
  buildRecoveryCoreContextFromSupabase,
  buildRecoveryPageContextFromSupabase,
  invalidateCoachContextCache,
  RECOVERY_CONTEXT_LOOKBACK_DAYS,
} from '@/lib/coachContextService';

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

  it('uses a bounded physiological fast path for the Recovery dials', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T05:00:00.000Z'));

    await buildRecoveryCoreContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenCalledWith(
      ['sleep', 'workout', 'pain', 'strength', 'sick'],
      {
        limit: 500,
        createdAfter: new Date(Date.now() - RECOVERY_CONTEXT_LOOKBACK_DAYS * 86_400_000).toISOString(),
      },
    );
    vi.useRealTimers();
  });

  it('loads secondary Recovery content with recent and durable queries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-21T05:00:00.000Z'));

    await buildRecoveryPageContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenNthCalledWith(
      1,
      ['sleep', 'workout', 'meal', 'pain', 'strength', 'sick'],
      {
        limit: 700,
        createdAfter: new Date(Date.now() - RECOVERY_CONTEXT_LOOKBACK_DAYS * 86_400_000).toISOString(),
      },
    );
    expect(loadHistoryItems).toHaveBeenNthCalledWith(2, ['body', 'health_check'], { limit: 10 });
    vi.useRealTimers();
  });

  it('reuses the cached Recovery core context within the TTL', async () => {
    await buildRecoveryCoreContextFromSupabase();
    await buildRecoveryCoreContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenCalledTimes(1);
  });

  it('reuses the cached Recovery page context within the TTL', async () => {
    await buildRecoveryPageContextFromSupabase();
    await buildRecoveryPageContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenCalledTimes(2);
  });

  it('refetches Recovery core/page context after invalidation', async () => {
    await buildRecoveryCoreContextFromSupabase();
    invalidateCoachContextCache();
    await buildRecoveryCoreContextFromSupabase();

    expect(loadHistoryItems).toHaveBeenCalledTimes(2);
  });
});
