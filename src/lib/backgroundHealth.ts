import { Capacitor, registerPlugin } from '@capacitor/core';
import type { HealthSample, Workout } from '@capgo/capacitor-health';

const MAX_PREPARED_AGE_MS = 90 * 60_000;

export type BackgroundHealthStatus = {
  available: boolean;
  authorized: boolean;
  enabled: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastCompletedAt: string | null;
  lastOutcome: 'success' | 'failed' | null;
  lastErrorCode: string | null;
  lastError: string | null;
  preparedAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  nextExpectedAt: string | null;
  workerState: string | null;
  backgroundRestricted: boolean;
  batteryOptimizationActive: boolean;
  recordCounts: BackgroundHealthRecordCounts;
};

export type BackgroundHealthRecordCounts = {
  sleep: number;
  workouts: number;
  heartRate: number;
  heartRateVariability: number;
  restingHeartRate: number;
  respiratoryRate: number;
  vo2Max: number;
};

export type BackgroundHealthTestResult = {
  outcome: 'success' | 'failed' | 'timeout';
  durationMs: number;
  status: BackgroundHealthStatus;
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
  runNow(): Promise<{ workId: string }>;
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

export async function runBackgroundHealthNow(): Promise<{ workId: string }> {
  return BackgroundHealth.runNow();
}

export async function runBackgroundHealthTest(timeoutMs = 45_000, pollIntervalMs = 750): Promise<BackgroundHealthTestResult> {
  const before = await BackgroundHealth.getStatus();
  const startedAt = Date.now();
  await runBackgroundHealthNow();
  let latest = await BackgroundHealth.getStatus();
  while (Date.now() - startedAt < timeoutMs) {
    const completedAt = Date.parse(latest.lastCompletedAt ?? '');
    if (latest.lastCompletedAt !== before.lastCompletedAt && Number.isFinite(completedAt) && completedAt >= startedAt - 1_000) {
      return {
        outcome: latest.lastOutcome === 'success' ? 'success' : 'failed',
        durationMs: Date.now() - startedAt,
        status: latest,
      };
    }
    await delay(pollIntervalMs);
    latest = await BackgroundHealth.getStatus();
  }
  return { outcome: 'timeout', durationMs: Date.now() - startedAt, status: latest };
}

export function describeBackgroundHealthIssue(status: BackgroundHealthStatus, now = Date.now()): string | null {
  if (!status.available) return 'This Android device does not support background Health Connect reads.';
  if (!status.authorized) return 'Background data access is not allowed. Update Health Connect permissions.';
  if (!status.enabled) return 'Background preparation is turned off.';
  if (status.backgroundRestricted) return 'Android is restricting RunMate in the background. Allow background activity in system settings.';
  if (status.lastErrorCode === 'background_access_missing' || status.lastErrorCode === 'permission_changed') {
    return 'Health Connect permission changed. Reconnect Background Preparation.';
  }
  if (status.lastError) return status.lastError;
  const nextExpectedAt = Date.parse(status.nextExpectedAt ?? '');
  if (Number.isFinite(nextExpectedAt) && now > nextExpectedAt + 30 * 60_000) {
    return 'Preparation is delayed. Battery optimization, force-stop, or Samsung Health export timing may be holding it back.';
  }
  if (!status.preparedAt) return 'Waiting for Android to prepare the first snapshot.';
  return null;
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
