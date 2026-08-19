import { describe, expect, it } from 'vitest';
import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';
import type { RecoveryTrend } from '@/lib/recoveryTrends';
import type { NutritionTrend } from '@/lib/nutritionTrends';
import { assembleHealthDashboard } from './healthDashboardData';

const night = (date: string, overrides: Partial<WeekSleepRow> = {}): WeekSleepRow => ({
  date,
  durationH: '7h',
  durationMinutes: 420,
  score: 75,
  readiness: null,
  restingHR: 52,
  hrv: 60,
  energyScore: null,
  sleepStartTime: null,
  sleepEndTime: null,
  timeInBedMinutes: 450,
  respiratoryRate: 15,
  awakeMinutes: 20,
  remMinutes: null,
  lightMinutes: null,
  deepMinutes: null,
  ...overrides,
});

function context(overrides: Partial<CoachContext> = {}): CoachContext {
  const baseline = [
    night('2026-08-19', { hrv: 60, restingHR: 52 }),
    night('2026-08-18', { hrv: 58, restingHR: 53 }),
    night('2026-08-17', { hrv: 61, restingHR: 51 }),
    night('2026-08-16', { hrv: 59, restingHR: 54 }),
    night('2026-08-15', { hrv: 57, restingHR: 52 }),
  ];
  return {
    todayDate: '2026-08-19',
    sleepBaseline30d: baseline,
    sleep7d: baseline,
    recoverySystem: { dataFreshness: { status: 'today' } },
    ...overrides,
  } as unknown as CoachContext;
}

function recoveryTrend(overrides: Partial<RecoveryTrend> = {}): RecoveryTrend {
  const points = ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'].map((date, index) => ({
    date,
    recovery: 60 + index * 4,
    sleep: null,
    strain: null,
    state: 'scored' as const,
    hrv: null,
    restingHR: null,
    respiratoryRate: null,
  }));
  return { points, insight: {} as never, calibration: {} as never, ...overrides };
}

function nutritionTrend(overrides: Partial<NutritionTrend> = {}): NutritionTrend {
  return { rangeDays: 7, days: [], loggedDays: 6, mealCount: 14, averageCalories: 2200, averageProtein: 120, averageCarbs: 260, averageFat: 70, proteinDataDays: 6, training: {} as never, rest: {} as never, insight: {} as never, ...overrides };
}

describe('assembleHealthDashboard', () => {
  it('builds a full 7-day trend, HRV/RHR/Sleep/Nutrition tiles, and Data Sources from a ready context', () => {
    const dashboard = assembleHealthDashboard(context(), recoveryTrend(), nutritionTrend());

    expect(dashboard.trend).toHaveLength(7);
    expect(dashboard.anchorValue).toBe('84'); // last point: 60 + 6*4
    expect(dashboard.tiles.map((tile) => tile.key)).toEqual(['hrv', 'rhr', 'sleep', 'nutrition']);
    expect(dashboard.tiles[0].value).toBe('60');
    expect(dashboard.tiles[3].value).toBe('2,200');
    expect(dashboard.sources[0]).toEqual({ label: 'Health Connect', detail: 'Synced with today\'s data', state: 'ok' });
  });

  it('falls back to a baseline-sample-count label instead of a fabricated delta when HRV baseline is insufficient', () => {
    const dashboard = assembleHealthDashboard(
      context({ sleepBaseline30d: [night('2026-08-19', { hrv: 60, restingHR: 52 })] }),
      recoveryTrend(),
      nutritionTrend(),
    );

    const hrvTile = dashboard.tiles.find((tile) => tile.key === 'hrv')!;
    expect(hrvTile.deltaLabel).toBe('0 nights of baseline so far');
    expect(hrvTile.deltaDirection).toBe('flat');
  });

  it('marks respiratory rate missing (not a fabricated estimate) when no device ever reports it', () => {
    const contextWithoutRespiratory = context();
    contextWithoutRespiratory.sleepBaseline30d = contextWithoutRespiratory.sleepBaseline30d.map((n) => ({ ...n, respiratoryRate: null }));
    const dashboard = assembleHealthDashboard(contextWithoutRespiratory, recoveryTrend(), nutritionTrend());

    expect(dashboard.sources[1]).toEqual({
      label: 'Respiratory rate',
      detail: 'Not reported by this device\'s Health Connect source — shown as missing, never estimated',
      state: 'missing',
    });
  });

  it('flags Health Connect as stale rather than "ok" when the latest sync did not include today', () => {
    const dashboard = assembleHealthDashboard(
      context({ recoverySystem: { dataFreshness: { status: 'stale' } } as never }),
      recoveryTrend(),
      nutritionTrend(),
    );

    expect(dashboard.sources[0]).toEqual({ label: 'Health Connect', detail: 'Last sync did not include today', state: 'stale' });
  });

  it('shows "—" for the nutrition tile instead of "0 kcal" when no meals were logged', () => {
    const dashboard = assembleHealthDashboard(context(), recoveryTrend(), nutritionTrend({ averageCalories: null, loggedDays: 0 }));

    const nutritionTile = dashboard.tiles.find((tile) => tile.key === 'nutrition')!;
    expect(nutritionTile.value).toBe('—');
    expect(nutritionTile.unit).toBeUndefined();
    expect(nutritionTile.deltaLabel).toBe('Logged 0 of 7 days');
  });
});
