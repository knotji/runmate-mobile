import { todayBangkokDateKey } from '@/lib/date';
import type { TrainingAdherence } from '@/lib/trainingAdherence';
import type { RaceResult } from '@/types/race';

export function adherenceStatusLabel(status: TrainingAdherence['days'][number]['status']): string {
  return ({ completed: 'Completed', modified: 'Adjusted', missed: 'Missed', upcoming: 'Upcoming', recovery: 'Support' })[status];
}

export function adherenceStatusDetail(status: TrainingAdherence['days'][number]['status']): string {
  if (status === 'missed') return 'No workout was logged for this day.';
  if (status === 'recovery') return 'Not Counted Toward Adherence';
  if (status === 'upcoming') return '';
  return 'Matched to the planned session.';
}

export function formatRaceDate(value: string): string {
  const date = new Date(`${value}T12:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(date);
}

export function shortDay(value: string): string {
  const thaiDays: Record<string, string> = {
    'อาทิตย์': 'SUN', 'วันอาทิตย์': 'SUN',
    'จันทร์': 'MON', 'วันจันทร์': 'MON',
    'อังคาร': 'TUE', 'วันอังคาร': 'TUE',
    'พุธ': 'WED', 'วันพุธ': 'WED',
    'พฤหัสบดี': 'THU', 'วันพฤหัสบดี': 'THU',
    'ศุกร์': 'FRI', 'วันศุกร์': 'FRI',
    'เสาร์': 'SAT', 'วันเสาร์': 'SAT',
  };
  const trimmed = value.trim();
  if (thaiDays[trimmed]) return thaiDays[trimmed];
  // A generated plan's `day` field is occasionally an ISO date ("2026-08-17")
  // instead of a weekday name (a Gemini formatting slip in generate-race-plan) —
  // naive truncation would show "202" for every row. Derive the real weekday
  // instead of blindly slicing when this shape shows up.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(`${trimmed.slice(0, 10)}T12:00:00+07:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(date).slice(0, 3).toUpperCase();
    }
  }
  const normalized = trimmed.slice(0, 3);
  return normalized ? normalized.toUpperCase() : 'DAY';
}

const WEEKDAY_SHORT_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/**
 * Consolidates 3 previously near-identical copies of this matcher (mobileRaceGoal.ts,
 * todayTrainingPlan.ts, weeklyPlanCalendar.ts) that all silently returned -1 ("no
 * match") for a date-shaped `day` value instead of deriving the real weekday — the
 * same root cause as shortDay()'s truncation bug, but for the *matching* logic that
 * places a workout into a Mon-Sun calendar grid (e.g. WeeklyPlanCalendarPage), not
 * just its display label. A single date-shaped `day` value used to make every day
 * of that grid come back unmatched, showing a false "No Active Race Plan" empty
 * state even though the Race Goal page's own list rendered the same plan fine.
 */
export function normalizeWeekdayLabel(value: string): number {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (/^(sun|sunday|อา\.|อาทิตย์|วันอาทิตย์)/i.test(trimmed)) return 0;
  if (/^(mon|monday|จ\.|จันทร์|วันจันทร์)/i.test(trimmed)) return 1;
  if (/^(tue|tuesday|อ\.|อังคาร|วันอังคาร)/i.test(trimmed)) return 2;
  if (/^(wed|wednesday|พ\.|พุธ|วันพุธ)/i.test(trimmed)) return 3;
  if (/^(thu|thursday|พฤ\.|พฤหัส|วันพฤหัส)/i.test(trimmed)) return 4;
  if (/^(fri|friday|ศ\.|ศุกร์|วันศุกร์)/i.test(trimmed)) return 5;
  if (/^(sat|saturday|ส\.|เสาร์|วันเสาร์)/i.test(trimmed)) return 6;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(`${trimmed.slice(0, 10)}T12:00:00+07:00`);
    if (!Number.isNaN(date.getTime())) {
      const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(date).slice(0, 3).toLowerCase();
      return WEEKDAY_SHORT_INDEX[short] ?? -1;
    }
  }
  return -1;
}

export function formatRaceResultDay(value: string | null): string {
  const date = parseRaceDate(value);
  return date ? String(date.getDate()).padStart(2, '0') : '—';
}

export function formatRaceResultMonth(value: string | null): string {
  const date = parseRaceDate(value);
  return date ? new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(date) : 'No Date';
}

export function parseRaceDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A race result's actualPace usually already carries its own unit (Health Connect
 * syncs it as e.g. "5:24/km" via samsungWorkoutSync.ts's formatPace()) — appending
 * "/km" unconditionally produced "5:24/km/km" on the Race History card. A manually
 * typed pace without a unit still gets one added.
 */
export function formatRacePace(value: string | null | undefined): string | null {
  if (!value) return null;
  return /\/(km|mi|100\s?m)$/i.test(value.trim()) ? value : `${value}/km`;
}

export function raceResultLabel(result: RaceResult['goalResult']): string {
  if (result === 'achieved') return 'Goal Achieved';
  if (result === 'missed') return 'Goal Missed';
  if (result === 'completed') return 'Completed';
  return 'Logged';
}

export function formatPlanUpdated(value: string | null | undefined): string {
  if (!value) return 'Update Date Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Update Date Unavailable';
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (dateKey === todayBangkokDateKey()) return 'Updated Today';
  return `Updated ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(date)}`;
}
