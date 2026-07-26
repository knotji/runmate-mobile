import { Capacitor, registerPlugin } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';

export type ExerciseRoutePoint = {
  at: string;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  horizontalAccuracyMeters?: number;
  verticalAccuracyMeters?: number;
};

export type ExerciseRouteResult = {
  workoutId: string;
  status: 'available' | 'no_data' | 'denied_or_unavailable';
  points: ExerciseRoutePoint[];
};

interface ExerciseRouteNativePlugin {
  read(options: { workoutId: string }): Promise<ExerciseRouteResult>;
}

const ExerciseRoute = registerPlugin<ExerciseRouteNativePlugin>('ExerciseRoute');

export async function readLatestRunningRoute(): Promise<{
  workout: { platformId: string; startDate: string; sourceName?: string };
  route: ExerciseRouteResult;
}> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    throw new Error('Exercise routes can currently be tested only in the Android app.');
  }

  const result = await Health.queryWorkouts({
    workoutType: 'running',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    ascending: false,
    limit: 20,
  });
  const workout = result.workouts.find((candidate) => Boolean(candidate.platformId));
  if (!workout?.platformId) throw new Error('No running workout with a Health Connect ID was found in the last 30 days.');

  return {
    workout: {
      platformId: workout.platformId,
      startDate: workout.startDate,
      sourceName: workout.sourceName,
    },
    route: await ExerciseRoute.read({ workoutId: workout.platformId }),
  };
}
