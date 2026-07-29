import type { RacePlan, TrainingWeek, WeekWorkout } from '@/types/race';

/**
 * Refreshes guidance without rewriting the schedule users already followed.
 * Elapsed sessions keep their day, workout type, and planned distance so
 * adherence remains stable; matching generated sessions may enrich coaching
 * details such as pace, HR, purpose, and description.
 */
export function mergeRefreshedRacePlan(previous: RacePlan, generated: RacePlan, today: string): RacePlan {
  const currentWeek = currentPlanWeek(previous.planStartDate, today);
  return {
    ...generated,
    planStartDate: previous.planStartDate ?? generated.planStartDate ?? today,
    createdAt: previous.createdAt ?? generated.createdAt ?? null,
    weeklyPlan: mergeCurrentWeek(previous.weeklyPlan ?? [], generated.weeklyPlan ?? [], today),
    weeks: mergeTrainingWeeks(previous.weeks ?? [], generated.weeks ?? [], currentWeek, today),
  };
}

function mergeTrainingWeeks(previous: TrainingWeek[], generated: TrainingWeek[], currentWeek: number | null, today: string): TrainingWeek[] {
  if (currentWeek === null) return generated;
  const oldByNumber = new Map(previous.map((week) => [week.weekNumber, week]));
  const newByNumber = new Map(generated.map((week) => [week.weekNumber, week]));
  const weekNumbers = [...new Set([...oldByNumber.keys(), ...newByNumber.keys()])].sort((a, b) => a - b);

  return weekNumbers.flatMap((weekNumber) => {
    const oldWeek = oldByNumber.get(weekNumber);
    const newWeek = newByNumber.get(weekNumber);
    if (weekNumber < currentWeek) return oldWeek ? [oldWeek] : [];
    if (weekNumber > currentWeek) return newWeek ? [newWeek] : oldWeek ? [oldWeek] : [];
    if (!oldWeek) return newWeek ? [newWeek] : [];
    if (!newWeek) return [oldWeek];
    return [{
      ...newWeek,
      workouts: mergeCurrentWeek(oldWeek.workouts, newWeek.workouts, today),
    }];
  });
}

function mergeCurrentWeek(previous: WeekWorkout[], generated: WeekWorkout[], today: string): WeekWorkout[] {
  const todayWeekday = weekdayIndex(today);
  const generatedByDay = new Map(generated.map((workout) => [weekdayIndex(workout.day), workout]));
  const previousByDay = new Map(previous.map((workout) => [weekdayIndex(workout.day), workout]));
  const days = [...new Set([...previousByDay.keys(), ...generatedByDay.keys()])].sort((a, b) => a - b);

  return days.flatMap((day) => {
    const oldWorkout = previousByDay.get(day);
    const newWorkout = generatedByDay.get(day);
    if (day > todayWeekday) return newWorkout ? [newWorkout] : oldWorkout ? [oldWorkout] : [];
    if (!oldWorkout) return newWorkout ? [newWorkout] : [];
    if (!newWorkout || workoutKind(oldWorkout.workoutType) !== workoutKind(newWorkout.workoutType)) return [oldWorkout];
    return [{
      ...oldWorkout,
      targetPace: newWorkout.targetPace ?? oldWorkout.targetPace,
      targetHR: newWorkout.targetHR ?? oldWorkout.targetHR,
      description: newWorkout.description || oldWorkout.description,
      durationMin: newWorkout.durationMin ?? oldWorkout.durationMin,
      purpose: newWorkout.purpose ?? oldWorkout.purpose,
      adjustment: newWorkout.adjustment ?? oldWorkout.adjustment,
    }];
  });
}

function currentPlanWeek(planStartDate: string | null | undefined, today: string): number | null {
  if (!planStartDate) return null;
  const start = startOfWeek(planStartDate.slice(0, 10));
  const current = startOfWeek(today);
  const difference = Math.round((Date.parse(`${current}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
  return difference < 0 ? null : Math.floor(difference / 7) + 1;
}

function startOfWeek(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function weekdayIndex(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+07:00`).getDay();
  const day = value.trim().toLowerCase();
  if (day.startsWith('sun')) return 0;
  if (day.startsWith('mon')) return 1;
  if (day.startsWith('tue')) return 2;
  if (day.startsWith('wed')) return 3;
  if (day.startsWith('thu')) return 4;
  if (day.startsWith('fri')) return 5;
  if (day.startsWith('sat')) return 6;
  return -1;
}

function workoutKind(value: string): string {
  const kind = value.toLowerCase();
  if (/rest|recovery day|พัก/.test(kind)) return 'rest';
  if (/tempo|threshold/.test(kind)) return 'tempo';
  if (/interval|speed|repeat/.test(kind)) return 'interval';
  if (/long/.test(kind)) return 'long';
  if (/easy|recovery run/.test(kind)) return 'easy';
  if (/strength|weight|core/.test(kind)) return 'strength';
  return kind.replace(/\s+/g, '_');
}
