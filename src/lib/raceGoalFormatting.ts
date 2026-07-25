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
  const normalized = trimmed.slice(0, 3);
  return normalized ? normalized.toUpperCase() : 'DAY';
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
