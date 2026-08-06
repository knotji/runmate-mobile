import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthSample } from '@capgo/capacitor-health';
import { getFreshPreparedHealthSnapshot } from '@/lib/backgroundHealth';
import { getBangkokDateKey, todayBangkokDateKey } from '@/lib/date';

const STORAGE_KEY = 'runmate:all-day-heart-rate:v1';
const BUCKET_MS = 5 * 60_000;
const CURSOR_OVERLAP_MS = 15 * 60_000;
const RETENTION_MS = 7 * 86_400_000;

export type HeartRateBucket = {
  start: string;
  averageBpm: number;
  minimumBpm: number;
  maximumBpm: number;
  sampleCount: number;
};

export type AllDayHeartRateStore = {
  version: 1;
  cursorAt: string | null;
  lastFullSyncDate: string | null;
  lastSyncedAt: string | null;
  buckets: HeartRateBucket[];
};

export type AllDayHeartRateSummary = {
  date: string;
  buckets: HeartRateBucket[];
  averageBpm: number | null;
  minimumBpm: number | null;
  maximumBpm: number | null;
  coveragePercent: number;
  lastSampleAt: string | null;
  lastSyncedAt: string | null;
  freshness: 'current' | 'delayed' | 'missing';
};

export type AllDayHeartRateSyncResult = {
  status: 'synced' | 'unavailable' | 'permission_required' | 'failed';
  dataSource: 'prepared' | 'live' | 'mixed' | 'none';
  samplesRead: number;
  bucketsUpdated: number;
  summary: AllDayHeartRateSummary;
  error?: string;
};

export type AllDayHeartRateDisplayState = {
  kind: 'loading' | 'current' | 'delayed' | 'permission' | 'unavailable' | 'provider_wait' | 'error' | 'idle';
  title: string;
  detail: string;
  action: 'sync' | 'permissions' | null;
  actionLabel: string | null;
};

export function describeAllDayHeartRateSync(
  summary: AllDayHeartRateSummary,
  result: AllDayHeartRateSyncResult | null,
  syncing: boolean,
  isAndroid: boolean,
): AllDayHeartRateDisplayState {
  if (summary.buckets.length) {
    if (syncing) return { kind: 'loading', title: 'Updating heart-rate data', detail: 'Keeping the latest available timeline visible.', action: null, actionLabel: null };
    if (summary.freshness === 'current') return { kind: 'current', title: 'Heart-rate data is current', detail: lastSyncDetail(summary), action: 'sync', actionLabel: 'Sync Again' };
    return { kind: 'delayed', title: 'Newer heart-rate data may be delayed', detail: lastSyncDetail(summary), action: 'sync', actionLabel: 'Retry' };
  }
  if (syncing) return { kind: 'loading', title: 'Checking Health Connect heart rate', detail: 'This can take a moment when Samsung Health is still preparing records.', action: null, actionLabel: null };
  if (!result) return { kind: 'idle', title: 'Heart-rate sync has not run yet', detail: 'Sync to check today’s Health Connect records.', action: 'sync', actionLabel: 'Sync HR' };
  if (result.status === 'permission_required') return { kind: 'permission', title: 'Heart Rate access is not allowed', detail: 'Review Health Connect access, then return here to sync again.', action: 'permissions', actionLabel: 'Review Access' };
  if (result.status === 'unavailable') return isAndroid
    ? { kind: 'unavailable', title: 'Health Connect is unavailable', detail: 'Check that Health Connect is installed and available on this device.', action: 'permissions', actionLabel: 'Review Setup' }
    : { kind: 'unavailable', title: 'All-day HR requires the Android app', detail: 'This timeline reads Health Connect on your Android device.', action: null, actionLabel: null };
  if (result.status === 'failed') return { kind: 'error', title: 'Heart-rate sync did not finish', detail: result.error || 'Your last known data is safe. Try again when Health Connect is available.', action: 'sync', actionLabel: 'Retry' };
  return { kind: 'provider_wait', title: 'No HR samples were shared for today', detail: 'Samsung Health can take time to publish all-day heart-rate records to Health Connect.', action: 'sync', actionLabel: 'Check Again' };
}

