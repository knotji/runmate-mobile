import { beforeEach, describe, expect, it } from 'vitest';
import { buildSupportDiagnostics } from './aboutDiagnostics';
import { recordPerformanceDiagnostic } from './performanceDiagnostics';
import { useRacePlanStore } from './race/racePlanStore';

describe('About diagnostics', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useRacePlanStore.getState().invalidate();
  });

  it('copies build and timing metadata without health record details', () => {
    recordPerformanceDiagnostic('activity_records', 900, 'success', '314 recent records prepared');
    const result = JSON.parse(buildSupportDiagnostics({
      version: '1.0.0',
      build: '1178',
      builtAt: '2026-07-29T00:00:00.000Z',
    })) as Record<string, unknown>;

    expect(result).toMatchObject({ app: 'RunMate', version: '1.0.0', build: '1178' });
    expect(JSON.stringify(result)).not.toContain('314 recent records');
    expect(result.performance).toEqual([expect.objectContaining({
      phase: 'activity_records',
      latestMs: 900,
      budgetStatus: 'within',
    })]);
  });

  it('includes privacy-safe sync, cache, failure, and plan metadata', () => {
    window.localStorage.setItem('runmate:today-health-last-completed-at', String(Date.parse('2026-07-30T01:00:00.000Z')));
    window.localStorage.setItem('runmate:samsung-sleep-last-synced-at', '2026-07-30T01:01:00.000Z');
    recordPerformanceDiagnostic('health_sync', 1200, 'failed', 'private provider error');
    useRacePlanStore.getState().setRacePlan(null, {
      raceCountdownText: '', totalWeeks: 1, currentPhase: '', planSummary: '', phases: [], weeks: [],
      safetyNotes: '', weeklyPlan: [], planVersion: 3, planStatus: 'active',
    });

    const result = JSON.parse(buildSupportDiagnostics({
      version: '1.0.0', build: '1192', builtAt: '2026-07-30T00:00:00.000Z',
    }));
    expect(result.healthSync).toMatchObject({
      todayCompletedAt: '2026-07-30T01:00:00.000Z',
      samsungSleepAt: '2026-07-30T01:01:00.000Z',
    });
    expect(result.racePlan).toMatchObject({ version: 3, status: 'active' });
    expect(result.latestFailures).toEqual([{ phase: 'health_sync', at: expect.any(String) }]);
    expect(JSON.stringify(result)).not.toContain('private provider error');
  });
});
