import { beforeEach, describe, expect, it } from 'vitest';
import { loadGpxRoute, parseGpx, removeGpxRoute, routeMatchesWorkout, saveGpxRoute } from './gpxRoute';

const GPX = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk><trkseg>
    <trkpt lat="13.7500" lon="100.5000"><ele>8.2</ele><time>2026-07-24T11:41:13Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>152</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
    <trkpt lat="13.7510" lon="100.5010"><ele>9.1</ele><time>2026-07-24T11:42:13Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

describe('GPX routes', () => {
  beforeEach(() => localStorage.clear());

  it('parses Samsung-style GPX track points and extensions', () => {
    const route = parseGpx(GPX, 'run.gpx');
    expect(route.points).toHaveLength(2);
    expect(route.points[0]).toMatchObject({ elevationMeters: 8.2, heartRate: 152 });
    expect(route.startTime).toBe('2026-07-24T11:41:13Z');
    expect(route.distanceKm).toBeGreaterThan(0);
  });

  it('matches the GPX start to its workout and persists only on this device', () => {
    const route = parseGpx(GPX, 'run.gpx');
    expect(routeMatchesWorkout(route, '2026-07-24T11:41:12.258Z')).toBe(true);
    expect(routeMatchesWorkout(route, '2026-07-24T14:41:12.258Z')).toBe(false);
    saveGpxRoute('workout-1', route);
    expect(loadGpxRoute('workout-1')?.fileName).toBe('run.gpx');
    removeGpxRoute('workout-1');
    expect(loadGpxRoute('workout-1')).toBeNull();
  });
});
