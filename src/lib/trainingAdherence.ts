import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { WeekWorkout } from '@/types/race';

export type AdherenceStatus = 'completed' | 'modified' | 'missed' | 'upcoming' | 'recovery';

export type TrainingAdherenceDay = {
  date: string;
  workout: WeekWorkout;
  status: AdherenceStatus;
  actualLabel: string | null;
};

export type TrainingAdherence = {
  completed: number;
  modified: number;
  missed: number;
  planned: number;
  percentage: number;
  days: TrainingAdherenceDay[];
};

export function buildTrainingAdherence(workouts: WeekWorkout[], actualItems: LocalHistoryItem[], today: string): TrainingAdherence {
  const actualByDate = new Map<string, LocalHistoryItem[]>();
  for (const item of actualItems) {
    const date = getHistoryItemDateKey(item);
    actualByDate.set(date, [...(actualByDate.get(date) ?? []), item]);
  }

  const days = workouts.map((workout) => {
    const date = workoutDate(workout, today);
    const supportive = isSupportiveDay(workout.workoutType);
    const candidates = actualByDate.get(date) ?? [];
    const compatible = candidates.find((item) => compatibleWorkout(workout, item));
    const actual = compatible ?? candidates[0] ?? null;
    const status: AdherenceStatus = supportive
      ? 'recovery'
      : compatible
        ? isCloseToPlan(workout, compatible) ? 'completed' : 'modified'
        : actual
          ? 'modified'
          : date < today
            ? 'missed'
            : 'upcoming';
    return { date, workout, status, actualLabel: actual ? actualWorkoutLabel(actual) : null };
  });

  const plannedDays = days.filter((day) => !isSupportiveDay(day.workout.workoutType));
  const completed = plannedDays.filter((day) => day.status === 'completed').length;
  const modified = plannedDays.filter((day) => day.status === 'modified').length;
  const missed = plannedDays.filter((day) => day.status === 'missed').length;
  const planned = plannedDays.length;
  return {
    completed,
    modified,
    missed,
    planned,
    percentage: planned > 0 ? Math.round(((completed + modified) / planned) * 100) : 0,
    days,
  };
}

function workoutDate(workout: WeekWorkout, today: string): string {
  const dated = workout as WeekWorkout & { date?: string; dateKey?: string; dayDate?: string };
  const explicit = dated.date ?? dated.dateKey ?? dated.dayDate;
  if (explicit) return explicit.slice(0, 10);
  const current = new Date(`${today}T12:00:00+07:00`);
  const targetDay = weekday(workout.day);
  current.setDate(current.getDate() - current.getDay() + (targetDay >= 0 ? targetDay : current.getDay()));
  return localDateKey(current);
}

function isSupportiveDay(value: string): boolean {
  return /\b(rest|recovery)\b|พัก|ฟื้นฟู/i.test(value);
}

function compatibleWorkout(plan: WeekWorkout, item: LocalHistoryItem): boolean {
  const planned = normalizedPlanKind(plan.workoutType);
  const actual = normalizedActualKind(item);
  if (!planned || !actual) return true;
  if (planned === actual) return true;
  return planned === 'run' && ['run', 'treadmill'].includes(actual);
}

function isCloseToPlan(plan: WeekWorkout, item: LocalHistoryItem): boolean {
  const extracted = record(record(item.data).extracted);
  const plannedDistance = plan.distanceKm;
  const actualDistance = number(extracted.distanceKm) ?? metersToKm(extracted.distanceM);
  if (plannedDistance && actualDistance != null && Math.abs(actualDistance - plannedDistance) > Math.max(1, plannedDistance * 0.3)) return false;
  const plannedDuration = plan.durationMin;
  const actualDuration = durationMinutes(extracted.duration);
  if (plannedDuration && actualDuration != null && Math.abs(actualDuration - plannedDuration) > Math.max(10, plannedDuration * 0.35)) return false;
  return true;
}

function normalizedPlanKind(value: string): string | null {
  const name = value.toLowerCase();
  if (/strength|weight|circuit|เวท/.test(name)) return 'strength';
  if (/swim|ว่าย/.test(name)) return 'swimming';
  if (/walk|เดิน/.test(name)) return 'walk';
  if (/cycle|bike|cycling|ปั่น/.test(name)) return 'cycling';
  if (/run|tempo|interval|long|easy|วิ่ง/.test(name)) return 'run';
  return name.trim() || null;
}

function normalizedActualKind(item: LocalHistoryItem): string | null {
  const extracted = record(record(item.data).extracted);
  const kind = String(extracted.workoutKind ?? (item.type === 'strength' ? 'strength' : '')).toLowerCase();
  if (/outdoor_run|running|run/.test(kind)) return 'run';
  if (/treadmill/.test(kind)) return 'treadmill';
  if (/strength/.test(kind)) return 'strength';
  if (/swim/.test(kind)) return 'swimming';
  if (/walk/.test(kind)) return 'walk';
  if (/cycl|bike/.test(kind)) return 'cycling';
  return kind || null;
}

function actualWorkoutLabel(item: LocalHistoryItem): string {
  const extracted = record(record(item.data).extracted);
  const name = typeof extracted.workoutName === 'string' ? extracted.workoutName.trim() : '';
  if (name) return name;
  const kind = normalizedActualKind(item);
  return kind ? kind.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Workout';
}

function weekday(value: string): number {
  const day = value.trim().toLowerCase().slice(0, 3);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(day);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function durationMinutes(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] + parts[1] / 60;
  return number(value);
}

function metersToKm(value: unknown): number | null { const parsed = number(value); return parsed == null ? null : parsed / 1000; }
function number(value: unknown): number | null { const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
