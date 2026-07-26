import { describe, expect, it } from 'vitest';
import { daysBetween, endOfMonth, shiftMonths, startOfMonth, startOfWeek, weekdayIndex } from './date';

describe('startOfWeek', () => {
  it('returns the same date when it is already Sunday', () => {
    expect(startOfWeek('2026-07-19')).toBe('2026-07-19');
  });

  it('snaps back to the preceding Sunday for a mid-week date', () => {
    expect(startOfWeek('2026-07-22')).toBe('2026-07-19');
  });

  it('snaps back to the preceding Sunday for a Saturday', () => {
    expect(startOfWeek('2026-07-25')).toBe('2026-07-19');
  });

  it('handles a week that crosses a month boundary', () => {
    expect(startOfWeek('2026-08-01')).toBe('2026-07-26');
  });
});

describe('startOfMonth', () => {
  it('returns the 1st of the month for a mid-month date', () => {
    expect(startOfMonth('2026-07-26')).toBe('2026-07-01');
  });

  it('returns the same date when it is already the 1st', () => {
    expect(startOfMonth('2026-02-01')).toBe('2026-02-01');
  });

  it('handles December correctly', () => {
    expect(startOfMonth('2026-12-31')).toBe('2026-12-01');
  });
});

describe('daysBetween', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetween('2026-07-26', '2026-07-26')).toBe(0);
  });

  it('returns a positive count for a later date', () => {
    expect(daysBetween('2026-07-19', '2026-07-26')).toBe(7);
  });

  it('returns a negative count for an earlier date', () => {
    expect(daysBetween('2026-07-26', '2026-07-19')).toBe(-7);
  });
});

describe('weekdayIndex', () => {
  it('returns 0 for Sunday and 6 for Saturday', () => {
    expect(weekdayIndex('2026-07-19')).toBe(0);
    expect(weekdayIndex('2026-07-25')).toBe(6);
  });

  it('returns the correct index for a midweek date', () => {
    expect(weekdayIndex('2026-07-22')).toBe(3);
  });
});

describe('shiftMonths', () => {
  it('returns the same month start when shifting by 0', () => {
    expect(shiftMonths('2026-07-26', 0)).toBe('2026-07-01');
  });

  it('goes back one month across a year boundary', () => {
    expect(shiftMonths('2026-01-15', -1)).toBe('2025-12-01');
  });

  it('goes forward one month from a 31-day month', () => {
    expect(shiftMonths('2026-07-15', 1)).toBe('2026-08-01');
  });

  it('goes back multiple months', () => {
    expect(shiftMonths('2026-07-26', -3)).toBe('2026-04-01');
  });
});

describe('endOfMonth', () => {
  it('returns the last day of a 31-day month', () => {
    expect(endOfMonth('2026-07-05')).toBe('2026-07-31');
  });

  it('returns the last day of February in a non-leap year', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });

  it('returns the last day of December', () => {
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });
});
