import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import type { HealthDataType, HealthSample, QueryWorkoutsOptions, Workout, WorkoutType } from '@capgo/capacitor-health';
import { loadHistoryItems, saveHistoryItems } from '@/lib/cloudHistory';
import { classifyHealthSyncItems, selectChangedHealthSyncItems, type HealthSyncCounts } from '@/lib/healthSyncSummary';
import { getBangkokDateKey, todayBangkokDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { WorkoutAnalysis } from '@/types/logs';
import { getFreshPreparedHealthSnapshot } from '@/lib/backgroundHealth';

const SAMSUNG_HEALTH_SOURCE_ID = 'com.sec.android.app.shealth';
const DEFAULT_LOOKBACK_DAYS = 30;
const EXISTING_RECORD_BUFFER_DAYS = 2;
const EXISTING_RECORD_LIMIT = 700;
const CLOSED_WORKOUT_GRACE_MS = 2 * 60_000;
const LAST_SYNC_KEY = 'runmate:samsung-workout-last-synced-at';
const WORKOUT_READ_TYPES: HealthDataType[] = ['workouts', 'heartRate', 'distance', 'calories', 'vo2Max'];

export type SamsungWorkoutSyncResult = HealthSyncCounts & {
  status: 'synced' | 'unavailable' | 'permission_required';
  imported: number;
  dataSource: 'prepared' | 'live' | 'none';
  error?: string;
};

let activeSync: Promise<SamsungWorkoutSyncResult> | null = null;

export function syncSamsungWorkouts(lookbackDays: number | 'today' = DEFAULT_LOOKBACK_DAYS): Promise<SamsungWorkoutSyncResult> {
  if (activeSync) return activeSync;
  activeSync = runSync(lookbackDays).finally(() => { activeSync = null; });
  return activeSync;
}

async function runSync(lookbackDays: number | 'today'): Promise<SamsungWorkoutSyncResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return emptyResult('unavailable');
  let dataSource: SamsungWorkoutSyncResult['dataSource'] = 'live';
  try {
    const availability = await Health.isAvailable();
    if (!availability.available) return emptyResult('unavailable');
    const authorization = await Health.checkAuthorization({ read: WORKOUT_READ_TYPES });
    if (!authorization.readAuthorized.includes('workouts')) return emptyResult('permission_required');

    const todayOnly = lookbackDays === 'today';
    const today = todayBangkokDateKey();
    const endDate = new Date().toISOString();
    const startDate = todayOnly
      ? new Date(`${today}T00:00:00+07:00`).toISOString()
      : new Date(Date.now() - Math.max(1, lookbackDays) * 86_400_000).toISOString();
    const prepared = todayOnly ? await getFreshPreparedHealthSnapshot() : null;
    const preparedWorkouts = prepared?.workouts?.workouts.filter((workout) => getBangkokDateKey(workout.startDate) === today) ?? [];
    const usePrepared = preparedWorkouts.length > 0;
    dataSource = usePrepared ? 'prepared' : 'live';
    const allWorkouts = usePrepared
      ? preparedWorkouts
      : await queryAllHealthConnectWorkouts({ startDate, endDate, ascending: true });
    const workouts = selectImportableHealthConnectWorkouts(allWorkouts).filter((workout) =>
      (!todayOnly || getBangkokDateKey(workout.startDate) === today)
      && Date.parse(workout.endDate) <= Date.now() - CLOSED_WORKOUT_GRACE_MS,
    );
    const canReadHeartRate = authorization.readAuthorized.includes('heartRate');
    const vo2MaxSamples = authorization.readAuthorized.includes('vo2Max')
      ? (usePrepared
          ? prepared?.vo2Max?.samples ?? []
          : (await Health.readSamples({ dataType: 'vo2Max', startDate, endDate, ascending: true, limit: 500 })).samples
        ).filter((sample) => supportedWorkoutSource(sample.sourceId))
      : [];
    const items = await Promise.all(workouts.map(async (workout) => {
      const heartRate = canReadHeartRate
        ? usePrepared
          ? selectWorkoutHeartRate(prepared?.heartRate?.samples ?? [], workout)
          : await readWorkoutHeartRate(workout)
        : [];
      return mapSamsungWorkout(workout, heartRate, vo2MaxSamples);
    }));
    const validItems = items.filter((item): item is LocalHistoryItem => item !== null);
    const existing = await loadHistoryItems(['workout', 'strength'], {
      createdAfter: new Date(Date.parse(startDate) - EXISTING_RECORD_BUFFER_DAYS * 86_400_000).toISOString(),
      limit: EXISTING_RECORD_LIMIT,
    });
    const existingItems = existing.ok ? existing.items : [];
    const counts = classifyHealthSyncItems(validItems, existingItems);
    const changedItems = selectChangedHealthSyncItems(validItems, existingItems);
    if (changedItems.length) {
      const saved = await saveHistoryItems(changedItems);
      if (!saved.ok) return { status: 'synced', imported: 0, dataSource, added: 0, updated: 0, unchanged: 0, failed: changedItems.length, error: saved.error };
    }
    recordSuccessfulSync();
    return { status: 'synced', imported: validItems.length, dataSource, ...counts };
  } catch (error) {
    return { ...emptyResult('unavailable'), dataSource, error: error instanceof Error ? error.message : 'Samsung Health workout sync failed.' };
  }
}

