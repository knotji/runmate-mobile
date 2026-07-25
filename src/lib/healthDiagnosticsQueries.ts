import { Health } from '@capgo/capacitor-health';
import type { HealthDataType, HealthSample, Workout } from '@capgo/capacitor-health';
import { estimateSleepHeartRate, selectLatestCanonicalSamsungSleepSample } from '@/lib/samsungSleepSync';

/** Full Health Connect permission set used by the developer diagnostics panel's raw read checks. */
export const READ_TYPES: HealthDataType[] = ['steps', 'distance', 'calories', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'respiratoryRate', 'oxygenSaturation', 'vo2Max', 'weight', 'bodyFat', 'workouts'];
/** Permission set actually requested from the OS for the product Connect/Sync flow. */
export const PRODUCT_READ_TYPES: HealthDataType[] = ['sleep', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate', 'workouts', 'heartRate', 'distance', 'calories', 'vo2Max', 'weight', 'bodyFat'];
export const VITAL_TYPES: HealthDataType[] = ['heartRate', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate', 'oxygenSaturation'];

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function bangkokMidnightDaysAgo(days: number): string {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const bangkokMidnightAsUtcFields = Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate() - days);
  return new Date(bangkokMidnightAsUtcFields - 7 * 60 * 60 * 1000).toISOString();
}

export type DerivedWorkout = Workout & {
  derived: {
    avgHR: number | null;
    maxHR: number | null;
    minHR: number | null;
    hrSampleCount: number;
    distanceM: number | null;
    caloriesKcal: number | null;
  };
};

export function sampleWithinWorkout(sampleStartIso: string, workoutStartIso: string, workoutEndIso: string): boolean {
  const sampleMs = Date.parse(sampleStartIso);
  return sampleMs >= Date.parse(workoutStartIso) && sampleMs <= Date.parse(workoutEndIso);
}

export function deriveWorkoutMetrics(workout: Workout, heartRate: HealthSample[], distance: HealthSample[], calories: HealthSample[]): DerivedWorkout {
  const hrValues = heartRate.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).map((sample) => sample.value);
  const distanceTotal = distance.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).reduce((sum, sample) => sum + sample.value, 0);
  const caloriesTotal = calories.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).reduce((sum, sample) => sum + sample.value, 0);

  return {
    ...workout,
    derived: {
      avgHR: hrValues.length ? Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length) : null,
      maxHR: hrValues.length ? Math.max(...hrValues) : null,
      minHR: hrValues.length ? Math.min(...hrValues) : null,
      hrSampleCount: hrValues.length,
      distanceM: distanceTotal || null,
      caloriesKcal: caloriesTotal || null,
    },
  };
}

export async function buildIntegrationSnapshot() {
  const weekAgo = bangkokMidnightDaysAgo(7);
  const todayStart = bangkokMidnightDaysAgo(0);
  const now = new Date().toISOString();

  const [stepsAggregated, sleep, restingHeartRate, heartRateVariability, oxygenSaturation, workoutsToday, heartRateToday, distanceToday, caloriesToday] = await Promise.all([
    Health.queryAggregated({ dataType: 'steps', startDate: weekAgo, bucket: 'day', aggregation: 'sum' }),
    Health.readSamples({ dataType: 'sleep', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'restingHeartRate', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'heartRateVariability', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'oxygenSaturation', startDate: weekAgo, limit: 50 }),
    Health.queryWorkouts({ startDate: todayStart, ascending: false, limit: 20 }),
    Health.readSamples({ dataType: 'heartRate', startDate: todayStart, endDate: now, limit: 1000 }),
    Health.readSamples({ dataType: 'distance', startDate: todayStart, endDate: now, limit: 500 }),
    Health.readSamples({ dataType: 'calories', startDate: todayStart, endDate: now, limit: 500 }),
  ]);

  const workoutsWithDerivedMetrics: DerivedWorkout[] = workoutsToday.workouts.map((workout) =>
    deriveWorkoutMetrics(workout, heartRateToday.samples, distanceToday.samples, caloriesToday.samples),
  );

  const sleep7dSummary = sleep.samples.map((sample) => ({
    startDate: sample.startDate,
    endDate: sample.endDate,
    value: sample.value,
    unit: sample.unit,
    sourceId: sample.sourceId,
    sourceName: sample.sourceName,
    hasStageData: sample.hasStageData,
  }));

  return {
    workoutsToday: workoutsWithDerivedMetrics,
    stepsAggregated7d: stepsAggregated.samples,
    restingHeartRate7d: restingHeartRate.samples,
    heartRateVariability7d: heartRateVariability.samples,
    oxygenSaturation7d: oxygenSaturation.samples,
    sleep7dSummary,
  };
}

