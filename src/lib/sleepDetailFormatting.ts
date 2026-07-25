import type { WeekSleepRow } from '@/lib/buildCoachContext';

export function formatMinutes(value: number): string {
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}

export function formatOptionalMinutes(value: number | null | undefined): string {
  return value == null ? '—' : formatMinutes(value);
}

export function formatScore(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value)}`;
}

export function formatEfficiency(night: WeekSleepRow | null): string {
  if (!night?.durationMinutes || !night.timeInBedMinutes) return '—';
  return `${Math.min(100, Math.round((night.durationMinutes / night.timeInBedMinutes) * 100))}%`;
}

export function formatDisplayDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

export function formatSleepTime(value: number): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

export function formatImportedAt(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not Available';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

export function toSleepScoreNight(night: WeekSleepRow) {
  return {
    durationMinutes: night.durationMinutes,
    timeInBedMinutes: night.timeInBedMinutes,
    sleepStartTime: night.sleepStartTime,
    sleepEndTime: night.sleepEndTime,
    remMinutes: night.remMinutes,
    lightMinutes: night.lightMinutes,
    deepMinutes: night.deepMinutes,
  };
}
