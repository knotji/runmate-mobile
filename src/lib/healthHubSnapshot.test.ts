import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadActivityStartupEntry } from './activityStartupCache';
import { loadBodyWeightTrendStartupSnapshot } from './bodyWeightTrendStartupCache';
import { loadNutritionTrendsStartupSnapshot } from './nutritionTrendsStartupCache';
import { loadPainTrendsStartupSnapshot } from './painTrendsStartupCache';
import { loadRecoveryStartupEntry } from './recoveryStartupCache';
import { loadRecoveryTrendsStartupSnapshot } from './recoveryTrendsStartupCache';
import { buildHealthHubSnapshot } from './healthHubSnapshot';

vi.mock('./activityStartupCache', () => ({ loadActivityStartupEntry: vi.fn() }));
vi.mock('./bodyWeightTrendStartupCache', () => ({ loadBodyWeightTrendStartupSnapshot: vi.fn() }));
vi.mock('./nutritionTrendsStartupCache', () => ({ loadNutritionTrendsStartupSnapshot: vi.fn() }));
vi.mock('./painTrendsStartupCache', () => ({ loadPainTrendsStartupSnapshot: vi.fn() }));
vi.mock('./recoveryStartupCache', () => ({ loadRecoveryStartupEntry: vi.fn() }));
vi.mock('./recoveryTrendsStartupCache', () => ({ loadRecoveryTrendsStartupSnapshot: vi.fn() }));

describe('Health hub snapshot', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(loadActivityStartupEntry).mockReturnValue(null);
    vi.mocked(loadBodyWeightTrendStartupSnapshot).mockReturnValue(null);
    vi.mocked(loadNutritionTrendsStartupSnapshot).mockReturnValue(null);
    vi.mocked(loadPainTrendsStartupSnapshot).mockReturnValue(null);
    vi.mocked(loadRecoveryStartupEntry).mockReturnValue(null);
    vi.mocked(loadRecoveryTrendsStartupSnapshot).mockReturnValue(null);
  });

  it('uses honest empty states without fetching destination data', () => {
    const snapshot = buildHealthHubSnapshot('2026-08-10T02:00:00.000Z');

    expect(snapshot.sleep).toEqual({ label: 'No recent sleep snapshot', tone: 'empty' });
    expect(snapshot.weight).toEqual({ label: 'No recent weight snapshot', tone: 'empty' });
    expect(snapshot.fitnessAge).toEqual({ label: 'Open to estimate', tone: 'empty' });
    expect(snapshot.healthConnect).toEqual({ label: 'Not synced on this device', tone: 'empty' });
  });

  it('distinguishes a current device sync from an older one', () => {
    const now = Date.parse('2026-08-10T02:00:00.000Z');
    window.localStorage.setItem('runmate:today-health-last-completed-at', String(now - 15 * 60_000));
    expect(buildHealthHubSnapshot(now).healthConnect).toEqual({ label: 'Synced 15m ago', tone: 'current' });

    window.localStorage.setItem('runmate:today-health-last-completed-at', String(now - 8 * 60 * 60_000));
    expect(buildHealthHubSnapshot(now).healthConnect).toEqual({ label: 'Last sync 8h ago', tone: 'attention' });
  });

  it('summarizes cached data without exposing it as live data', () => {
    vi.mocked(loadRecoveryStartupEntry).mockReturnValue({
      recovery: { sleepPerformance: { actualSleepMinutes: 358 }, strain: { score: 6.4 } },
    } as never);
    vi.mocked(loadNutritionTrendsStartupSnapshot).mockReturnValue({ sevenDay: { loggedDays: 5 } } as never);
    vi.mocked(loadPainTrendsStartupSnapshot).mockReturnValue({ thirtyDay: { hasActivePain: false, logs: [] } } as never);
    vi.mocked(loadBodyWeightTrendStartupSnapshot).mockReturnValue({ thirtyDay: { latestWeightKg: 51.6 } } as never);

    const snapshot = buildHealthHubSnapshot('2026-08-10T02:00:00.000Z');
    expect(snapshot.sleep.label).toBe('5h 58m last night');
    expect(snapshot.strain.label).toBe('6.4/21 today');
    expect(snapshot.nutrition.label).toBe('5/7 days logged');
    expect(snapshot.weight.label).toBe('51.6 kg latest');
    expect(snapshot.pain.label).toBe('No pain logged');
  });
});
