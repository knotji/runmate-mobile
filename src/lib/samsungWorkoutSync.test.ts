import { afterEach, describe, expect, it, vi } from 'vitest';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample, Workout } from '@capgo/capacitor-health';
import { mapSamsungWorkout, queryAllHealthConnectWorkouts } from './samsungWorkoutSync';

vi.mock('@capgo/capacitor-health', () => ({ Health: { queryWorkouts: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe('Samsung Health workout importer', () => {
  it('maps an outdoor run with native distance and Samsung heart rate samples', () => {
    const workout: Workout = {
      workoutType: 'running', duration: 3600, totalDistance: 10160, totalEnergyBurned: 552,
      startDate: '2026-07-18T02:32:00.000Z', endDate: '2026-07-18T03:32:00.000Z',
      sourceId: 'com.sec.android.app.shealth', sourceName: 'Samsung Health', platformId: 'run-1016',
    };
    const hr = (value: number): HealthSample => ({ dataType: 'heartRate', value, unit: 'bpm', startDate: workout.startDate, endDate: workout.startDate, sourceId: 'com.sec.android.app.shealth' });
    const vo2: HealthSample = { dataType: 'vo2Max', value: 47.7, unit: 'mL/min/kg', startDate: workout.endDate, endDate: workout.endDate, sourceId: 'com.sec.android.app.shealth' };
    const item = mapSamsungWorkout(workout, [hr(160), hr(178)], [vo2]);
    const extracted = (item?.data as { extracted: Record<string, unknown> }).extracted;
    expect(item?.id).toBe(mapSamsungWorkout(workout, [hr(160), hr(178)])?.id);
    expect(item?.id).toMatch(/^healthconnect-samsung-workout-/);
    expect(item?.dateKey).toBe('2026-07-18');
    expect(extracted).toMatchObject({ workoutKind: 'outdoor_run', distanceKm: 10.16, duration: '1:00:00', avgPace: '5:54/km', avgHR: 169, maxHR: 178, calories: 552, vo2Max: 47.7 });
  });

  it('maps pool swimming with meter-based distance and /100 m pace', () => {
    const item = mapSamsungWorkout({
      workoutType: 'swimmingPool', duration: 1275, totalDistance: 200,
      startDate: '2026-07-17T13:12:00.000Z', endDate: '2026-07-17T13:33:15.000Z',
      sourceId: 'com.sec.android.app.shealth', platformId: 'swim-200',
    });
    const extracted = (item?.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted).toMatchObject({ workoutKind: 'swimming', swimKind: 'pool', distanceM: 200, distanceKm: null, avgPace: '10:38/100 m' });
  });

  it('rejects an invalid session interval', () => {
    expect(mapSamsungWorkout({ workoutType: 'walking', duration: 0, startDate: '2026-07-18T03:00:00Z', endDate: '2026-07-18T02:00:00Z' })).toBeNull();
  });

  it('follows every workout pagination anchor and sorts the complete result', async () => {
    const oldWorkout: Workout = { workoutType: 'walking', duration: 600, startDate: '2026-06-20T01:00:00Z', endDate: '2026-06-20T01:10:00Z', platformId: 'old' };
    const latestWorkout: Workout = { workoutType: 'running', duration: 1800, startDate: '2026-07-19T01:00:00Z', endDate: '2026-07-19T01:30:00Z', platformId: 'latest' };
    const query = vi.mocked(Health.queryWorkouts)
      .mockResolvedValueOnce({ workouts: [oldWorkout], anchor: 'next-page' })
      .mockResolvedValueOnce({ workouts: [latestWorkout] });
    const result = await queryAllHealthConnectWorkouts({ startDate: '2026-06-19T00:00:00Z', ascending: false });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0].anchor).toBe('next-page');
    expect(result.map((workout) => workout.platformId)).toEqual(['latest', 'old']);
  });
});
