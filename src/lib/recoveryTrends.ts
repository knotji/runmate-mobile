import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { calculateRunMateSleepScore, type RunMateSleepScoreNight } from '@/lib/runMateSleepScore';
import { parseSleepDurationToMinutes } from '@/lib/sleepDuration';

export type RecoveryTrendPoint = {
  date: string;
  recovery: number | null;
  sleep: number | null;
  strain: number | null;
  state: 'scored' | 'calibrating' | 'missing';
  hrv: number | null;
  restingHR: number | null;
  respiratoryRate: number | null;
};

export type RecoveryTrendInsight = {
  direction: 'up' | 'down' | 'steady' | 'unavailable';
  change: number | null;
  title: string;
  summary: string;
  factors: string[];
};

export type RecoveryCalibrationSignal = {
  key: 'hrv' | 'resting_hr' | 'respiratory_rate' | 'sleep_score';
  label: string;
  available: boolean;
  weight: number;
  detail: string;
};

export type RecoveryCalibration = {
  confidence: 'high' | 'medium' | 'limited';
  label: 'High Confidence' | 'Medium Confidence' | 'Limited Data';
  summary: string;
  latestSleepDate: string | null;
  freshness: 'current' | 'stale' | 'missing';
  baselineNights: number;
  targetBaselineNights: 14;
  availableSignalCount: number;
  totalSignalCount: 4;
  signals: RecoveryCalibrationSignal[];
};

type SleepSignals = {
  date: string;
  sleep: number | null;
  hrv: number | null;
  restingHR: number | null;
  respiratoryRate: number | null;
  durationMinutes: number | null;
  timeInBedMinutes: number | null;
  sleepStartTime: string | null;
  sleepEndTime: string | null;
  remMinutes: number | null;
  lightMinutes: number | null;
  deepMinutes: number | null;
};

export function buildRecoveryTrend(
  items: LocalHistoryItem[],
  profile: Record<string, unknown> | null,
  days: 7 | 30,
  todayDate: string,
): { points: RecoveryTrendPoint[]; insight: RecoveryTrendInsight; calibration: RecoveryCalibration } {
  const startDate = shiftDate(todayDate, -(days - 1));
  const sleep = dedupeSleepItems(items.filter((item) => item.type === 'sleep'))
    .map(toSleepSignals)
    .filter((night) => night.date <= todayDate)
    .sort((a, b) => b.date.localeCompare(a.date));
  const strainByDate = buildDailyStrain(items, profile);
  const scoredSleep = sleep.map((night, index) => ({
    ...night,
    sleep: calculateRunMateSleepScore(
      [night, ...sleep.slice(index + 1, index + 31)].map(toSleepScoreNight),
      0,
    ).score,
  }));
  const scoredSleepByDate = new Map(scoredSleep.map((night) => [night.date, night]));
  const points: RecoveryTrendPoint[] = [];

  for (let offset = 0; offset < days; offset++) {
    const date = shiftDate(startDate, offset);
    const night = scoredSleepByDate.get(date) ?? null;
    const olderNights = scoredSleep.filter((candidate) => candidate.date < date).slice(0, 30);
    const recovery = night ? calculateRecovery(night, olderNights) : null;
    points.push({
      date,
      recovery: recovery?.score ?? null,
      sleep: night?.sleep ?? null,
      strain: strainByDate.get(date) ?? null,
      state: recovery?.state ?? 'missing',
      hrv: night?.hrv ?? null,
      restingHR: night?.restingHR ?? null,
      respiratoryRate: night?.respiratoryRate ?? null,
    });
  }

  return {
    points,
    insight: explainLatestChange(points),
    calibration: buildRecoveryCalibration(scoredSleep, todayDate),
  };
}

