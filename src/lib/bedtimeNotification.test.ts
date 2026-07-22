import { describe, expect, it } from 'vitest';
import { calculateBedtimeNotificationTime } from './bedtimeNotification';

describe('calculateBedtimeNotificationTime', () => {
  it('calculates bedtime notification time 30 mins before 8h sleep target for 07:00 wake time', () => {
    // Wake time 07:00 = 7 * 60 = 420 minutes
    // Bedtime = 07:00 - 8h = 23:00 (1380 mins)
    // Notification = 23:00 - 30 mins = 22:30 (1350 mins)
    const result = calculateBedtimeNotificationTime(420, 8, 30);
    expect(result).toEqual({ hour: 22, minute: 30 });
  });

  it('normalizes midnight wraparound correctly', () => {
    // Wake time 06:00 = 360 minutes
    // Bedtime = 06:00 - 8h = 22:00
    // Notification = 22:00 - 30 mins = 21:30
    const result = calculateBedtimeNotificationTime(360, 8, 30);
    expect(result).toEqual({ hour: 21, minute: 30 });
  });
});