function emptyResult(status: SamsungWorkoutSyncResult['status']): SamsungWorkoutSyncResult {
  return { status, imported: 0, dataSource: 'none', added: 0, updated: 0, unchanged: 0, failed: 0 };
}

/**
 * Health Connect workout results are paginated. The plugin sorts only the
 * records already fetched for a page, so a single limited query can contain
 * old workouts while newer records remain behind `anchor`.
 */
export async function queryAllHealthConnectWorkouts(options: Omit<QueryWorkoutsOptions, 'anchor' | 'limit'>, maximum = 2000): Promise<Workout[]> {
  const workouts: Workout[] = [];
  const seenAnchors = new Set<string>();
  let anchor: string | undefined;
  do {
    const result = await Health.queryWorkouts({ ...options, anchor, limit: Math.min(500, maximum - workouts.length) });
    workouts.push(...result.workouts);
    if (!result.anchor || seenAnchors.has(result.anchor) || workouts.length >= maximum) break;
    seenAnchors.add(result.anchor);
    anchor = result.anchor;
  } while (workouts.length < maximum);
  const unique = new Map<string, Workout>();
  for (const workout of workouts) {
    const key = workout.platformId?.trim() || `${workout.sourceId}|${workout.workoutType}|${workout.startDate}|${workout.endDate}`;
    unique.set(key, workout);
  }
  return [...unique.values()].sort((a, b) => options.ascending ? Date.parse(a.startDate) - Date.parse(b.startDate) : Date.parse(b.startDate) - Date.parse(a.startDate));
}

async function readWorkoutHeartRate(workout: Workout): Promise<HealthSample[]> {
  const result = await Health.readSamples({ dataType: 'heartRate', startDate: workout.startDate, endDate: workout.endDate, ascending: true, limit: 2000 });
  return result.samples.filter((sample) => sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID);
}

function selectWorkoutHeartRate(samples: HealthSample[], workout: Workout): HealthSample[] {
  const start = Date.parse(workout.startDate);
  const end = Date.parse(workout.endDate);
  return samples.filter((sample) => {
    const at = Date.parse(sample.startDate);
    return sample.sourceId === SAMSUNG_HEALTH_SOURCE_ID && Number.isFinite(at) && at >= start && at <= end;
  });
}

export function selectImportableHealthConnectWorkouts(workouts: Workout[]): Workout[] {
  return workouts
    .filter((workout) => workout.sourceId === SAMSUNG_HEALTH_SOURCE_ID)
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
}

function supportedWorkoutSource(sourceId: string | undefined): boolean {
  return sourceId === SAMSUNG_HEALTH_SOURCE_ID;
}

export function mapSamsungWorkout(workout: Workout, heartRate: HealthSample[] = [], vo2MaxSamples: HealthSample[] = []): LocalHistoryItem | null {
  if (workout.sourceId !== SAMSUNG_HEALTH_SOURCE_ID) return null;
  const startMs = Date.parse(workout.startDate);
  const endMs = Date.parse(workout.endDate);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const durationSeconds = workout.duration > 0 ? Math.round(workout.duration) : Math.round((endMs - startMs) / 1000);
  const kind = workoutKind(workout.workoutType);
  const distanceM = positive(workout.totalDistance);
  const distanceKm = distanceM == null ? null : round(distanceM / 1000, 2);
  const hrValues = heartRate.map((sample) => sample.value).filter((value) => Number.isFinite(value) && value > 0);
  const avgHR = hrValues.length ? Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length) : null;
  const maxHR = hrValues.length ? Math.round(Math.max(...hrValues)) : null;
  const vo2Max = nearestWorkoutSignal(vo2MaxSamples, startMs, endMs, 30 * 60_000);
  const avgSpeedKmh = distanceKm && durationSeconds > 0 ? round(distanceKm / (durationSeconds / 3600), 1) : null;
  const avgPace = distanceKm && distanceKm > 0 ? formatPace(durationSeconds / distanceKm, kind === 'swimming' ? '/100 m' : '/km', kind === 'swimming' ? 0.1 : 1) : null;
  const platformKey = workout.platformId?.trim() || `${workout.workoutType}|${workout.startDate}|${workout.endDate}`;
  const extracted: WorkoutAnalysis['extracted'] = {
    workoutKind: kind,
    workoutName: workoutName(workout.workoutType),
    date: getBangkokDateKey(workout.startDate),
    distanceKm: kind === 'swimming' ? null : distanceKm,
    duration: formatDuration(durationSeconds),
    avgPace,
    maxPace: null,
    avgSpeedKmh,
    maxSpeedKmh: null,
    avgHR,
    maxHR,
    cadence: null,
    maxCadence: null,
    steps: null,
    calories: positive(workout.totalEnergyBurned),
    elevationGain: null,
    vo2Max,
    sweatLossMl: null,
    visibleMetrics: ['duration', distanceM != null ? 'distance' : null, avgHR != null ? 'heartRate' : null, workout.totalEnergyBurned != null ? 'calories' : null].filter((value): value is string => value !== null),
    exercises: null,
    muscleGroups: null,
    intensity: null,
    swimKind: kind === 'swimming' ? swimKind(workout.workoutType) : null,
    distanceM: kind === 'swimming' ? distanceM : null,
    poolLengthM: null,
    totalLengths: null,
    avgSwolf: null,
    bestSwolf: null,
    totalStrokes: null,
  };
  return {
    id: `healthconnect-samsung-workout-${stableKey(platformKey)}`,
    type: 'workout',
    createdAt: workout.endDate,
    recordedAt: workout.startDate,
    dateKey: getBangkokDateKey(workout.startDate),
    source: { provider: 'samsung_health', importType: 'health_connect', detectedFormat: 'Health Connect Workout', importedAt: new Date().toISOString() },
    data: {
      extracted,
      coach: emptyCoach(),
      confidence: 'high',
      unclearFields: [],
      sourceId: workout.sourceId,
      sourceName: workout.sourceName,
      platformId: workout.platformId,
      workoutStartTime: workout.startDate,
      workoutEndTime: workout.endDate,
      heartRateSamples: heartRate
        .map((sample) => ({ at: sample.startDate, bpm: Math.round(sample.value) }))
        .filter((sample) => Number.isFinite(Date.parse(sample.at)) && sample.bpm >= 30 && sample.bpm <= 260),
      healthConnect: { workoutType: workout.workoutType, metadata: workout.metadata ?? null },
    },
  };
}

