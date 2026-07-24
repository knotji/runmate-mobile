import type { CoachContext, DayWorkoutSummary } from '@/lib/buildCoachContext';
import { getTodayTrainingPlanStatus, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import type { RacePlan, WeekWorkout } from '@/types/race';

export type CalendarDayStatus = 'rest' | 'completed' | 'missed' | 'today_pending' | 'today_completed' | 'today_logged_different' | 'upcoming' | 'no_plan';

export type WeeklyCalendarDay = {
  date: string;
  weekdayLabel: string;
  isToday: boolean;
  isPast: boolean;
  planned: WeekWorkout | null;
  status: CalendarDayStatus;
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** This week's plan (Monday-Sunday, Bangkok time) alongside each day's actual outcome. */
export function buildWeeklyPlanCalendar(context: CoachContext): WeeklyCalendarDay[] {
  const plan = context.racePlan as RacePlan | null;
  const weeklyPlan = plan && Array.isArray(plan.weeklyPlan) ? plan.weeklyPlan : [];
  const monday = mondayOfWeek(context.todayDate);
  const workoutsByDate = new Map(context.workouts7d.map((day) => [day.date, day]));

  const days: WeeklyCalendarDay[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = shiftDate(monday, offset);
    const weekdayIndex = weekdayIndexForDate(date);
    const planned = weeklyPlan.find((workout) => normalizeWeekdayLabel(workout.day) === weekdayIndex) ?? null;
    const isToday = date === context.todayDate;
    const isPast = date < context.todayDate;

    days.push({
      date,
      weekdayLabel: WEEKDAY_SHORT[weekdayIndex],
      isToday,
      isPast,
      planned,
      status: dayStatus({ planned, isToday, isPast, date, context, workoutDay: workoutsByDate.get(date) }),
    });
  }
  return days;
}

function dayStatus(input: {
  planned: WeekWorkout | null;
  isToday: boolean;
  isPast: boolean;
  date: string;
  context: CoachContext;
  workoutDay: DayWorkoutSummary | undefined;
}): CalendarDayStatus {
  const { planned, isToday, isPast, context, workoutDay } = input;
  if (!planned) return 'no_plan';
  if (isRestDayWorkout(planned)) return 'rest';

  if (isToday) {
    const todayStatus = getTodayTrainingPlanStatus(context, planned);
    return todayStatus === 'completed' ? 'today_completed' : todayStatus === 'logged_different' ? 'today_logged_different' : 'today_pending';
  }

  if (!isPast) return 'upcoming';

  const hasLoggedActivity = Boolean(workoutDay && (workoutDay.runs.length > 0 || workoutDay.walks.length > 0 || workoutDay.other.length > 0));
  return hasLoggedActivity ? 'completed' : 'missed';
}

function mondayOfWeek(dateKey: string): string {
  const weekday = weekdayIndexForDate(dateKey);
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1;
  return shiftDate(dateKey, -offsetFromMonday);
}

function weekdayIndexForDate(dateKey: string): number {
  const parsed = new Date(`${dateKey}T12:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getDay();
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeWeekdayLabel(day: string): number {
  const value = (day ?? '').trim().toLowerCase();
  if (/^(sun|sunday|อา\.|อาทิตย์|วันอาทิตย์)/i.test(value)) return 0;
  if (/^(mon|monday|จ\.|จันทร์|วันจันทร์)/i.test(value)) return 1;
  if (/^(tue|tuesday|อ\.|อังคาร|วันอังคาร)/i.test(value)) return 2;
  if (/^(wed|wednesday|พ\.|พุธ|วันพุธ)/i.test(value)) return 3;
  if (/^(thu|thursday|พฤ\.|พฤหัส|วันพฤหัส)/i.test(value)) return 4;
  if (/^(fri|friday|ศ\.|ศุกร์|วันศุกร์)/i.test(value)) return 5;
  if (/^(sat|saturday|ส\.|เสาร์|วันเสาร์)/i.test(value)) return 6;
  return -1;
}
