import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample, SleepStage } from '@capgo/capacitor-health';
import { loadHistoryItems, saveHistoryItems } from '@/lib/cloudHistory';
import { classifyHealthSyncItems, selectChangedHealthSyncItems, type HealthSyncCounts } from '@/lib/healthSyncSummary';
import { getBangkokDateKey, todayBangkokDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { acknowledgeBackgroundHealthRecords, backgroundHealthRecordKey, getFreshPreparedHealthSnapshot, type PreparedHealthSnapshot } from '@/lib/backgroundHealth';
import { formatReconciliationSyncError, isReconciliationPermissionError } from '@/lib/reconciliationPolicy';
import { createLastSyncedAtStore, stableKey } from '@/lib/healthSyncHelpers';

const SAMSUNG_HEALTH_SOURCE_ID = 'com.sec.android.app.shealth';
const DEFAULT_LOOKBACK_DAYS = 30;
const EXISTING_RECORD_BUFFER_DAYS = 2;
const EXISTING_RECORD_LIMIT = 500;
const lastSyncedAt = createLastSyncedAtStore('runmate:samsung-sleep-last-synced-at');
const SIGNAL_TYPES = ['heartRateVariability', 'restingHeartRate', 'respiratoryRate'] as const;
const SLEEP_HR_SAMPLE_SUPPORT_MS = 10 * 60_000;
const MIN_SLEEP_HR_SAMPLES = 6;
const MIN_SLEEP_HR_COVERAGE_PERCENT = 50;
const MAX_SLEEP_HR_TIMELINE_POINTS = 360;

type SamsungSleepSignals = {
  heartRateVariability: HealthSample[];
  restingHeartRate: HealthSample[];
  respiratoryRate: HealthSample[];
  heartRate: HealthSample[];
};

type SleepHeartRateEstimate = {
  average: number;
  resting: number;
  lowest: number;
  sampleCount: number;
  coveragePercent: number;
};

export type SamsungSleepSyncResult = HealthSyncCounts & {
  status: 'synced' | 'unavailable' | 'permission_required';
  imported: number;
  dataSource: 'prepared' | 'live' | 'none';
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

  let dataSource: SamsungSleepSyncResult['dataSource'] = 'live';
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return emptyResult('unavailable');

    const authorization = await Health.checkAuthorization({ read: ['sleep', ...SIGNAL_TYPES, 'heartRate'] });
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
    const prepared = todayOnly ? await getFreshPreparedHealthSnapshot() : null;
    const preparedSleep = prepared?.sleep?.samples.filter((sample) => getBangkokDateKey(sample.endDate) === today) ?? [];
    const usePrepared = preparedSleep.length > 0;
    dataSource = usePrepared ? 'prepared' : 'live';
    const result = usePrepared
      ? { samples: preparedSleep }
      : await Health.readSamples({ dataType: 'sleep', startDate, endDate, ascending: true, limit: 100 });
    const signals = await readAuthorizedSignals(authorization.readAuthorized, startDate, endDate, usePrepared ? prepared : null);
    const samsungSamples = result.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
    const mappedItems: Array<LocalHistoryItem | null> = [];
    // Query high-volume HR records per Sleep Window. A single 30-day read can
    // exceed Health Connect's page limit and silently omit the latest nights.
    for (let index = 0; index < samsungSamples.length; index += 4) {
      const batch = await Promise.all(samsungSamples.slice(index, index + 4).map(async (sample) => {
        const heartRate = usePrepared
          ? inSleepWindow(prepared?.heartRate?.samples ?? [], Date.parse(sample.startDate), Date.parse(sample.endDate))
              .filter((point) => point.sourceId === SAMSUNG_HEALTH_SOURCE_ID)
          : await readSleepHeartRate(authorization.readAuthorized, sample);
        return mapSamsungSleepSample(sample, { ...signals, heartRate });
      }));
      mappedItems.push(...batch);
    }
    const items = mappedItems
      .filter((item): item is LocalHistoryItem => item !== null)
      .filter((item) => !todayOnly || item.dateKey === today);

    const existing = await loadHistoryItems(['sleep'], {
      createdAfter: new Date(Date.parse(startDate) - EXISTING_RECORD_BUFFER_DAYS * 86_400_000).toISOString(),
      limit: EXISTING_RECORD_LIMIT,
    });
    const existingItems = existing.ok ? existing.items : [];
    const counts = classifyHealthSyncItems(items, existingItems);
    const changedItems = selectChangedHealthSyncItems(items, existingItems);
    if (!changedItems.length) {
      recordSuccessfulSync();
      await acknowledgeBackgroundHealthRecords({ sleepKeys: samsungSamples.map(backgroundHealthRecordKey) });
      return { status: 'synced', imported: items.length, dataSource, ...counts };
    }
    const saved = await saveHistoryItems(changedItems);
    if (!saved.ok) return { status: 'synced', imported: 0, dataSource, added: 0, updated: 0, unchanged: 0, failed: changedItems.length, error: saved.error };
    recordSuccessfulSync();
    await acknowledgeBackgroundHealthRecords({ sleepKeys: samsungSamples.map(backgroundHealthRecordKey) });
    return { status: 'synced', imported: items.length, dataSource, ...counts };
  } catch (error) {
    const isPermissionError = isReconciliationPermissionError(error);
    return {
      status: isPermissionError ? 'permission_required' : 'unavailable',
      dataSource,
      imported: 0, added: 0, updated: 0, unchanged: 0, failed: 0,
      error: formatReconciliationSyncError(error, 'Samsung Health sleep sync failed.'),
    };
  }
}

