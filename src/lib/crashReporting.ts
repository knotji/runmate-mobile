import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

function crashReportingSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/** Reports a non-fatal error to Firebase Crashlytics. Never throws. */
export async function reportCrash(error: Error, context?: string): Promise<void> {
  if (!crashReportingSupported()) return;
  try {
    await FirebaseCrashlytics.recordException({
      message: context ? `${context}: ${error.message}` : error.message,
    });
  } catch (reportingError) {
    console.warn('[crashReporting] Could not report exception to Crashlytics', reportingError);
  }
}
