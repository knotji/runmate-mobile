import { daysBetween, getHistoryItemDateKey, shiftDate } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { parseSleepDurationToMinutes } from '@/lib/sleepDuration';
import type { UserProfile } from '@/types/profile';

export type FitnessAgeConfidence = 'building' | 'medium' | 'high';
export type FitnessAgeSignal = { key: string; label: string; value: string; direction: 'helping' | 'holding' | 'neutral'; detail: string };
export type FitnessAgeResult = {
  status: 'building' | 'ready';
  chronologicalAge: number | null;
  fitnessAge: number | null;
  ageDifference: number | null;
  confidence: FitnessAgeConfidence;
  coveragePercent: number;
  historySpanDays: number;
  methodVersion: 'runmate-fitness-age-v1';
  signals: FitnessAgeSignal[];
  missing: string[];
  metrics: { vo2Max: number | null; vo2MaxAverage: number | null; vo2MaxDate: string | null; vo2MaxSource: string | null; restingHr: number | null; hrv: number | null; sleepHours: number | null; activeDaysPerWeek: number | null; sleepNights: number; workoutDays: number };
};

const WINDOW_DAYS = 90;

export function buildFitnessAge(profile: UserProfile | null, items: LocalHistoryItem[], today: string): FitnessAgeResult {
  const chronologicalAge = profileAge(profile, today);
  const start = shiftDate(today, -(WINDOW_DAYS - 1));
  const recent = items.filter((item) => { const date = getHistoryItemDateKey(item); return date >= start && date <= today; });
  const dated = recent.map(getHistoryItemDateKey).sort();
  const historySpanDays = dated.length ? daysBetween(dated[0], dated[dated.length - 1]) + 1 : 0;
  const sleeps = recent.filter((item) => item.type === 'sleep').map(readSleep).filter(notNull);
  const workouts = recent.filter((item) => item.type === 'workout' || item.type === 'strength');
  const workoutDays = new Set(workouts.map(getHistoryItemDateKey)).size;
  const sleepNights = new Set(recent.filter((item) => item.type === 'sleep').map(getHistoryItemDateKey)).size;
  const vo2Records = workouts.map(readVo2Record).filter(notNull).sort((a, b) => b.at.localeCompare(a.at));
  const latestVo2 = vo2Records[0] ?? null;
  const vo2Max = latestVo2?.value ?? finite(profile?.vo2max);
  const vo2MaxAverage = vo2Records.length ? average(vo2Records.map((record) => record.value)) : vo2Max;
  const vo2MaxDate = latestVo2?.date ?? null;
  const vo2MaxSource = latestVo2?.source ?? (vo2Max != null ? profile?.fieldSources?.vo2max === 'health_connect' ? 'Samsung Health profile' : 'Profile' : null);
  const restingHr = average(sleeps.map((sleep) => sleep.restingHr).filter(isNumber));
  const hrv = average(sleeps.map((sleep) => sleep.hrv).filter(isNumber));
  const sleepDurations = sleeps.map((sleep) => sleep.durationMinutes).filter(isNumber);
  const sleepHours = sleepDurations.length ? average(sleepDurations) / 60 : null;
  const activeDaysPerWeek = historySpanDays >= 14 ? workoutDays / historySpanDays * 7 : null;
  const missing: string[] = [];
  if (chronologicalAge == null) missing.push('Birth date or age');
  if (vo2Max == null) missing.push('VO₂ Max');
  if (sleepNights < 10) missing.push(`${Math.max(0, 10 - sleepNights)} more sleep nights`);
  if (workoutDays < 4) missing.push(`${Math.max(0, 4 - workoutDays)} more workout days`);
  if (historySpanDays < 21) missing.push(`${Math.max(0, 21 - historySpanDays)} more days of history`);
  const coveragePercent = Math.round(([
    chronologicalAge != null, vo2Max != null, sleepNights >= 10, workoutDays >= 4, historySpanDays >= 21,
    restingHr != null, hrv != null,
  ].filter(Boolean).length / 7) * 100);
  const metrics = { vo2Max, vo2MaxAverage, vo2MaxDate, vo2MaxSource, restingHr, hrv, sleepHours, activeDaysPerWeek, sleepNights, workoutDays };
  const signals = buildSignals(metrics);
  const ready = chronologicalAge != null && vo2Max != null && sleepNights >= 10 && workoutDays >= 4 && historySpanDays >= 21;
  if (!ready) return { status: 'building', chronologicalAge, fitnessAge: null, ageDifference: null, confidence: 'building', coveragePercent, historySpanDays, methodVersion: 'runmate-fitness-age-v1', signals, missing, metrics };

  const referenceVo2 = expectedVo2(chronologicalAge, profile?.gender);
  const cardioDelta = clamp((referenceVo2 - vo2Max) / 0.8, -7, 7);
  const sleepDelta = sleepHours == null ? 0 : sleepHours >= 7.5 ? -1 : sleepHours >= 7 ? -0.5 : sleepHours >= 6 ? 0.75 : 1.5;
  const rhrDelta = restingHr == null ? 0 : restingHr <= 52 ? -1 : restingHr <= 62 ? -0.4 : restingHr <= 72 ? 0.4 : 1;
  const trainingDelta = activeDaysPerWeek == null ? 0 : activeDaysPerWeek >= 4 ? -0.75 : activeDaysPerWeek >= 2.5 ? 0 : 0.75;
  const fitnessAge = Math.round(clamp(chronologicalAge + cardioDelta + sleepDelta + rhrDelta + trainingDelta, Math.max(18, chronologicalAge - 10), chronologicalAge + 10));
  const ageDifference = fitnessAge - chronologicalAge;
  const confidence: FitnessAgeConfidence = coveragePercent >= 85 && historySpanDays >= 60 ? 'high' : 'medium';
  return { status: 'ready', chronologicalAge, fitnessAge, ageDifference, confidence, coveragePercent, historySpanDays, methodVersion: 'runmate-fitness-age-v1', signals, missing, metrics };
}

