import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPerformanceDiagnostics,
  getPerformanceDiagnosticSummaries,
  getHealthSyncPerformanceComparison,
  measurePerformanceDiagnostic,
  performanceBudgetMs,
  recordPerformanceDiagnostic,
} from './performanceDiagnostics';

describe('Performance Diagnostics', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps compact timing samples and calculates a five-sample average', () => {
    [100, 200, 300, 400, 500, 900].forEach((duration) => recordPerformanceDiagnostic('recovery_core', duration));

    const summary = getPerformanceDiagnosticSummaries()[0];
    expect(summary).toMatchObject({ phase: 'recovery_core', averageMs: 460, sampleCount: 5 });
    expect(summary.latest.durationMs).toBe(900);
    expect(summary).toMatchObject({ budgetMs: 2500, budgetStatus: 'within' });
  });

  it('flags a rolling average that exceeds its phase budget', () => {
    [2600, 2800, 3000].forEach((duration) => recordPerformanceDiagnostic('activity_records', duration));

    expect(getPerformanceDiagnosticSummaries()[0]).toMatchObject({
      averageMs: 2800,
      budgetMs: 2500,
      budgetStatus: 'over',
    });
    expect(performanceBudgetMs('ai_coach_answer')).toBeNull();
  });

  it('records failed operations without swallowing the error', async () => {
    await expect(measurePerformanceDiagnostic('health_sync', async () => {
      throw new Error('Health unavailable');
    })).rejects.toThrow('Health unavailable');

    expect(getPerformanceDiagnostics()[0]).toMatchObject({ phase: 'health_sync', status: 'failed', detail: 'Health unavailable' });
  });

  it('includes Activity phases in the same on-device report', () => {
    recordPerformanceDiagnostic('activity_health_sync', 0, 'skipped', 'Cooldown reused latest sync');
    recordPerformanceDiagnostic('activity_records', 420, 'success', '12 records prepared');
    recordPerformanceDiagnostic('activity_archive', 1800, 'success', '80 archive records prepared');
    recordPerformanceDiagnostic('activity_nutrition', 2, 'success', '3 meals summarized');
    recordPerformanceDiagnostic('nutrition_trends', 310, 'success', '40 meal and training records prepared');
    recordPerformanceDiagnostic('recovery_trends', 440, 'success', '60 sleep and training records prepared');
    recordPerformanceDiagnostic('meal_detail', 160, 'success', 'Single meal record prepared');
    recordPerformanceDiagnostic('sleep_window', 210, 'success', 'Wake plan prepared');
    recordPerformanceDiagnostic('health_calendar', 280, 'success', '120 health records prepared');
    recordPerformanceDiagnostic('health_calendar_archive', 820, 'success', '900 older health records prepared');

    expect(getPerformanceDiagnosticSummaries().map((summary) => summary.phase)).toEqual([
      'activity_health_sync',
      'activity_records',
      'activity_archive',
      'activity_nutrition',
      'nutrition_trends',
      'recovery_trends',
      'meal_detail',
      'sleep_window',
      'health_calendar',
      'health_calendar_archive',
    ]);
  });

  it('compares prepared and live Recovery health reads separately', () => {
    recordPerformanceDiagnostic('health_sync', 120, 'success', 'Prepared', 'prepared');
    recordPerformanceDiagnostic('health_sync', 180, 'success', 'Prepared', 'prepared');
    recordPerformanceDiagnostic('health_sync', 1200, 'success', 'Live', 'live');
    recordPerformanceDiagnostic('health_sync', 1, 'skipped', 'Cooldown', 'cooldown');

    expect(getHealthSyncPerformanceComparison()).toEqual([
      { variant: 'prepared', averageMs: 150, sampleCount: 2 },
      { variant: 'live', averageMs: 1200, sampleCount: 1 },
    ]);
  });
});
