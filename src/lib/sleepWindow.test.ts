import { describe, expect, it } from 'vitest';
import { bedtimeReminderMinutes, clearTonightSleepCycleOverride, formatClockMinutes, loadTonightSleepCycleOverride, parseClockMinutes, recommendedSleepCycleCount, saveTonightSleepCycleOverride, sleepCyclePlanForWake, sleepWindowForWake, tonightDateKey } from './sleepWindow';

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

  it('schedules the reminder one hour before sleep across midnight', () => {
    expect(bedtimeReminderMinutes(30)).toBe(1410);
    expect(bedtimeReminderMinutes(1380)).toBe(1320);
    const window = sleepWindowForWake(390, 420);
    expect(formatClockMinutes(window.idealInBedMinutes)).toBe('11:10 PM');
    expect(formatClockMinutes(bedtimeReminderMinutes(window.idealInBedMinutes))).toBe('10:10 PM');
  });

  it('recommends the first selectable cycle count that covers Sleep Need', () => {
    expect(recommendedSleepCycleCount(420)).toBe(5);
    expect(recommendedSleepCycleCount(540)).toBe(6);
  });

  it('builds an estimated cycle plan and compares it with Sleep Need', () => {
    const plan = sleepCyclePlanForWake(360, 5, 420);
    expect(formatClockMinutes(plan.inBedMinutes)).toBe('10:10 PM');
    expect(formatClockMinutes(plan.asleepMinutes)).toBe('10:30 PM');
    expect(plan.sleepMinutes).toBe(450);
    expect(plan.differenceMinutes).toBe(30);
    expect(plan.adequacy).toBe('meets');
  });

  it('stores an applied cycle plan for tonight only', () => {
    saveTonightSleepCycleOverride(5);
    expect(loadTonightSleepCycleOverride()).toBe(5);
    expect(localStorage.getItem(`runmate:sleep-window-cycle:${tonightDateKey()}`)).toBe('5');
    clearTonightSleepCycleOverride();
    expect(loadTonightSleepCycleOverride()).toBeNull();
  });
});
