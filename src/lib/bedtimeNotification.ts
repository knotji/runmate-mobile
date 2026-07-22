import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const BEDTIME_NOTIFICATION_ID = 88102;

/**
 * Calculates bedtime notification hour and minute given a target wake time (in minutes from midnight)
 * and target sleep duration (in hours). Notification triggers 30 minutes before target bedtime.
 */
export function calculateBedtimeNotificationTime(
  wakeTimeMinutes: number,
  sleepDurationHours = 8,
  reminderLeadMinutes = 30,
): { hour: number; minute: number } {
  const targetSleepMinutes = sleepDurationHours * 60;
  const rawBedtimeMinutes = wakeTimeMinutes - targetSleepMinutes - reminderLeadMinutes;
  const normalizedMinutes = (rawBedtimeMinutes % (24 * 60) + (24 * 60)) % (24 * 60);

  return {
    hour: Math.floor(normalizedMinutes / 60),
    minute: normalizedMinutes % 60,
  };
}

export async function scheduleBedtimeNotification(
  wakeTimeMinutes: number,
  sleepDurationHours = 8,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const permissions = await LocalNotifications.requestPermissions();
    if (permissions.display !== 'granted') return false;

    const { hour, minute } = calculateBedtimeNotificationTime(wakeTimeMinutes, sleepDurationHours);

    await LocalNotifications.cancel({ notifications: [{ id: BEDTIME_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: BEDTIME_NOTIFICATION_ID,
          title: 'Bedtime Approaching',
          body: 'Your recommended sleep window starts in 30 minutes. Wind down for optimal recovery.',
          schedule: {
            on: {
              hour,
              minute,
            },
            repeats: true,
          },
          extra: { route: '/sleep-window' },
        },
      ],
    });

    return true;
  } catch (error) {
    console.warn('[notifications] Failed to schedule bedtime notification', error);
    return false;
  }
}

export async function cancelBedtimeNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: BEDTIME_NOTIFICATION_ID }] });
  } catch (error) {
    console.warn('[notifications] Failed to cancel bedtime notification', error);
  }
}
