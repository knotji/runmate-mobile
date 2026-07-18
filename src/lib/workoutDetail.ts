import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';

export function buildWorkoutDetail(item: LocalHistoryItem) {
  const data = record(item.data);
  const extracted = record(data.extracted);
  const coach = record(data.coach);
  const isStrength = item.type === 'strength' || extracted.workoutKind === 'strength';
  const isSwim = extracted.workoutKind === 'swimming' || extracted.swimKind === 'pool' || extracted.swimKind === 'open_water';
  const title = isStrength ? string(extracted.workoutName) ?? string(data.routineName) ?? 'Strength Training' : isSwim ? (extracted.swimKind === 'open_water' ? 'Open Water Swim' : 'Pool Swim') : titleCase(string(extracted.workoutKind) ?? 'Workout');
  const metrics = isStrength
    ? compactValues([
      ['Duration', string(extracted.duration) ?? unit(data.durationMin, 'min')], ['Average HR', unit(extracted.avgHR, 'bpm')],
      ['Max HR', unit(extracted.maxHR, 'bpm')], ['Calories', unit(extracted.calories, 'kcal')],
      ['Intensity', titleCase(string(extracted.intensity) ?? string(data.intensity) ?? '')],
      ['Exercises', Array.isArray(extracted.exercises) ? `${extracted.exercises.length}` : Array.isArray(data.exercises) ? `${data.exercises.length}` : null],
    ])
    : isSwim
    ? compactValues([
      ['Distance', unit(extracted.distanceM, 'm')], ['Duration', string(extracted.duration)], ['Average Pace', string(extracted.avgPace)],
      ['Average Speed', unit(extracted.avgSpeedKmh, 'km/h')], ['Average HR', unit(extracted.avgHR, 'bpm')], ['Max HR', unit(extracted.maxHR, 'bpm')],
      ['Calories', unit(extracted.calories, 'kcal')], ['Pool Length', unit(extracted.poolLengthM, 'm')], ['Lengths', number(extracted.totalLengths)],
      ['Total Strokes', number(extracted.totalStrokes)], ['Average SWOLF', number(extracted.avgSwolf)], ['Best SWOLF', number(extracted.bestSwolf)],
    ])
    : compactValues([
      ['Distance', unit(extracted.distanceKm, 'km')], ['Duration', string(extracted.duration)], ['Average Pace', string(extracted.avgPace)], ['Max Pace', string(extracted.maxPace)],
      ['Average Speed', unit(extracted.avgSpeedKmh, 'km/h')], ['Max Speed', unit(extracted.maxSpeedKmh, 'km/h')],
      ['Average HR', unit(extracted.avgHR, 'bpm')], ['Max HR', unit(extracted.maxHR, 'bpm')], ['Calories', unit(extracted.calories, 'kcal')], ['Steps', number(extracted.steps)],
      ['Cadence', unit(extracted.cadence, 'spm')], ['Elevation', unit(extracted.elevationGain, 'm')], ['VO₂ Max', number(extracted.vo2Max)],
      ['Max Cadence', unit(extracted.maxCadence, 'spm')], ['Sweat Loss', unit(extracted.sweatLossMl, 'ml')],
    ]);
  const rawExercises = Array.isArray(isStrength ? data.exercises : extracted.exercises) ? (isStrength ? data.exercises : extracted.exercises) as unknown[] : [];
  const exercises = rawExercises.map((value) => {
    const exercise = record(value);
    const parts = [unit(exercise.sets, 'sets'), exercise.reps == null ? null : `${exercise.reps} reps`, unit(exercise.weightKg, 'kg')].filter(Boolean);
    return { name: string(exercise.name) ?? 'Exercise', detail: parts.join(' · ') || 'Recorded' };
  });
  const insights = isStrength
    ? compactValues([['Notes', string(data.notes)], ['Coach Note', string(data.coachReason)]])
    : compactValues([
      ['Summary', string(coach.workoutSummary)], ['Intensity', string(coach.intensityAssessment)], ['Training Load', string(coach.trainingLoadNote)],
      ['Recovery', string(coach.recoveryAdvice)], ['Nutrition', string(coach.nutritionAfterWorkout)], ['Next Workout', string(coach.nextWorkoutSuggestion)],
    ]);
  return {
    isStrength,
    isSwim,
    tone: isStrength ? 'strength' : 'cardio',
    title,
    date: new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${getHistoryItemDateKey(item)}T12:00:00`)),
    intensity: titleCase(string(isStrength ? data.intensity : extracted.intensity) ?? ''),
    metrics,
    exercises,
    insights,
    source: item.source?.provider ? titleCase(item.source.provider) : 'RunMate',
  };
}

function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function string(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function number(value: unknown): string | null { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10}` : null; }
function unit(value: unknown, suffix: string): string | null { const result = number(value); return result ? `${result} ${suffix}` : null; }
function titleCase(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function compactValues(values: Array<[string, string | null]>): Array<{ label: string; value: string }> { return values.filter((value): value is [string, string] => Boolean(value[1])).map(([label, value]) => ({ label, value })); }
