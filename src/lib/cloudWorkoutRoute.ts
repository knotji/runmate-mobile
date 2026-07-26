import { ensureSupabaseProfileSession } from '@/lib/profileStorage';
import type { StoredGpxRoute } from '@/lib/gpxRoute';

const MAX_CLOUD_POINTS = 1_500;

type RouteRow = {
  workout_id: string;
  route_points: Array<[number, number, number?, string?]>;
  start_time: string | null;
  end_time: string | null;
  distance_km: number | string | null;
  original_point_count: number;
  updated_at?: string;
};

export async function saveCloudWorkoutRoute(workoutId: string, route: StoredGpxRoute): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { ok: false, error: session.message ?? session.reason };
  const points = selectDisplayPoints(route);
  const { error } = await session.supabase.from('workout_routes').upsert({
    user_id: session.userId,
    workout_id: workoutId,
    source: 'samsung_gpx',
    route_points: points.map((point) => [
      round(point.latitude, 6),
      round(point.longitude, 6),
      point.elevationMeters == null ? null : round(point.elevationMeters, 1),
      point.at ?? null,
    ]),
    start_time: route.startTime,
    end_time: route.endTime,
    distance_km: route.distanceKm,
    original_point_count: route.points.length,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,workout_id' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function loadCloudWorkoutRoute(workoutIds: string[]): Promise<{ ok: true; workoutId: string; route: StoredGpxRoute | null } | { ok: false; error: string }> {
  const ids = [...new Set(workoutIds.filter(Boolean))];
  if (!ids.length) return { ok: true, workoutId: '', route: null };
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return { ok: false, error: session.message ?? session.reason };
  const { data, error } = await session.supabase
    .from('workout_routes')
    .select('workout_id,route_points,start_time,end_time,distance_km,original_point_count,updated_at')
    .eq('user_id', session.userId)
    .in('workout_id', ids)
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, workoutId: ids[0], route: null };
  const row = data as RouteRow;
  return {
    ok: true,
    workoutId: row.workout_id,
    route: {
      fileName: 'Cloud Run Map',
      importedAt: row.updated_at ?? new Date().toISOString(),
      startTime: row.start_time,
      endTime: row.end_time,
      distanceKm: Number(row.distance_km) || 0,
      points: row.route_points.map(([latitude, longitude, elevationMeters, at]) => ({
        latitude,
        longitude,
        ...(elevationMeters != null ? { elevationMeters } : {}),
        ...(at ? { at } : {}),
      })),
    },
  };
}

export async function deleteCloudWorkoutRoute(workoutIds: string[]): Promise<void> {
  const session = await ensureSupabaseProfileSession();
  if (!session.ok) return;
  await session.supabase.from('workout_routes').delete().eq('user_id', session.userId).in('workout_id', workoutIds);
}

function selectDisplayPoints(route: StoredGpxRoute) {
  if (route.points.length <= MAX_CLOUD_POINTS) return route.points;
  const stride = (route.points.length - 1) / (MAX_CLOUD_POINTS - 1);
  return Array.from({ length: MAX_CLOUD_POINTS }, (_, index) => route.points[Math.round(index * stride)]);
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
