import { durationMinutes, number } from '@/lib/trainingAdherence';

type WorkoutFields = Record<string, unknown>;

export function workoutDurationMinutes(extracted: WorkoutFields, data: WorkoutFields = {}): number | null {
  return durationMinutes(extracted.duration)
    ?? secondsToMinutes(extracted.activeDurationSeconds)
    ?? finiteNumber(extracted.durationMinutes)
    ?? finiteNumber(extracted.durationMin)
    ?? finiteNumber(data.durationMin);
}

export function workoutDurationText(extracted: WorkoutFields, data: WorkoutFields = {}): string | null {
  const supplied = typeof extracted.duration === 'string' && extracted.duration.trim()
    ? extracted.duration.trim()
    : null;
  if (supplied) return supplied;

  const activeSeconds = finiteNumber(extracted.activeDurationSeconds);
  if (activeSeconds !== null) return formatClockDuration(activeSeconds);

  const minutes = workoutDurationMinutes(extracted, data);
  return minutes === null ? null : `${Math.round(minutes)} min`;
}

function secondsToMinutes(value: unknown): number | null {
  const seconds = finiteNumber(value);
  return seconds === null ? null : seconds / 60;
}

function finiteNumber(value: unknown): number | null {
  const parsed = number(value);
  return parsed !== null && Number.isFinite(parsed) ? parsed : null;
}

function formatClockDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
