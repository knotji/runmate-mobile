import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import type { StoredGpxRoute } from './gpxRoute';
import { matchRouteToWorkout } from './sharedGpx';

const route: StoredGpxRoute = {
  fileName: 'run.gpx', importedAt: '2026-07-26T00:00:00Z',
  startTime: '2026-07-24T11:41:13Z', endTime: '2026-07-24T12:41:13Z',
  distanceKm: 10, points: [{ latitude: 13, longitude: 100 }, { latitude: 13.1, longitude: 100.1 }],
};

function workout(id: string, kind: string, start: string): LocalHistoryItem {
  return { id, type: 'workout', createdAt: start, recordedAt: start, data: { extracted: { workoutKind: kind }, workoutStartTime: start } };
}

describe('shared GPX matching', () => {
  it('automatically chooses the closest Outdoor Run', () => {
    const match = matchRouteToWorkout(route, [
      workout('walk', 'walk', '2026-07-24T11:41:13Z'),
      workout('older-run', 'outdoor_run', '2026-07-24T11:35:13Z'),
      workout('exact-run', 'outdoor_run', '2026-07-24T11:41:12Z'),
    ]);
    expect(match?.id).toBe('exact-run');
  });

  it('does not attach a route outside the safety window', () => {
    expect(matchRouteToWorkout(route, [workout('wrong-run', 'outdoor_run', '2026-07-24T12:30:00Z')])).toBeNull();
  });
});
