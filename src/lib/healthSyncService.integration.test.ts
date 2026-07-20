import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSamsungSleep } from './samsungSleepSync';
import { syncSamsungWeight } from './samsungProfileSync';
import { syncSamsungWorkouts } from './samsungWorkoutSync';
import { repairWorkoutHistory, syncHealthHistory, syncTodayHealth } from './healthSyncService';

vi.mock('./samsungSleepSync', () => ({
  syncSamsungSleep: vi.fn(async () => ({ status: 'synced', imported: 1, added: 1, updated: 0, unchanged: 0, failed: 0 })),
}));
vi.mock('./samsungWorkoutSync', () => ({
  syncSamsungWorkouts: vi.fn(async () => ({ status: 'synced', imported: 1, added: 0, updated: 1, unchanged: 0, failed: 0 })),
}));
vi.mock('./samsungProfileSync', () => ({
  syncSamsungWeight: vi.fn(async () => ({ status: 'synced', weightKg: 62 })),
}));

describe('Health Sync orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('limits foreground sync to today and reports changed records', async () => {
    const result = await syncTodayHealth(true);
    expect(syncSamsungSleep).toHaveBeenCalledWith('today');
    expect(syncSamsungWorkouts).toHaveBeenCalledWith('today');
    expect(syncSamsungWeight).not.toHaveBeenCalled();
    expect(result).toMatchObject({ performed: true, changed: true });
  });

  it('uses the 30-day scope only for explicit Health Connect history actions', async () => {
    const result = await syncHealthHistory();
    expect(syncSamsungSleep).toHaveBeenCalledWith(30);
    expect(syncSamsungWorkouts).toHaveBeenCalledWith(30);
    expect(syncSamsungWeight).toHaveBeenCalledTimes(1);
    expect(result.changed).toBe(true);
  });

  it('repairs only Workout history for the last 30 days', async () => {
    await repairWorkoutHistory();
    expect(syncSamsungWorkouts).toHaveBeenCalledWith(30);
    expect(syncSamsungSleep).not.toHaveBeenCalled();
    expect(syncSamsungWeight).not.toHaveBeenCalled();
  });
});
