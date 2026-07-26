import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Workout } from '@capgo/capacitor-health';
import { queryAllHealthConnectWorkouts } from '@/lib/samsungWorkoutSync';

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

  // Do not pass workoutType to the Capgo query here. Its Android implementation
  // applies the type filter after paging and can return an empty first page even
  // when a run exists later in the Health Connect result set.
  const workouts = await queryAllHealthConnectWorkouts({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    ascending: false,
  }, 500);
  const workout = selectLatestRunningWorkout(workouts);
  if (!workout?.platformId) {
    const candidates = workouts.slice(0, 8).map((candidate) =>
      `${candidate.workoutType} · ${candidate.sourceName ?? candidate.sourceId ?? 'unknown source'} · ${candidate.startDate}`,
    );
    throw new Error(candidates.length
      ? `No run-like Health Connect workout was found. Recent workout types: ${candidates.join(' | ')}`
      : 'Health Connect returned no workouts from the last 30 days.');
  }

  return {
    workout: {
      platformId: workout.platformId,
      startDate: workout.startDate,
      sourceName: workout.sourceName,
    },
    route: await ExerciseRoute.read({ workoutId: workout.platformId }),
  };
}

export function selectLatestRunningWorkout(workouts: Workout[]): Workout | undefined {
  const runningTypes = new Set<Workout['workoutType']>(['running', 'trackAndField']);
  return workouts
    .filter((workout) => runningTypes.has(workout.workoutType) && Boolean(workout.platformId?.trim()))
    .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))[0];
}
