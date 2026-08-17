import { describe, expect, it } from 'vitest';
import { formatRacePace, normalizeWeekdayLabel, shortDay } from '@/lib/raceGoalFormatting';

describe('shortDay', () => {
  it('abbreviates an English weekday name', () => {
    expect(shortDay('Sunday')).toBe('SUN');
    expect(shortDay('Wednesday')).toBe('WED');
  });

  it('translates a Thai weekday name', () => {
    expect(shortDay('วันอาทิตย์')).toBe('SUN');
    expect(shortDay('พฤหัสบดี')).toBe('THU');
  });

  it('derives the real weekday from an ISO date instead of truncating it (regression: generate-race-plan can return a date in the day field)', () => {
    // 2026-08-17 is a Monday.
    expect(shortDay('2026-08-17')).toBe('MON');
    expect(shortDay('2026-08-17T00:00:00+07:00')).toBe('MON');
  });

  it('falls back to truncation for anything else', () => {
    expect(shortDay('Someday')).toBe('SOM');
    expect(shortDay('')).toBe('DAY');
  });
});

describe('normalizeWeekdayLabel', () => {
  it('matches English and Thai weekday names', () => {
    expect(normalizeWeekdayLabel('Sunday')).toBe(0);
    expect(normalizeWeekdayLabel('Wed')).toBe(3);
    expect(normalizeWeekdayLabel('วันเสาร์')).toBe(6);
  });

  it('derives the weekday index from an ISO date instead of returning "no match" (regression: this previously broke WeeklyPlanCalendarPage\'s Mon-Sun grid matching for every day at once)', () => {
    expect(normalizeWeekdayLabel('2026-08-17')).toBe(1); // Monday
    expect(normalizeWeekdayLabel('2026-08-16')).toBe(0); // Sunday
  });

  it('returns -1 for anything unrecognized', () => {
    expect(normalizeWeekdayLabel('Someday')).toBe(-1);
    expect(normalizeWeekdayLabel('')).toBe(-1);
  });
});

describe('formatRacePace', () => {
  it('adds /km to a bare pace value', () => {
    expect(formatRacePace('5:24')).toBe('5:24/km');
  });

  it('does not double up a unit the value already carries (regression: Health Connect syncs pace pre-formatted as "5:24/km")', () => {
    expect(formatRacePace('5:24/km')).toBe('5:24/km');
    expect(formatRacePace('1:45/100m')).toBe('1:45/100m');
    expect(formatRacePace('8:12/mi')).toBe('8:12/mi');
  });

  it('returns null for a missing value', () => {
    expect(formatRacePace(null)).toBeNull();
  });
});
