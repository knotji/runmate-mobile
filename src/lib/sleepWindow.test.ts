import { describe, expect, it } from 'vitest';
import { formatClockMinutes, parseClockMinutes, sleepWindowForWake } from './sleepWindow';

describe('sleep window', () => {
  it('builds bedtime guidance backwards from wake time and sleep need', () => {
    const result = sleepWindowForWake(339, 420);
    expect(formatClockMinutes(result.asleepMinutes)).toBe('10:39 PM');
    expect(formatClockMinutes(result.idealInBedMinutes)).toBe('10:19 PM');
    expect(formatClockMinutes(result.windowStartMinutes)).toBe('10:09 PM');
    expect(formatClockMinutes(result.windowEndMinutes)).toBe('10:29 PM');
  });

  it('parses 12-hour clock values', () => {
    expect(parseClockMinutes('5:39 AM')).toBe(339);
    expect(parseClockMinutes('12:30 PM')).toBe(750);
  });
});
