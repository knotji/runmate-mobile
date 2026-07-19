import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample, SleepStage } from '@capgo/capacitor-health';
import { loadHistoryItems, saveHistoryItems } from '@/lib/cloudHistory';
import { classifyHealthSyncItems, type HealthSyncCounts } from '@/lib/healthSyncSummary';
import { getBangkokDateKey, todayBangkokDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';

const SAMSUNG_HEALTH_SOURCE_ID = 'com.sec.android.app.shealth';
const DEFAULT_LOOKBACK_DAYS = 30;
const LAST_SYNC_KEY = 'runmate:samsung-sleep-last-synced-at';
const SIGNAL_TYPES = ['heartRateVariability', 'restingHeartRate', 'respiratoryRate'] as const;

type SamsungSleepSignals = {
  heartRateVariability: HealthSample[];
  restingHeartRate: HealthSample[];
  respiratoryRate: HealthSample[];
};

export type SamsungSleepSyncResult = HealthSyncCounts & {
  status: 'synced' | 'unavailable' | 'permission_required';
  imported: number;
  error?: string;
};

let activeSync: Promise<SamsungSleepSyncResult> | null = null;

export function syncSamsungSleep(lookbackDays: number | 'today' = DEFAULT_LOOKBACK_DAYS): Promise<SamsungSleepSyncResult> {
  if (activeSync) return activeSync;
  activeSync = runSamsungSleepSync(lookbackDays).finally(() => { activeSync = null; });
  return activeSync;
}

async function runSamsungSleepSync(lookbackDays: number | 'today'): Promise<SamsungSleepSyncResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return emptyResult('unavailable');
  }

  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return emptyResult('unavailable');

    const authorization = await Health.checkAuthorization({ read: ['sleep', ...SIGNAL_TYPES] });
    if (!authorization.readAuthorized.includes('sleep')) {
      return emptyResult('permission_required');
    }

    const todayOnly = lookbackDays === 'today';
    const today = todayBangkokDateKey();
    const endDate = new Date().toISOString();
    // Start at noon on the previous Bangkok day so an overnight session that
    // began yesterday but woke today remains visible to Health Connect.
    const startDate = todayOnly
      ? new Date(Date.parse(`${today}T00:00:00+07:00`) - 12 * 60 * 60_000).toISOString()
      : new Date(Date.now() - Math.max(1, lookbackDays) * 86_400_000).toISOString();
    const result = await Health.readSamples({
      dataType: 'sleep',
      startDate,
      endDate,
      ascending: true,
      limit: 100,
    });
    const signals = await readAuthorizedSignals(authorization.readAuthorized, startDate, endDate);
    const items = result.samples
      .filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID)
      .map((sample) => mapSamsungSleepSample(sample, signals))
      .filter((item): item is LocalHistoryItem => item !== null)
      .filter((item) => !todayOnly || item.dateKey === today);

    const existing = await loadHistoryItems(['sleep']);
    const counts = classifyHealthSyncItems(items, existing.ok ? existing.items : []);
    if (!items.length) {
      recordSuccessfulSync();
      return { status: 'synced', imported: 0, ...counts };
    }
    const saved = await saveHistoryItems(items);
    if (!saved.ok) return { status: 'synced', imported: 0, added: 0, updated: 0, unchanged: 0, failed: items.length, error: saved.error };
    recordSuccessfulSync();
    return { status: 'synced', imported: items.length, ...counts };
  } catch (error) {
    return {
      status: 'unavailable',
      imported: 0, added: 0, updated: 0, unchanged: 0, failed: 0,
      error: error instanceof Error ? error.message : 'Samsung Health sleep sync failed.',
    };
  }
}

function emptyResult(status: SamsungSleepSyncResult['status']): SamsungSleepSyncResult {
  return { status, imported: 0, added: 0, updated: 0, unchanged: 0, failed: 0 };
}

export function getSamsungSleepLastSyncedAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function recordSuccessfulSync(): void {
  try {
    window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch {
    // Sync remains successful when local display metadata cannot be persisted.
  }
}

export function mapSamsungSleepSample(sample: HealthSample, signals?: SamsungSleepSignals): LocalHistoryItem | null {
  const startMs = Date.parse(sample.startDate);
  const endMs = Date.parse(sample.endDate);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;

  const stageMinutes = summarizeStages(sample.stages ?? []);
  const elapsedMinutes = Math.round((endMs - startMs) / 60_000);
  const stagedSleepMinutes = stageMinutes.rem + stageMinutes.light + stageMinutes.deep;
  const asleepMinutes = sumStages(sample.stages ?? [], 'asleep');
  const measuredMinutes = stagedSleepMinutes || asleepMinutes || positiveMinutes(sample.value) || elapsedMinutes;
  const actualSleepDurationMinutes = Math.min(measuredMinutes, elapsedMinutes);
  // RunMate attributes an overnight sleep session to the day the user wakes.
  // This is the date used by today's Recovery/Activity views and lets a
  // Samsung session reconcile with a screenshot uploaded for that morning.
  const dateKey = getBangkokDateKey(sample.endDate);
  const platformKey = sample.platformId?.trim() || `${sample.startDate}|${sample.endDate}`;
  const hrv = averageSignal(inSleepWindow(signals?.heartRateVariability ?? [], startMs, endMs));
  const respiratoryRate = averageSignal(inSleepWindow(signals?.respiratoryRate ?? [], startMs, endMs));
  const restingHeartRate = nearestSignal(signals?.restingHeartRate ?? [], endMs, 12 * 60 * 60 * 1000);

  return {
    id: `healthconnect-samsung-sleep-${stableKey(platformKey)}`,
    type: 'sleep',
    createdAt: sample.endDate,
    recordedAt: sample.endDate,
    dateKey,
    source: {
      provider: 'samsung_health',
      importType: 'health_connect',
      detectedFormat: 'Health Connect Sleep',
      importedAt: new Date().toISOString(),
    },
    data: {
      extracted: {
        date: dateKey,
        sleepDuration: formatMinutes(actualSleepDurationMinutes),
        actualSleepDurationMinutes,
        actualSleepDurationText: formatMinutes(actualSleepDurationMinutes),
        timeInBedMinutes: elapsedMinutes,
        timeInBedText: formatMinutes(elapsedMinutes),
        timeInBedDerived: false,
        sleepStartTime: sample.startDate,
        sleepEndTime: sample.endDate,
        sleepStageAwakeMinutes: stageOrNull(stageMinutes.awake),
        sleepStageRemMinutes: stageOrNull(stageMinutes.rem),
        sleepStageLightMinutes: stageOrNull(stageMinutes.light),
        sleepStageDeepMinutes: stageOrNull(stageMinutes.deep),
        sleepStageMinutes: hasSpecificStages(stageMinutes) ? {
          awake: stageMinutes.awake,
          rem: stageMinutes.rem,
          light: stageMinutes.light,
          deep: stageMinutes.deep,
        } : null,
        sleepDurationSource: 'actual',
        avgSleepingHrv: hrv,
        avgRespiratoryRate: respiratoryRate,
        sleepScore: null,
        energyScore: null,
        restingHR: restingHeartRate,
        hrv,
        sleepQualityLabel: null,
        visibleNotes: null,
      },
      confidence: 'high',
      unclearFields: [],
      sourceId: sample.sourceId,
      sourceName: sample.sourceName,
      platformId: sample.platformId,
      healthConnect: {
        value: sample.value,
        unit: sample.unit,
        hasStageData: sample.hasStageData === true,
      },
    },
  };
}

async function readAuthorizedSignals(authorized: string[], startDate: string, endDate: string): Promise<SamsungSleepSignals> {
  const read = async (dataType: typeof SIGNAL_TYPES[number]) => {
    if (!authorized.includes(dataType)) return [];
    const result = await Health.readSamples({ dataType, startDate, endDate, ascending: true, limit: 500 });
    return result.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
  };
  const [heartRateVariability, restingHeartRate, respiratoryRate] = await Promise.all([
    read('heartRateVariability'),
    read('restingHeartRate'),
    read('respiratoryRate'),
  ]);
  return { heartRateVariability, restingHeartRate, respiratoryRate };
}

function inSleepWindow(samples: HealthSample[], startMs: number, endMs: number): HealthSample[] {
  return samples.filter((sample) => {
    const sampleMs = Date.parse(sample.startDate);
    return Number.isFinite(sampleMs) && sampleMs >= startMs && sampleMs <= endMs;
  });
}

function averageSignal(samples: HealthSample[]): number | null {
  const values = samples.map((sample) => sample.value).filter((value) => Number.isFinite(value) && value > 0);
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
}

function nearestSignal(samples: HealthSample[], targetMs: number, maximumDistanceMs: number): number | null {
  const candidates = samples
    .map((sample) => ({ value: sample.value, distance: Math.abs(Date.parse(sample.startDate) - targetMs) }))
    .filter(({ value, distance }) => Number.isFinite(value) && value > 0 && Number.isFinite(distance) && distance <= maximumDistanceMs)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.value ?? null;
}

function summarizeStages(stages: SleepStage[]) {
  return {
    awake: sumStages(stages, 'awake'),
    rem: sumStages(stages, 'rem'),
    light: sumStages(stages, 'light'),
    deep: sumStages(stages, 'deep'),
  };
}

function sumStages(stages: SleepStage[], target: SleepStage['stage']): number {
  return Math.round(stages
    .filter((stage) => stage.stage === target && Number.isFinite(stage.durationMinutes))
    .reduce((sum, stage) => sum + Math.max(0, stage.durationMinutes), 0));
}

function hasSpecificStages(stages: ReturnType<typeof summarizeStages>): boolean {
  return stages.awake + stages.rem + stages.light + stages.deep > 0;
}

function positiveMinutes(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function stageOrNull(value: number): number | null {
  return value > 0 ? value : null;
}

function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
