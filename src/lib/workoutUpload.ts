import { supabase } from '@/lib/supabaseClient';
import { prepareUploadImages } from '@/lib/mealUpload';
import type { WorkoutAnalysis } from '@/types/logs';

export async function analyzeWorkoutImages(files: File[], note: string): Promise<WorkoutAnalysis> {
  const imageDataUrls = await prepareUploadImages(files, { maxDimension: 1920, quality: 0.9, tileTallImages: true, maxOutputImages: 4 });
  const { data, error } = await supabase.functions.invoke('analyze-workout', { body: { imageDataUrls, note } });
  if (error) throw new Error(error.message.includes('non-2xx') ? 'Workout Analysis Failed. Please Try Again.' : error.message);
  if (!data?.data) throw new Error(data?.error ?? 'Workout Analysis Returned No Result');
  return normalizeWorkoutForReview(data.data as WorkoutAnalysis);
}

export function normalizeWorkoutForReview(workout: WorkoutAnalysis): WorkoutAnalysis {
  const isSwim = workout.extracted.workoutKind === 'swimming' || workout.extracted.swimKind != null || workout.extracted.distanceM != null;
  const workoutName = workout.extracted.workoutName?.trim() ?? '';
  const isStrength = workout.extracted.workoutKind === 'strength' || /(?:circuit|strength|weight|resistance|เวท)/i.test(workoutName);
  const normalizedWorkout = isSwim && workout.extracted.workoutKind !== 'swimming'
    ? { ...workout, extracted: { ...workout.extracted, workoutKind: 'swimming' as const } }
    : isStrength && workout.extracted.workoutKind !== 'strength'
    ? { ...workout, extracted: { ...workout.extracted, workoutKind: 'strength' as const } }
    : workout;
  const pace = workout.extracted.avgPace?.trim() ?? null;
  if (!pace || isSwim) return normalizedWorkout;
  const avgPace = normalizeRunPace(pace);
  const maxPace = workout.extracted.maxPace == null ? workout.extracted.maxPace : normalizeRunPace(workout.extracted.maxPace);
  if (avgPace === workout.extracted.avgPace && maxPace === workout.extracted.maxPace) return normalizedWorkout;
  return { ...normalizedWorkout, extracted: { ...normalizedWorkout.extracted, avgPace, maxPace } };
}

function normalizeRunPace(pace: string | null | undefined): string | null {
  if (!pace) return null;
  const match = pace.trim().match(/^0?(\d{1,2})[':](\d{2})["”]?\s*(?:\/km)?$/i);
  return match ? `${Number(match[1])}:${match[2]}/km` : pace;
}
