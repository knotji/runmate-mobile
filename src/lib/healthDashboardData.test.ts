import { describe, expect, it } from 'vitest';
import type { CoachContext, WeekSleepRow } from '@/lib/buildCoachContext';
import type { RecoveryTrend } from '@/lib/recoveryTrends';
import type { NutritionTrend } from '@/lib/nutritionTrends';
import { assembleHealthDashboard, selectVisibleHealthSignals, type HealthStatTile } from './healthDashboardData';

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

function statTile(overrides: Partial<HealthStatTile> = {}): HealthStatTile {
  return { key: 'x', eyebrow: 'X', value: '10', deltaLabel: '', deltaDirection: 'flat', goodDirection: 'up', ...overrides };
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

  it('marks a day with no recovery score as "missing" rather than a fabricated low/caution score', () => {
    const points = ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'].map((date, index) => ({
      date,
      recovery: index === 2 ? null : 60,
      sleep: null,
      strain: null,
      state: 'scored' as const,
      hrv: null,
      restingHR: null,
      respiratoryRate: null,
    }));
    const dashboard = assembleHealthDashboard(context(), recoveryTrend({ points }), nutritionTrend());

    expect(dashboard.trend[2].status).toBe('missing');
    expect(dashboard.trend[2].value).toBe(0);
    // Every scored day stays on its real status, not swept into "missing".
    expect(dashboard.trend.filter((day) => day.status !== 'missing')).toHaveLength(6);
  });

  it('shows the current HRV value with a real delta when the baseline is ready (>=4 nights)', () => {
    const dashboard = assembleHealthDashboard(context(), recoveryTrend(), nutritionTrend());

    const hrvTile = dashboard.tiles.find((tile) => tile.key === 'hrv')!;
    expect(hrvTile.value).toBe('60');
    expect(hrvTile.deltaLabel).toMatch(/vs your baseline$/);
    expect(hrvTile.deltaDirection).not.toBe('flat');
  });

  it('shows the current HRV value with an honest "calibrating" label instead of a delta computed from 1-3 nights', () => {
    // Only 2 nights precede the latest one -> baseline.hrv.state === 'calibrating', not 'ready'.
    const dashboard = assembleHealthDashboard(
      context({ sleepBaseline30d: [night('2026-08-19', { hrv: 60 }), night('2026-08-18', { hrv: 58 }), night('2026-08-17', { hrv: 61 })] }),
      recoveryTrend(),
      nutritionTrend(),
    );

    const hrvTile = dashboard.tiles.find((tile) => tile.key === 'hrv')!;
    expect(hrvTile.value).toBe('60');
    expect(hrvTile.deltaLabel).toBe('Baseline calibrating (2/4 nights)');
    expect(hrvTile.deltaDirection).toBe('flat');
  });

  it('shows the current HRV value with a "not enough nights" label (never a fabricated delta) when the baseline is insufficient', () => {
    const dashboard = assembleHealthDashboard(
      context({ sleepBaseline30d: [night('2026-08-19', { hrv: 60, restingHR: 52 })] }),
      recoveryTrend(),
      nutritionTrend(),
    );

    const hrvTile = dashboard.tiles.find((tile) => tile.key === 'hrv')!;
    expect(hrvTile.value).toBe('60');
    expect(hrvTile.deltaLabel).toBe('Not enough nights yet for a baseline');
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

  it('does not surface an HRV-specific warning in Data Sources when the HRV tile is hidden — no duplicate provenance', () => {
    // No HRV/RHR readings anywhere -> both tiles resolve to "—" and get
    // filtered out of the summary grid, but Data Sources only ever tracks
    // Health Connect + Respiratory rate; it never grows an HRV row.
    const contextWithoutHrv = context();
    contextWithoutHrv.sleepBaseline30d = contextWithoutHrv.sleepBaseline30d.map((n) => ({ ...n, hrv: null, restingHR: null }));
    const dashboard = assembleHealthDashboard(contextWithoutHrv, recoveryTrend(), nutritionTrend());

    expect(dashboard.sources).toHaveLength(2);
    expect(dashboard.sources.map((source) => source.label)).toEqual(['Health Connect', 'Respiratory rate']);
    expect(dashboard.sources.some((source) => /hrv/i.test(source.label) || /hrv/i.test(source.detail))).toBe(false);
  });
});

describe('selectVisibleHealthSignals', () => {
  it('omits a tile whose value is "—" (HRV completely absent)', () => {
    const tiles = [statTile({ key: 'hrv', value: '—' }), statTile({ key: 'rhr', value: '54' })];
    expect(selectVisibleHealthSignals(tiles).map((tile) => tile.key)).toEqual(['rhr']);
  });

  it('keeps a tile with a real current value even when its delta is a calibrating/insufficient-baseline message', () => {
    const tiles = [statTile({ key: 'hrv', value: '60', deltaLabel: 'Baseline calibrating (2/4 nights)' })];
    expect(selectVisibleHealthSignals(tiles)).toHaveLength(1);
  });

  it('returns exactly 3 tiles when only 3 of 4 signals are displayable — no placeholder fourth tile', () => {
    const tiles = [statTile({ key: 'hrv', value: '—' }), statTile({ key: 'rhr', value: '54' }), statTile({ key: 'sleep', value: '7h 12m' }), statTile({ key: 'nutrition', value: '2,200' })];
    const visible = selectVisibleHealthSignals(tiles);
    expect(visible).toHaveLength(3);
    expect(visible.map((tile) => tile.key)).toEqual(['rhr', 'sleep', 'nutrition']);
  });

  it('returns exactly 1 tile when only 1 of 4 signals is displayable', () => {
    const tiles = [statTile({ key: 'hrv', value: '—' }), statTile({ key: 'rhr', value: '—' }), statTile({ key: 'sleep', value: '7h 12m' }), statTile({ key: 'nutrition', value: '—' })];
    expect(selectVisibleHealthSignals(tiles).map((tile) => tile.key)).toEqual(['sleep']);
  });

  it('returns an empty array when every signal is "—" — the page shows an honest empty state, not four blank tiles', () => {
    const tiles = [statTile({ key: 'hrv', value: '—' }), statTile({ key: 'rhr', value: '—' }), statTile({ key: 'sleep', value: '—' }), statTile({ key: 'nutrition', value: '—' })];
    expect(selectVisibleHealthSignals(tiles)).toEqual([]);
  });
});
