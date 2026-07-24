import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample } from '@capgo/capacitor-health';
import { loadHistoryItems, saveHistoryItems } from '@/lib/cloudHistory';
import { classifyHealthSyncItems, selectChangedHealthSyncItems, type HealthSyncCounts } from '@/lib/healthSyncSummary';
import { getBangkokDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { formatReconciliationSyncError, isReconciliationPermissionError } from '@/lib/reconciliationPolicy';
import { createLastSyncedAtStore, stableKey } from '@/lib/healthSyncHelpers';

const SAMSUNG_HEALTH_SOURCE_ID = 'com.sec.android.app.shealth';
const DEFAULT_LOOKBACK_DAYS = 30;
const EXISTING_RECORD_BUFFER_DAYS = 2;
const EXISTING_RECORD_LIMIT = 300;
const BODY_FAT_MATCH_WINDOW_MS = 2 * 60 * 60_000;
const lastSyncedAt = createLastSyncedAtStore('runmate:samsung-body-last-synced-at');

export type SamsungBodySyncResult = HealthSyncCounts & {
  status: 'synced' | 'unavailable' | 'permission_required';
  imported: number;
  error?: string;
};

let activeSync: Promise<SamsungBodySyncResult> | null = null;

/** Persists Health Connect weight/body-fat samples as dated `body` history items, so a real trend can be charted. */
export function syncSamsungBody(lookbackDays: number = DEFAULT_LOOKBACK_DAYS): Promise<SamsungBodySyncResult> {
  if (activeSync) return activeSync;
  activeSync = runSamsungBodySync(lookbackDays).finally(() => { activeSync = null; });
  return activeSync;
}

async function runSamsungBodySync(lookbackDays: number): Promise<SamsungBodySyncResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return emptyResult('unavailable');
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return emptyResult('unavailable');

    const authorization = await Health.checkAuthorization({ read: ['weight', 'bodyFat'] });
    if (!authorization.readAuthorized.includes('weight')) return emptyResult('permission_required');

    const startDate = new Date(Date.now() - Math.max(1, lookbackDays) * 86_400_000).toISOString();
    const endDate = new Date().toISOString();
    const weightResult = await Health.readSamples({ dataType: 'weight', startDate, endDate, ascending: true, limit: 200 });
    const bodyFatResult = authorization.readAuthorized.includes('bodyFat')
      ? await Health.readSamples({ dataType: 'bodyFat', startDate, endDate, ascending: true, limit: 200 })
      : { samples: [] };

    const weightSamples = weightResult.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID && sample.value >= 30 && sample.value <= 300);
    const bodyFatSamples = bodyFatResult.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID && sample.value > 0 && sample.value <= 75);

    const items = weightSamples.map((sample) => mapSamsungBodySample(sample, nearestBodyFatPercent(bodyFatSamples, sample)));

    const existing = await loadHistoryItems(['body'], {
      createdAfter: new Date(Date.parse(startDate) - EXISTING_RECORD_BUFFER_DAYS * 86_400_000).toISOString(),
      limit: EXISTING_RECORD_LIMIT,
    });
    const existingItems = existing.ok ? existing.items.filter((item) => item.source?.provider === 'samsung_health') : [];
    const counts = classifyHealthSyncItems(items, existingItems);
    const changedItems = selectChangedHealthSyncItems(items, existingItems);
    if (!changedItems.length) {
      recordSuccessfulSync();
      return { status: 'synced', imported: items.length, ...counts };
    }
    const saved = await saveHistoryItems(changedItems);
    if (!saved.ok) return { status: 'synced', imported: 0, added: 0, updated: 0, unchanged: 0, failed: changedItems.length, error: saved.error };
    recordSuccessfulSync();
    return { status: 'synced', imported: items.length, ...counts };
  } catch (error) {
    const isPermissionError = isReconciliationPermissionError(error);
    return {
      status: isPermissionError ? 'permission_required' : 'unavailable',
      imported: 0, added: 0, updated: 0, unchanged: 0, failed: 0,
      error: formatReconciliationSyncError(error, 'Samsung Health body sync failed.'),
    };
  }
}

function emptyResult(status: SamsungBodySyncResult['status']): SamsungBodySyncResult {
  return { status, imported: 0, added: 0, updated: 0, unchanged: 0, failed: 0 };
}

export function getSamsungBodyLastSyncedAt(): string | null {
  return lastSyncedAt.get();
}

function recordSuccessfulSync(): void {
  lastSyncedAt.recordNow();
}

/** Finds the closest body-fat reading to a weight sample, within a short window, since smart scales usually report both together. */
export function nearestBodyFatPercent(bodyFatSamples: HealthSample[], weightSample: HealthSample): number | null {
  const targetMs = Date.parse(weightSample.startDate);
  if (!Number.isFinite(targetMs)) return null;
  const candidates = bodyFatSamples
    .map((sample) => ({ value: sample.value, distance: Math.abs(Date.parse(sample.startDate) - targetMs) }))
    .filter(({ distance }) => Number.isFinite(distance) && distance <= BODY_FAT_MATCH_WINDOW_MS)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.value ?? null;
}

export function mapSamsungBodySample(sample: HealthSample, bodyFatPercent: number | null): LocalHistoryItem {
  const dateKey = getBangkokDateKey(sample.startDate);
  const platformKey = sample.platformId?.trim() || `${sample.startDate}|${sample.value}`;
  return {
    id: `healthconnect-samsung-body-${stableKey(platformKey)}`,
    type: 'body',
    createdAt: sample.startDate,
    recordedAt: sample.startDate,
    dateKey,
    source: {
      provider: 'samsung_health',
      importType: 'health_connect',
      detectedFormat: 'Health Connect Body Composition',
      importedAt: new Date().toISOString(),
    },
    data: {
      extracted: {
        date: dateKey,
        weightKg: Math.round(sample.value * 10) / 10,
        skeletalMuscleKg: null,
        bodyFatPercent: bodyFatPercent != null ? Math.round(bodyFatPercent * 10) / 10 : null,
        fatMassKg: null,
        bodyWaterKg: null,
        bmi: null,
        bmrCalories: null,
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
      },
    },
  };
}