function buildSignals(metrics: FitnessAgeResult['metrics']): FitnessAgeSignal[] {
  const result: FitnessAgeSignal[] = [];
  if (metrics.vo2Max != null) {
    const context = [metrics.vo2MaxSource, metrics.vo2MaxDate, metrics.vo2MaxAverage != null ? `90-day average ${metrics.vo2MaxAverage.toFixed(1)}` : null].filter(Boolean).join(' · ');
    result.push({ key: 'vo2', label: 'Latest Cardio Fitness', value: `${metrics.vo2Max.toFixed(1)} VO₂ Max`, direction: 'neutral', detail: context || 'The primary signal in this estimate.' });
  }
  if (metrics.sleepHours != null) result.push({ key: 'sleep', label: 'Sleep Duration', value: `${metrics.sleepHours.toFixed(1)} h average`, direction: metrics.sleepHours >= 7 ? 'helping' : 'holding', detail: metrics.sleepHours >= 7 ? 'Your recent sleep supports long-term fitness.' : 'Averaging closer to 7 hours would improve this trend.' });
  if (metrics.restingHr != null) result.push({ key: 'rhr', label: 'Resting Heart Rate', value: `${Math.round(metrics.restingHr)} bpm`, direction: metrics.restingHr <= 62 ? 'helping' : metrics.restingHr > 72 ? 'holding' : 'neutral', detail: 'Based on recent measured sleep records.' });
  if (metrics.hrv != null) result.push({ key: 'hrv', label: 'HRV Baseline', value: `${Math.round(metrics.hrv)} ms`, direction: 'neutral', detail: 'Shown for context; device and personal baselines vary.' });
  if (metrics.activeDaysPerWeek != null) result.push({ key: 'training', label: 'Training Consistency', value: `${metrics.activeDaysPerWeek.toFixed(1)} active days/week`, direction: metrics.activeDaysPerWeek >= 4 ? 'helping' : metrics.activeDaysPerWeek < 2.5 ? 'holding' : 'neutral', detail: 'Calculated across the available history window.' });
  return result;
}

function profileAge(profile: UserProfile | null, today: string): number | null {
  if (!profile) return null;
  if (profile.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(profile.birthDate)) {
    const [year, month, day] = profile.birthDate.split('-').map(Number);
    const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
    const age = todayYear - year - (todayMonth < month || (todayMonth === month && todayDay < day) ? 1 : 0);
    return age >= 18 && age <= 100 ? age : null;
  }
  const age = finite(profile.age) ?? (profile.birthYear ? Number(today.slice(0, 4)) - profile.birthYear : null);
  return age != null && age >= 18 && age <= 100 ? Math.floor(age) : null;
}

function expectedVo2(age: number, gender?: string): number {
  // Conservative product heuristic for a transparent trend estimate, not a clinical age formula.
  const normalized = (gender ?? '').toLowerCase();
  const atThirty = /female|woman|หญิง/.test(normalized) ? 36 : /male|man|ชาย/.test(normalized) ? 43 : 39.5;
  return clamp(atThirty - (age - 30) * 0.3, 22, 50);
}
function readSleep(item: LocalHistoryItem) { const data = record(item.data); const extracted = record(data.extracted); const durationMinutes = firstNumber(extracted.actualSleepDurationMinutes, extracted.sleepDurationMinutes, data.sleepDurationMinutes) ?? parseSleepDurationToMinutes(String(extracted.sleepDuration ?? data.sleepDuration ?? '')); return { durationMinutes, restingHr: firstNumber(extracted.restingHR, extracted.restingHr, data.restingHR, data.restingHr), hrv: firstNumber(extracted.hrv, data.hrv) }; }
function readVo2Record(item: LocalHistoryItem): { value: number; date: string; at: string; source: string } | null { const data = record(item.data); const extracted = record(data.extracted); const value = firstNumber(extracted.vo2Max, data.vo2Max); if (value == null) return null; const source = item.source?.provider === 'samsung_health' ? 'Samsung Health' : item.source?.provider === 'manual' ? 'Manual' : 'Workout'; return { value, date: getHistoryItemDateKey(item), at: item.recordedAt ?? item.createdAt, source }; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function firstNumber(...values: unknown[]): number | null { for (const value of values) { const number = finite(value); if (number != null) return number; } return null; }
function finite(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function isNumber(value: number | null): value is number { return value != null; }
function notNull<T>(value: T | null): value is T { return value != null; }
function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)); }
