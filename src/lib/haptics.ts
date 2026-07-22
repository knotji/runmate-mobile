import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function hapticImpact(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style });
  } catch {
    // Ignore non-native or unsupported browser errors
  }
}

export async function hapticSelection(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.selectionStart();
  } catch {
    // Ignore errors
  }
}

export async function hapticNotification(type: NotificationType = NotificationType.Success): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type });
  } catch {
    // Ignore errors
  }
}