export function getSamsungWorkoutLastSyncedAt(): string | null {
  try { return window.localStorage.getItem(LAST_SYNC_KEY); } catch { return null; }
}

function recordSuccessfulSync(): void {
  try { window.localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch { /* display metadata is best effort */ }
}

function workoutKind(type: WorkoutType): WorkoutAnalysis['extracted']['workoutKind'] {
  if (type === 'runningTreadmill') return 'treadmill';
  if (type === 'running' || type === 'trackAndField') return 'outdoor_run';
  if (type === 'walking' || type === 'hiking') return 'walk';
  if (type === 'cycling' || type === 'bikingStationary' || type === 'handCycling') return 'cycling';
  if (type === 'swimming' || type === 'swimmingPool' || type === 'swimmingOpenWater') return 'swimming';
  if (['strengthTraining', 'functionalStrengthTraining', 'traditionalStrengthTraining', 'weightlifting', 'crossTraining', 'calisthenics', 'exerciseClass'].includes(type)) return 'strength';
  return 'other';
}

function workoutName(type: WorkoutType): string {
  const names: Partial<Record<WorkoutType, string>> = { running: 'Outdoor Run', runningTreadmill: 'Treadmill', walking: 'Walk', cycling: 'Cycling', swimming: 'Swimming', swimmingPool: 'Pool Swim', swimmingOpenWater: 'Open Water Swim', strengthTraining: 'Strength Training', functionalStrengthTraining: 'Functional Strength Training', traditionalStrengthTraining: 'Strength Training', weightlifting: 'Weight Training', crossTraining: 'Circuit Training' };
  return names[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function swimKind(type: WorkoutType): 'pool' | 'open_water' | null { return type === 'swimmingOpenWater' ? 'open_water' : type === 'swimmingPool' || type === 'swimming' ? 'pool' : null; }
function nearestWorkoutSignal(samples: HealthSample[], startMs: number, endMs: number, afterGraceMs: number): number | null {
  const candidates = samples
    .map((sample) => ({ value: sample.value, at: Date.parse(sample.startDate) }))
    .filter(({ value, at }) => Number.isFinite(value) && value > 0 && Number.isFinite(at) && at >= startMs && at <= endMs + afterGraceMs)
    .sort((a, b) => Math.abs(a.at - endMs) - Math.abs(b.at - endMs));
  return candidates[0] ? round(candidates[0].value, 1) : null;
}
function positive(value: number | undefined): number | null { return typeof value === 'number' && Number.isFinite(value) && value > 0 ? round(value, 1) : null; }
function round(value: number, digits: number): number { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function formatDuration(seconds: number): string { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; }
function formatPace(secondsPerKm: number, suffix: string, divisor: number): string { const seconds = secondsPerKm * divisor; return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}${suffix}`; }
function stableKey(value: string): string { let hash = 2166136261; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(36); }
function emptyCoach(): WorkoutAnalysis['coach'] { return { workoutSummary: '', intensityAssessment: '', trainingLoadNote: '', wasTooHard: false, recoveryAdvice: '', nutritionAfterWorkout: '', nextWorkoutSuggestion: '', coachNote: '' }; }