function buildRecoveryCalibration(nights: SleepSignals[], todayDate: string): RecoveryCalibration {
  const latest = nights[0] ?? null;
  const baseline = nights.slice(1, 31);
  const baselineNights = baseline.length;
  const hrvBaselineNights = baseline.filter((night) => night.hrv != null).length;
  const rhrBaselineNights = baseline.filter((night) => night.restingHR != null).length;
  const respiratoryBaselineNights = baseline.filter((night) => night.respiratoryRate != null).length;
  const hasHrv = latest?.hrv != null && hrvBaselineNights >= 3;
  const hasRhr = latest?.restingHR != null && rhrBaselineNights >= 3;
  const hasRespiratory = latest?.respiratoryRate != null && respiratoryBaselineNights >= 3;
  const hasSleepScore = latest?.sleep != null;
  const signals: RecoveryCalibrationSignal[] = [
    {
      key: 'hrv', label: 'HRV', available: hasHrv, weight: 40,
      detail: hasHrv ? `${hrvBaselineNights} baseline nights` : latest?.hrv == null ? 'Missing from latest sleep' : `${hrvBaselineNights}/3 baseline nights`,
    },
    {
      key: 'resting_hr', label: 'Resting Heart Rate', available: hasRhr, weight: 25,
      detail: hasRhr ? `${rhrBaselineNights} baseline nights` : latest?.restingHR == null ? 'Missing from latest sleep' : `${rhrBaselineNights}/3 baseline nights`,
    },
    {
      key: 'respiratory_rate', label: 'Respiratory Rate', available: hasRespiratory, weight: 15,
      detail: hasRespiratory ? `${respiratoryBaselineNights} baseline nights` : latest?.respiratoryRate == null ? 'Missing from latest sleep' : `${respiratoryBaselineNights}/3 baseline nights`,
    },
    {
      key: 'sleep_score', label: 'Sleep Score', available: hasSleepScore, weight: 20,
      detail: hasSleepScore ? 'Calculated from available Sleep details' : 'Sleep Duration is required',
    },
  ];
  const availableSignals = signals.filter((signal) => signal.available);
  const availableWeight = availableSignals.reduce((total, signal) => total + signal.weight, 0);
  const freshness = latest == null ? 'missing' : latest.date === todayDate ? 'current' : 'stale';
  const confidence: RecoveryCalibration['confidence'] = freshness === 'current' && baselineNights >= 14 && availableWeight >= 65
    ? 'high'
    : freshness === 'current' && baselineNights >= 7 && availableWeight >= 40
      ? 'medium'
      : 'limited';
  const label = confidence === 'high' ? 'High Confidence' : confidence === 'medium' ? 'Medium Confidence' : 'Limited Data';
  const summary = freshness === 'missing'
    ? 'Add a recent Sleep record to start calibrating Recovery.'
    : confidence === 'high'
      ? 'Your recent signals are supported by a mature personal baseline.'
      : confidence === 'medium'
        ? 'Your score uses useful personal data, but calibration can still improve.'
        : 'Treat this score as an early trend while RunMate learns your baseline.';
  return {
    confidence,
    label,
    summary,
    latestSleepDate: latest?.date ?? null,
    freshness,
    baselineNights,
    targetBaselineNights: 14,
    availableSignalCount: availableSignals.length,
    totalSignalCount: 4,
    signals,
  };
}

function toSleepSignals(item: LocalHistoryItem): SleepSignals {
  const data = item.data as { extracted?: Record<string, unknown>; coach?: Record<string, unknown> };
  const extracted = data?.extracted ?? {};
  const stageMinutes = extracted.sleepStageMinutes as Record<string, unknown> | null | undefined;
  return {
    date: getHistoryItemDateKey(item),
    sleep: null,
    hrv: finite(extracted.hrv),
    restingHR: finite(extracted.restingHR),
    respiratoryRate: finite(extracted.avgRespiratoryRate),
    durationMinutes: parseSleepDurationToMinutes(extracted.actualSleepDurationMinutes ?? extracted.sleepDuration),
    timeInBedMinutes: finite(extracted.timeInBedMinutes),
    sleepStartTime: stringOrNull(extracted.sleepStartTime),
    sleepEndTime: stringOrNull(extracted.sleepEndTime),
    remMinutes: finite(stageMinutes?.rem ?? extracted.sleepStageRemMinutes),
    lightMinutes: finite(stageMinutes?.light ?? extracted.sleepStageLightMinutes),
    deepMinutes: finite(stageMinutes?.deep ?? extracted.sleepStageDeepMinutes),
  };
}

function toSleepScoreNight(night: SleepSignals): RunMateSleepScoreNight {
  return {
    durationMinutes: night.durationMinutes,
    timeInBedMinutes: night.timeInBedMinutes,
    sleepStartTime: night.sleepStartTime,
    sleepEndTime: night.sleepEndTime,
    remMinutes: night.remMinutes,
    lightMinutes: night.lightMinutes,
    deepMinutes: night.deepMinutes,
  };
}

function calculateRecovery(night: SleepSignals, older: SleepSignals[]): { score: number; state: 'scored' | 'calibrating' } | null {
  let weighted = 0;
  let weight = 0;
  const hrvBaseline = median(older.map((item) => item.hrv));
  const rhrBaseline = median(older.map((item) => item.restingHR));
  const respiratoryBaseline = median(older.map((item) => item.respiratoryRate));

  if (night.hrv != null && hrvBaseline != null && hrvBaseline > 0) {
    weighted += clamp(65 + ((night.hrv - hrvBaseline) / hrvBaseline) * 180) * 0.4;
    weight += 0.4;
  }
  if (night.restingHR != null && rhrBaseline != null && rhrBaseline > 0) {
    weighted += clamp(65 - ((night.restingHR - rhrBaseline) / rhrBaseline) * 180) * 0.25;
    weight += 0.25;
  }
  if (night.respiratoryRate != null && respiratoryBaseline != null && respiratoryBaseline > 0) {
    weighted += clamp(70 - Math.abs((night.respiratoryRate - respiratoryBaseline) / respiratoryBaseline) * 300) * 0.15;
    weight += 0.15;
  }
  if (night.sleep != null) {
    weighted += night.sleep * 0.2;
    weight += 0.2;
  }
  if (!weight) return null;
  return { score: Math.round(clamp(weighted / weight)), state: older.length >= 3 ? 'scored' : 'calibrating' };
}

