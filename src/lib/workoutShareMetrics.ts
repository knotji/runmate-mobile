export type SportType = 'running' | 'walking' | 'cycling' | 'strength' | 'swimming' | 'workout';

export type WorkoutMetricKey = 'distance' | 'duration' | 'pace' | 'heart-rate' | 'calories' | 'elevation';

export type WorkoutStoryMetric = {
  key: WorkoutMetricKey;
  label: string;
  value: string;
  unit?: string;
};

export const WORKOUT_METRIC_ORDER: WorkoutMetricKey[] = [
  'distance',
  'duration',
  'pace',
  'heart-rate',
  'calories',
  'elevation',
];

export function getAvailableWorkoutMetrics(data: {
  sportType: SportType;
  distanceKm?: number;
  durationSeconds: number;
  pace?: string;
  averageHeartRate?: number;
  caloriesKcal?: number;
  elevationMeters?: number;
}): WorkoutStoryMetric[] {
  const metrics: WorkoutStoryMetric[] = [];
  const hasDistance = typeof data.distanceKm === 'number' && data.distanceKm > 0;
  if (hasDistance) {
    const showSwimMeters = data.sportType === 'swimming' && data.distanceKm! < 1;
    metrics.push({
      key: 'distance',
      label: 'Distance',
      value: showSwimMeters ? `${Math.round(data.distanceKm! * 1000)}` : formatDistance(data.distanceKm!),
      unit: showSwimMeters ? 'm' : 'km',
    });
  }
  if (data.durationSeconds > 0) {
    metrics.push({
      key: 'duration',
      label: 'Time',
      value: formatDuration(data.durationSeconds),
    });
  }
  if (data.pace) {
    metrics.push({
      key: 'pace',
      label: 'Average Pace',
      value: data.pace,
    });
  }
  if (typeof data.averageHeartRate === 'number') {
    metrics.push({
      key: 'heart-rate',
      label: 'Average HR',
      value: `${Math.round(data.averageHeartRate)}`,
      unit: 'bpm',
    });
  }
  if (typeof data.caloriesKcal === 'number' && data.caloriesKcal > 0) {
    metrics.push({
      key: 'calories',
      label: 'Calories',
      value: `${Math.round(data.caloriesKcal)}`,
      unit: 'kcal',
    });
  }
  if (typeof data.elevationMeters === 'number') {
    metrics.push({
      key: 'elevation',
      label: 'Elevation',
      value: `${Math.round(data.elevationMeters)}`,
      unit: 'm',
    });
  }
  return metrics;
}

function formatDistance(distance: number): string {
  return distance >= 100 ? Math.round(distance).toString() : distance.toFixed(2);
}

function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