function summarizeSources(samples: HealthSample[]) {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const source = sample.sourceName || sample.sourceId || 'Unknown Source';
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()].map(([source, sampleCount]) => ({ source, sampleCount }));
}

async function readVitalSamples(dataType: HealthDataType, startDate: string, endDate: string, limit: number) {
  try {
    const result = await Health.readSamples({ dataType, startDate, endDate, ascending: true, limit });
    return {
      status: 'ok' as const,
      sampleCount: result.samples.length,
      sources: summarizeSources(result.samples),
      samples: result.samples,
    };
  } catch (error) {
    return {
      status: 'error' as const,
      sampleCount: 0,
      sources: [],
      samples: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildVitalsDiagnostic() {
  const sevenDaysAgo = daysAgo(7);
  const now = new Date().toISOString();
  const [authorization, sleepResult] = await Promise.all([
    Health.checkAuthorization({ read: ['sleep', ...VITAL_TYPES] }),
    Health.readSamples({ dataType: 'sleep', startDate: sevenDaysAgo, endDate: now, ascending: false, limit: 50 }),
  ]);
  const latestSleep = selectLatestCanonicalSamsungSleepSample(sleepResult.samples);
  const heartRateWindow = latestSleep
    ? { startDate: latestSleep.startDate, endDate: latestSleep.endDate, basis: 'Latest Sleep Window' }
    : { startDate: daysAgo(1), endDate: now, basis: 'Last 24 Hours (No Sleep Record Found)' };

  const [heartRate, heartRateVariability, restingHeartRate, respiratoryRate, oxygenSaturation] = await Promise.all([
    readVitalSamples('heartRate', heartRateWindow.startDate, heartRateWindow.endDate, 2000),
    readVitalSamples('heartRateVariability', sevenDaysAgo, now, 500),
    readVitalSamples('restingHeartRate', sevenDaysAgo, now, 500),
    readVitalSamples('respiratoryRate', sevenDaysAgo, now, 500),
    readVitalSamples('oxygenSaturation', sevenDaysAgo, now, 500),
  ]);

  return {
    queriedAt: now,
    authorization: {
      readAuthorized: authorization.readAuthorized.filter((type) => type === 'sleep' || VITAL_TYPES.includes(type)),
      readDenied: authorization.readDenied.filter((type) => type === 'sleep' || VITAL_TYPES.includes(type)),
    },
    latestSleepWindow: latestSleep ? {
      startDate: latestSleep.startDate,
      endDate: latestSleep.endDate,
      sourceName: latestSleep.sourceName,
      sourceId: latestSleep.sourceId,
      platformId: latestSleep.platformId,
    } : null,
    queryWindows: {
      heartRate: heartRateWindow,
      otherVitals: { startDate: sevenDaysAgo, endDate: now, basis: 'Last 7 Days' },
    },
    sleepHeartRateEstimate: latestSleep
      ? estimateSleepHeartRate(heartRate.samples, Date.parse(latestSleep.startDate), Date.parse(latestSleep.endDate))
      : null,
    vitals: { heartRate, heartRateVariability, restingHeartRate, respiratoryRate, oxygenSaturation },
  };
}