const emptyStore = (): AllDayHeartRateStore => ({ version: 1, cursorAt: null, lastFullSyncDate: null, lastSyncedAt: null, buckets: [] });

export function loadAllDayHeartRateStore(): AllDayHeartRateStore {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AllDayHeartRateStore> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.buckets)) return emptyStore();
    return {
      version: 1,
      cursorAt: validIso(parsed.cursorAt) ? parsed.cursorAt! : null,
      lastFullSyncDate: typeof parsed.lastFullSyncDate === 'string' ? parsed.lastFullSyncDate : null,
      lastSyncedAt: validIso(parsed.lastSyncedAt) ? parsed.lastSyncedAt! : null,
      buckets: parsed.buckets.filter(validBucket).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    };
  } catch {
    return emptyStore();
  }
}

export function clearAllDayHeartRateStore(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}

export function mergeHeartRateSamples(
  store: AllDayHeartRateStore,
  samples: HealthSample[],
  options: { readStart: string; syncedAt: string; fullSyncDate?: string | null },
): { store: AllDayHeartRateStore; bucketsUpdated: number } {
  const grouped = new Map<number, number[]>();
  const unique = new Set<string>();
  for (const sample of samples) {
    const at = Date.parse(sample.startDate);
    const bpm = Number(sample.value);
    if (!Number.isFinite(at) || !Number.isFinite(bpm) || bpm < 25 || bpm > 240) continue;
    const key = `${sample.sourceId ?? ''}|${at}|${Math.round(bpm * 10)}`;
    if (unique.has(key)) continue;
    unique.add(key);
    const bucketAt = Math.floor(at / BUCKET_MS) * BUCKET_MS;
    const values = grouped.get(bucketAt) ?? [];
    values.push(bpm);
    grouped.set(bucketAt, values);
  }
  const updated = [...grouped.entries()].map(([start, values]) => ({
    start: new Date(start).toISOString(),
    averageBpm: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    minimumBpm: round(Math.min(...values)),
    maximumBpm: round(Math.max(...values)),
    sampleCount: values.length,
  }));
  const mergedBuckets = new Map(store.buckets.map((bucket) => [bucket.start, bucket]));
  for (const bucket of updated) mergedBuckets.set(bucket.start, bucket);
  const cutoff = Date.parse(options.syncedAt) - RETENTION_MS;
  return {
    store: {
      version: 1,
      cursorAt: options.syncedAt,
      lastFullSyncDate: options.fullSyncDate ?? store.lastFullSyncDate,
      lastSyncedAt: options.syncedAt,
      buckets: [...mergedBuckets.values()].filter((bucket) => Date.parse(bucket.start) >= cutoff).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    },
    bucketsUpdated: updated.length,
  };
}

export function summarizeAllDayHeartRate(store: AllDayHeartRateStore, date = todayBangkokDateKey(), now = Date.now()): AllDayHeartRateSummary {
  const buckets = store.buckets.filter((bucket) => getBangkokDateKey(bucket.start) === date);
  const values = buckets.map((bucket) => bucket.averageBpm);
  const first = buckets[0] ? Date.parse(buckets[0].start) : null;
  const last = buckets.at(-1) ? Date.parse(buckets.at(-1)!.start) : null;
  const possibleBuckets = first != null && last != null ? Math.max(1, Math.floor((last - first) / BUCKET_MS) + 1) : 0;
  const lastSampleAt = last == null ? null : new Date(last).toISOString();
  const sampleAge = last == null ? Number.POSITIVE_INFINITY : now - last;
  return {
    date,
    buckets,
    averageBpm: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
    minimumBpm: buckets.length ? Math.min(...buckets.map((bucket) => bucket.minimumBpm)) : null,
    maximumBpm: buckets.length ? Math.max(...buckets.map((bucket) => bucket.maximumBpm)) : null,
    coveragePercent: possibleBuckets ? Math.min(100, Math.round((buckets.length / possibleBuckets) * 100)) : 0,
    lastSampleAt,
    lastSyncedAt: store.lastSyncedAt,
    freshness: !buckets.length ? 'missing' : sampleAge <= 2 * 60 * 60_000 ? 'current' : 'delayed',
  };
}

