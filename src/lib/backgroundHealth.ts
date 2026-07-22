import { Capacitor, registerPlugin } from '@capacitor/core';
import type { HealthSample, Workout } from '@capgo/capacitor-health';

const MAX_PREPARED_AGE_MS = 90 * 60_000;

export type BackgroundHealthStatus = {
  available: boolean;
  authorized: boolean;
  enabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  preparedAt: string | null;
};

export type PreparedHealthSnapshot = {
  capturedAt: string;
  windowStart: string;
  windowEnd: string;
  sleep?: { samples: HealthSample[] };
  heartRate?: { samples: HealthSample[] };
  heartRateVariability?: { samples: HealthSample[] };
  restingHeartRate?: { samples: HealthSample[] };
  respiratoryRate?: { samples: HealthSample[] };
  vo2Max?: { samples: HealthSample[] };
  workouts?: { workouts: Workout[]; anchor?: string };
};

interface BackgroundHealthNativePlugin {
  getStatus(): Promise<BackgroundHealthStatus>;
  requestAccess(): Promise<BackgroundHealthStatus>;
  setEnabled(options: { enabled: boolean }): Promise<BackgroundHealthStatus>;
  runNow(): Promise<void>;
  getPreparedSnapshot(): Promise<{ snapshot: PreparedHealthSnapshot | null }>;
}

const BackgroundHealth = registerPlugin<BackgroundHealthNativePlugin>('BackgroundHealth');

export function backgroundHealthSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getBackgroundHealthStatus(): Promise<BackgroundHealthStatus | null> {
  if (!backgroundHealthSupported()) return null;
  return BackgroundHealth.getStatus();
}

export async function requestBackgroundHealthAccess(): Promise<BackgroundHealthStatus> {
  return BackgroundHealth.requestAccess();
}

export async function setBackgroundHealthEnabled(enabled: boolean): Promise<BackgroundHealthStatus> {
  return BackgroundHealth.setEnabled({ enabled });
}

export async function runBackgroundHealthNow(): Promise<void> {
  return BackgroundHealth.runNow();
}

export async function getFreshPreparedHealthSnapshot(now = Date.now()): Promise<PreparedHealthSnapshot | null> {
  if (!backgroundHealthSupported()) return null;
  try {
    const { snapshot } = await BackgroundHealth.getPreparedSnapshot();
    if (!snapshot || !isPreparedHealthSnapshotFresh(snapshot, now)) return null;
    return snapshot;
  } catch {
    return null;
  }
}

export function isPreparedHealthSnapshotFresh(snapshot: Pick<PreparedHealthSnapshot, 'capturedAt'>, now = Date.now()): boolean {
  const capturedAt = Date.parse(snapshot.capturedAt);
  return Number.isFinite(capturedAt) && now - capturedAt >= 0 && now - capturedAt <= MAX_PREPARED_AGE_MS;
}
