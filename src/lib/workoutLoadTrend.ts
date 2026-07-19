import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutDetail } from '@/lib/workoutDetail';

export type WorkoutLoadDay = {
  date: string;
  load: number | null;
  sessions: number;
  measuredSessions: number;
};

export type WorkoutLoadTrend = {
  days: WorkoutLoadDay[];
  total: number | null;
  previousTotal: number | null;
  changePercentage: number | null;
  status: 'Starting Point' | 'Easing' | 'Stable' | 'Building' | 'Rising Quickly';
  sessions: number;
  measuredSessions: number;
};

export function buildWorkoutLoadTrend(input: {
  items: LocalHistoryItem[];
  todayDate: string;
  maxHr: number | null;
  restingHr: number | null;
}): WorkoutLoadTrend {
  const currentStart = shiftDate(input.todayDate, -6);
  const previousStart = shiftDate(input.todayDate, -13);
  const previousEnd = shiftDate(input.todayDate, -7);
  const relevant = input.items.filter((item) => {
    const date = getHistoryItemDateKey(item);
    return date >= previousStart && date <= input.todayDate;
  });
  const scored = relevant.map((item) => ({
    date: getHistoryItemDateKey(item),
    load: input.maxHr != null && input.restingHr != null
      ? buildWorkoutDetail(item, { maxHr: input.maxHr, restingHr: input.restingHr }).heartRateZones?.load?.score ?? null
      : null,
  }));
  const days = dateRange(currentStart, input.todayDate).map((date) => summarizeDay(date, scored));
  const previousDays = dateRange(previousStart, previousEnd).map((date) => summarizeDay(date, scored));
  const total = sumMeasured(days);
  const previousTotal = sumMeasured(previousDays);
  const changePercentage = total != null && previousTotal != null && previousTotal > 0
    ? Math.round(((total - previousTotal) / previousTotal) * 100)
    : null;

  return {
    days,
    total,
    previousTotal,
    changePercentage,
    status: trendStatus(changePercentage),
    sessions: days.reduce((sum, day) => sum + day.sessions, 0),
    measuredSessions: days.reduce((sum, day) => sum + day.measuredSessions, 0),
  };
}

function summarizeDay(date: string, scored: Array<{ date: string; load: number | null }>): WorkoutLoadDay {
  const sessions = scored.filter((item) => item.date === date);
  const measured = sessions.filter((item): item is { date: string; load: number } => item.load != null);
  return {
    date,
    load: measured.length ? measured.reduce((sum, item) => sum + item.load, 0) : null,
    sessions: sessions.length,
    measuredSessions: measured.length,
  };
}

function sumMeasured(days: WorkoutLoadDay[]): number | null {
  const measured = days.filter((day): day is WorkoutLoadDay & { load: number } => day.load != null);
  return measured.length ? measured.reduce((sum, day) => sum + day.load, 0) : null;
}

function trendStatus(change: number | null): WorkoutLoadTrend['status'] {
  if (change == null) return 'Starting Point';
  if (change <= -15) return 'Easing';
  if (change < 15) return 'Stable';
  if (change < 30) return 'Building';
  return 'Rising Quickly';
}

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date);
  return dates;
}

function shiftDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