export async function syncAllDayHeartRate(force = false): Promise<AllDayHeartRateSyncResult> {
  const previous = loadAllDayHeartRateStore();
  const unavailable = (status: AllDayHeartRateSyncResult['status'], error?: string): AllDayHeartRateSyncResult => ({
    status, dataSource: 'none', samplesRead: 0, bucketsUpdated: 0, summary: summarizeAllDayHeartRate(previous), ...(error ? { error } : {}),
  });
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return unavailable('unavailable');
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return unavailable('unavailable');
    const authorization = await Health.checkAuthorization({ read: ['heartRate'] });
    if (!authorization.readAuthorized.includes('heartRate')) return unavailable('permission_required');
    const now = new Date();
    const today = todayBangkokDateKey();
    const needsFullSync = force || previous.lastFullSyncDate !== today || !validIso(previous.cursorAt);
    const startMs = needsFullSync
      ? Date.parse(`${today}T00:00:00+07:00`)
      : Math.max(Date.parse(`${today}T00:00:00+07:00`), Date.parse(previous.cursorAt!) - CURSOR_OVERLAP_MS);
    const startDate = new Date(startMs).toISOString();
    const endDate = now.toISOString();
    const prepared = await getFreshPreparedHealthSnapshot();
    const preparedSamples = (prepared?.heartRate?.samples ?? []).filter((sample) => Date.parse(sample.startDate) >= startMs);
    let liveSamples: HealthSample[] = [];
    let liveFailed = false;
    try {
      const result = await Health.readSamples({ dataType: 'heartRate', startDate, endDate, ascending: true, limit: 20_000 });
      liveSamples = result.samples;
    } catch (error) {
      liveFailed = true;
      if (!preparedSamples.length) throw error;
    }
    const samples = dedupeSamples([...preparedSamples, ...liveSamples]);
    const effectiveEndDate = liveFailed && validIso(prepared?.capturedAt) ? prepared.capturedAt : endDate;
    const merged = mergeHeartRateSamples(previous, samples, { readStart: startDate, syncedAt: effectiveEndDate, fullSyncDate: needsFullSync ? today : previous.lastFullSyncDate });
    saveStore(merged.store);
    return {
      status: 'synced',
      dataSource: liveFailed ? 'prepared' : preparedSamples.length ? 'mixed' : 'live',
      samplesRead: samples.length,
      bucketsUpdated: merged.bucketsUpdated,
      summary: summarizeAllDayHeartRate(merged.store, today, now.getTime()),
    };
  } catch (error) {
    return unavailable('failed', error instanceof Error ? error.message : 'Heart rate sync failed.');
  }
}

function saveStore(store: AllDayHeartRateStore): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); } catch { /* Keep sync non-blocking if storage is full. */ }
  window.dispatchEvent(new CustomEvent('runmate:all-day-heart-rate-updated'));
}

function dedupeSamples(samples: HealthSample[]): HealthSample[] {
  const unique = new Map<string, HealthSample>();
  for (const sample of samples) unique.set(`${sample.sourceId ?? ''}|${sample.startDate}|${sample.value}`, sample);
  return [...unique.values()].sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
}

function validIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validBucket(value: unknown): value is HeartRateBucket {
  if (!value || typeof value !== 'object') return false;
  const bucket = value as Partial<HeartRateBucket>;
  return validIso(bucket.start) && [bucket.averageBpm, bucket.minimumBpm, bucket.maximumBpm, bucket.sampleCount].every((entry) => Number.isFinite(entry));
}

function round(value: number): number { return Math.round(value * 10) / 10; }

function lastSyncDetail(summary: AllDayHeartRateSummary): string {
  if (!summary.lastSyncedAt) return 'Using the latest available samples.';
  return `Last checked ${new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date(summary.lastSyncedAt))}.`;
}