function buildDailyStrain(items: LocalHistoryItem[], profile: Record<string, unknown> | null): Map<string, number> {
  const workouts = dedupeWorkoutItems(items.filter((item) => item.type === 'workout' || item.type === 'strength'));
  const effort = new Map<string, number>();
  const profileMaxHR = finite(profile?.maxHr ?? profile?.max_hr) ?? 190;
  for (const item of workouts) {
    const date = getHistoryItemDateKey(item);
    const data = item.data as { extracted?: Record<string, unknown>; durationMin?: number };
    const extracted = data?.extracted ?? {};
    const duration = durationMinutes(extracted.duration) ?? finite(data.durationMin);
    if (duration == null || duration <= 0) continue;
    const avgHR = finite(extracted.avgHR);
    const kind = String(extracted.workoutKind ?? (item.type === 'strength' ? 'strength' : 'other'));
    const restingHR = 60;
    const multiplier = kind === 'strength' ? 0.55 : kind === 'walk' ? 0.22 : avgHR == null
      ? (kind === 'outdoor_run' || kind === 'treadmill' ? 0.48 : 0.35)
      : Math.pow(clamp((avgHR - restingHR) / Math.max(1, profileMaxHR - restingHR), 0.2, 1.05), 1.7);
    effort.set(date, (effort.get(date) ?? 0) + duration * multiplier);
  }
  return new Map([...effort].map(([date, value]) => [date, Math.round(clamp(21 * (1 - Math.exp(-value / 75)), 0, 21) * 10) / 10]));
}

function explainLatestChange(points: RecoveryTrendPoint[]): RecoveryTrendInsight {
  const scored = points.filter((point) => point.recovery != null);
  const current = scored.at(-1);
  const previous = scored.at(-2);
  if (!current || !previous) return { direction: 'unavailable', change: null, title: 'More Nights Needed', summary: 'At least two scored nights are needed to explain a change.', factors: [] };
  const change = Math.round((current.recovery! - previous.recovery!) * 10) / 10;
  const direction = Math.abs(change) < 2 ? 'steady' : change > 0 ? 'up' : 'down';
  const candidates: Array<{ impact: number; text: string }> = [];
  addFactor(candidates, current.sleep, previous.sleep, 1, 'Sleep Score');
  addFactor(candidates, current.hrv, previous.hrv, 1, 'HRV', 'ms');
  addFactor(candidates, current.restingHR, previous.restingHR, -1, 'Resting HR', 'bpm');
  addFactor(candidates, current.respiratoryRate, previous.respiratoryRate, -1, 'Respiratory Rate', '/min');
  const factors = candidates.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 3).map((factor) => factor.text);
  return {
    direction,
    change,
    title: direction === 'up' ? 'Recovery Improved' : direction === 'down' ? 'Recovery Declined' : 'Recovery Held Steady',
    summary: direction === 'steady'
      ? `${formatShortDate(current.date)} is within 2 points of the previous scored night.`
      : `${formatShortDate(current.date)} is ${Math.abs(Math.round(change))} points ${direction === 'up' ? 'higher' : 'lower'} than the previous scored night.`,
    factors: factors.length ? factors : ['Available physiological signals changed only slightly.'],
  };
}

function addFactor(target: Array<{ impact: number; text: string }>, current: number | null, previous: number | null, favorableDirection: 1 | -1, label: string, unit = ''): void {
  if (current == null || previous == null || current === previous) return;
  const delta = current - previous;
  const formatted = Math.abs(delta) < 1 ? Math.abs(delta).toFixed(1) : String(Math.round(Math.abs(delta)));
  target.push({ impact: delta * favorableDirection, text: `${label} ${delta > 0 ? 'rose' : 'fell'} by ${formatted}${unit ? ` ${unit}` : ''}.` });
}

function durationMinutes(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (match && (match[1] || match[2])) return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
  const parts = value.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return null;
}

function finite(value: unknown): number | null { if (value == null || value === '') return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function stringOrNull(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null; }
function median(values: Array<number | null>): number | null { const sorted = values.filter((value): value is number => value != null).sort((a, b) => a - b); if (!sorted.length) return null; const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function clamp(value: number, min = 0, max = 100): number { return Math.min(max, Math.max(min, value)); }
function shiftDate(date: string, days: number): string { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); }
function formatShortDate(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)); }