function emptyResult(status: SamsungSleepSyncResult['status']): SamsungSleepSyncResult {
  return { status, imported: 0, dataSource: 'none', added: 0, updated: 0, unchanged: 0, failed: 0 };
}

export function getSamsungSleepLastSyncedAt(): string | null {
  return lastSyncedAt.get();
}

function recordSuccessfulSync(): void {
  lastSyncedAt.recordNow();
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
  const measuredRestingHeartRate = nearestSignal(signals?.restingHeartRate ?? [], endMs, 12 * 60 * 60 * 1000);
  const sleepHeartRate = estimateSleepHeartRate(signals?.heartRate ?? [], startMs, endMs);
  const sleepHeartRateTimeline = sleepHeartRate ? buildSleepHeartRateTimeline(signals?.heartRate ?? [], startMs, endMs) : null;
  const restingHeartRate = measuredRestingHeartRate ?? sleepHeartRate?.resting ?? null;

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
        avgSleepingHeartRate: sleepHeartRate?.average ?? null,
        lowestSleepingHeartRate: sleepHeartRate?.lowest ?? null,
        sleepHeartRateTimeline,
        restingHRSource: measuredRestingHeartRate != null ? 'measured' : sleepHeartRate ? 'estimated_sleep_hr' : null,
        sleepHeartRateSampleCount: sleepHeartRate?.sampleCount ?? null,
        sleepHeartRateCoveragePercent: sleepHeartRate?.coveragePercent ?? null,
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

/**
 * Health Connect can expose more than one Samsung sleep record for the same
 * Bangkok wake date. Match RunMate's canonical merge rule by selecting the
 * longest valid Samsung record from the most recent wake date, rather than a
 * shorter segment that merely ended later.
 */
export function selectLatestCanonicalSamsungSleepSample(samples: HealthSample[]): HealthSample | null {
  const candidates = samples
    .filter((sample) => sample.dataType === 'sleep' && sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID)
    .map((sample) => ({
      sample,
      dateKey: getBangkokDateKey(sample.endDate),
      durationMs: Date.parse(sample.endDate) - Date.parse(sample.startDate),
    }))
    .filter(({ durationMs }) => Number.isFinite(durationMs) && durationMs > 0);
  if (!candidates.length) return null;

  const latestDateKey = candidates.reduce((latest, candidate) => candidate.dateKey > latest ? candidate.dateKey : latest, candidates[0].dateKey);
  return candidates
    .filter((candidate) => candidate.dateKey === latestDateKey)
    .sort((a, b) => b.durationMs - a.durationMs || Date.parse(b.sample.endDate) - Date.parse(a.sample.endDate))[0]?.sample ?? null;
}

async function readAuthorizedSignals(
  authorized: string[],
  startDate: string,
  endDate: string,
  prepared: PreparedHealthSnapshot | null = null,
): Promise<SamsungSleepSignals> {
  const read = async (dataType: typeof SIGNAL_TYPES[number]) => {
    if (!authorized.includes(dataType)) return [];
    const preparedSamples = prepared?.[dataType]?.samples;
    if (preparedSamples) return preparedSamples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
    const result = await Health.readSamples({ dataType, startDate, endDate, ascending: true, limit: 500 });
    return result.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
  };
  const [heartRateVariability, restingHeartRate, respiratoryRate] = await Promise.all([
    read('heartRateVariability'),
    read('restingHeartRate'),
    read('respiratoryRate'),
  ]);
  return { heartRateVariability, restingHeartRate, respiratoryRate, heartRate: [] };
}

async function readSleepHeartRate(authorized: string[], sleep: HealthSample): Promise<HealthSample[]> {
  if (!authorized.includes('heartRate')) return [];
  try {
    const result = await Health.readSamples({
      dataType: 'heartRate',
      startDate: sleep.startDate,
      endDate: sleep.endDate,
      ascending: true,
      limit: 2000,
    });
    return result.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
  } catch (error) {
    console.warn('[sleep-sync] Sleep-window heart rate read failed', error);
    return [];
  }
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

export function estimateSleepHeartRate(samples: HealthSample[], startMs: number, endMs: number): SleepHeartRateEstimate | null {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const points = samples
    .map((sample) => ({ at: Date.parse(sample.startDate), bpm: sample.value }))
    .filter(({ at, bpm }) => Number.isFinite(at) && at >= startMs && at <= endMs && Number.isFinite(bpm) && bpm >= 30 && bpm <= 240)
    .sort((a, b) => a.at - b.at);
  if (points.length < MIN_SLEEP_HR_SAMPLES) return null;

  let supportedMs = 0;
  for (let index = 1; index < points.length; index += 1) {
    supportedMs += Math.min(SLEEP_HR_SAMPLE_SUPPORT_MS, points[index].at - points[index - 1].at);
  }
  const coveragePercent = Math.min(100, Math.round(supportedMs / (endMs - startMs) * 100));
  if (coveragePercent < MIN_SLEEP_HR_COVERAGE_PERCENT) return null;

  const values = points.map((point) => point.bpm);
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const sortedValues = [...values].sort((a, b) => a - b);
  const lowerBand = sortedValues.slice(0, Math.max(3, Math.ceil(sortedValues.length * 0.25)));
  const resting = Math.round(medianValue(lowerBand));
  return { average, resting, lowest: Math.round(sortedValues[0]), sampleCount: values.length, coveragePercent };
}

export function buildSleepHeartRateTimeline(samples: HealthSample[], startMs: number, endMs: number): { at: string; bpm: number }[] {
  const points = samples
    .map((sample) => ({ atMs: Date.parse(sample.startDate), bpm: sample.value }))
    .filter(({ atMs, bpm }) => Number.isFinite(atMs) && atMs >= startMs && atMs <= endMs && Number.isFinite(bpm) && bpm >= 30 && bpm <= 240)
    .sort((a, b) => a.atMs - b.atMs);
  if (points.length <= MAX_SLEEP_HR_TIMELINE_POINTS) {
    return points.map(({ atMs, bpm }) => ({ at: new Date(atMs).toISOString(), bpm: Math.round(bpm) }));
  }

  return Array.from({ length: MAX_SLEEP_HR_TIMELINE_POINTS }, (_, index) => {
    const point = points[Math.round(index * (points.length - 1) / (MAX_SLEEP_HR_TIMELINE_POINTS - 1))];
    return { at: new Date(point.atMs).toISOString(), bpm: Math.round(point.bpm) };
  });
}

function medianValue(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
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

