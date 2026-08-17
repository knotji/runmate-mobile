import { loadActivityStartupEntry } from './activityStartupCache';
import { getPersistedTodaySyncAt } from './healthSyncMetadata';
import { loadNutritionTrendsStartupSnapshot } from './nutritionTrendsStartupCache';
import { loadPainTrendsStartupSnapshot } from './painTrendsStartupCache';
import { loadRecoveryStartupEntry } from './recoveryStartupCache';
import { loadRecoveryTrendsStartupSnapshot } from './recoveryTrendsStartupCache';

export type HealthHubStatusTone = 'current' | 'attention' | 'empty';
export type HealthHubStatus = { label: string; tone: HealthHubStatusTone };
export type HealthHubSnapshot = Record<
  'calendar' | 'recoveryTrends' | 'sleep' | 'strain' | 'nutrition' | 'pain' | 'healthConnect',
  HealthHubStatus
>;

export function buildHealthHubSnapshot(now: Date | string | number = Date.now()): HealthHubSnapshot {
  const nowMs = new Date(now).getTime();
  const recoveryEntry = loadRecoveryStartupEntry(now);
  const activityEntry = loadActivityStartupEntry(now);
  const recoveryTrends = loadRecoveryTrendsStartupSnapshot(now);
  const nutrition = loadNutritionTrendsStartupSnapshot(now);
  const pain = loadPainTrendsStartupSnapshot(now);
  const sleepMinutes = recoveryEntry?.recovery.sleepPerformance.actualSleepMinutes ?? null;
  const syncAt = getPersistedTodaySyncAt();
  const syncAgeMs = syncAt > 0 ? nowMs - syncAt : Number.POSITIVE_INFINITY;

  return {
    calendar: activityEntry ? current(`${activityEntry.items.length} records today`) : empty('Open to review'),
    recoveryTrends: recoveryTrends
      ? current(`${recoveryTrends.thirtyDay.calibration.baselineNights}/14 baseline nights`)
      : empty('Open to calculate'),
    sleep: sleepMinutes != null ? current(`${formatMinutes(sleepMinutes)} last night`) : empty('No recent sleep snapshot'),
    strain: recoveryEntry ? current(`${formatStrain(recoveryEntry.recovery.strain.score)}/21 today`) : empty('No current strain snapshot'),
    nutrition: nutrition ? current(`${nutrition.sevenDay.loggedDays}/7 days logged`) : empty('No recent nutrition summary'),
    pain: pain
      ? pain.thirtyDay.hasActivePain
        ? attention('Active report logged')
        : current(pain.thirtyDay.logs.length ? `${pain.thirtyDay.logs.length} reports in 30 days` : 'No pain logged')
      : empty('No recent pain summary'),
    healthConnect: !Number.isFinite(syncAgeMs)
      ? empty('Not synced on this device')
      : syncAgeMs <= 6 * 60 * 60 * 1000
        ? current(`Synced ${formatRelativeAge(syncAgeMs)}`)
        : attention(`Last sync ${formatRelativeAge(syncAgeMs)}`),
  };
}

const current = (label: string): HealthHubStatus => ({ label, tone: 'current' });
const attention = (label: string): HealthHubStatus => ({ label, tone: 'attention' });
const empty = (label: string): HealthHubStatus => ({ label, tone: 'empty' });

function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatStrain(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

function formatRelativeAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'recently';
  const minutes = Math.max(0, Math.round(ageMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
