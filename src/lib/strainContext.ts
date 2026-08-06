import type { CoachContext, MealContextSummary, TodayCompletedWorkoutSummary } from '@/lib/buildCoachContext';
import type { AllDayHeartRateSummary } from '@/lib/allDayHeartRate';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { RecoveryTrendPoint } from '@/lib/recoveryTrends';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';

const STORAGE_KEY = 'runmate:strain-check-ins:v1';
const CAFFEINE_PATTERN = /\b(coffee|espresso|americano|latte|cappuccino|mocha|cold brew|tea|matcha|cocoa|chocolate|energy drink|cola)\b|กาแฟ|ชา|มัทฉะ|โกโก้|ช็อกโกแลต|เครื่องดื่มชูกำลัง/i;

export type StressLevel = 'low' | 'moderate' | 'high';
export type EnvironmentContext = 'normal' | 'hot_humid' | 'indoor';

export type DailyStrainCheckIn = {
  date: string;
  stress: StressLevel | null;
  environment: EnvironmentContext | null;
  updatedAt: string;
};

export type StrainContributor = {
  key: 'workout' | 'caffeine' | 'illness' | 'stress' | 'heat' | 'heart_rate';
  title: string;
  detail: string;
  confidence: 'high' | 'possible' | 'context';
};

export type StrainDetailInsight = {
  score: number;
  level: string;
  compatibleRange: { minimum: number; maximum: number; label: string } | null;
  rangeStatus: 'below' | 'within' | 'above' | null;
  contributors: StrainContributor[];
  nextAction: string;
};

export function loadDailyStrainCheckIn(date: string): DailyStrainCheckIn {
  try {
    const rows = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as DailyStrainCheckIn[];
    const row = Array.isArray(rows) ? rows.find((entry) => entry.date === date) : null;
    if (row) return { date, stress: validStress(row.stress) ? row.stress : null, environment: validEnvironment(row.environment) ? row.environment : null, updatedAt: row.updatedAt };
  } catch { /* Fall through to an empty check-in. */ }
  return { date, stress: null, environment: null, updatedAt: new Date().toISOString() };
}

export function saveDailyStrainCheckIn(checkIn: DailyStrainCheckIn): void {
  let rows: DailyStrainCheckIn[] = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) rows = parsed.filter((entry) => entry?.date !== checkIn.date);
  } catch { /* Replace malformed local data. */ }
  rows.push({ ...checkIn, updatedAt: new Date().toISOString() });
  rows = rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* Keep the page usable without storage. */ }
  window.dispatchEvent(new CustomEvent('runmate:strain-check-in-updated'));
}

export function clearStrainCheckIns(): void {
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}

export function exportStrainCheckIns(): DailyStrainCheckIn[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function buildStrainDetailInsight(context: CoachContext, heartRate: AllDayHeartRateSummary, checkIn: DailyStrainCheckIn): StrainDetailInsight {
  const score = context.recoverySystem.strain.score;
  const recovery = context.recoverySystem.overallScore;
  const compatibleRange = recoveryCompatibleRange(recovery);
  const rangeStatus = strainRangeStatus(score, compatibleRange);
  const contributors: StrainContributor[] = [];
  if (context.todayWorkouts.length) contributors.push(workoutContributor(context.todayWorkouts));
  const caffeine = latestCaffeine(context.mealsToday);
  if (caffeine) contributors.push({ key: 'caffeine', title: 'Caffeine Logged', detail: caffeine.loggedAt ? `${caffeine.food} was logged at ${formatTime(caffeine.loggedAt)}; consumption time is not confirmed.` : `${caffeine.food} appears in today's meal log.`, confidence: 'possible' });
  const illness = illnessContributor(context);
  if (illness) contributors.push(illness);
  if (checkIn.environment === 'hot_humid') contributors.push({ key: 'heat', title: 'Hot Or Humid Conditions', detail: 'You confirmed heat or humidity today, which can raise cardiovascular load.', confidence: 'high' });
  if (checkIn.stress === 'high' || checkIn.stress === 'moderate') contributors.push({ key: 'stress', title: `${checkIn.stress === 'high' ? 'High' : 'Moderate'} Stress Reported`, detail: 'This is based on your check-in, not inferred from heart rate alone.', confidence: 'high' });
  if (heartRate.buckets.length && heartRate.averageBpm != null) contributors.push({ key: 'heart_rate', title: 'All-Day Heart Rate Context', detail: `${heartRate.averageBpm.toFixed(0)} bpm average across ${heartRate.coveragePercent}% observed timeline coverage.`, confidence: 'context' });
  const nextAction = rangeStatus === 'above'
    ? 'Stop adding training load today and prioritize fluids, food, and recovery.'
    : recovery < 34
      ? 'Keep movement easy and use symptoms—not the score alone—to decide whether to rest.'
      : rangeStatus === 'below' && context.todayWorkouts.length === 0
        ? 'Follow the planned session if you feel well; there is no need to chase a higher Strain score.'
        : 'Keep the rest of today aligned with your current plan.';
  return { score, level: context.recoverySystem.strain.level, compatibleRange, rangeStatus, contributors, nextAction };
}

export function buildHistoricalStrainDetailInsight(
  items: LocalHistoryItem[],
  point: RecoveryTrendPoint | null,
  heartRate: AllDayHeartRateSummary,
  checkIn: DailyStrainCheckIn,
): StrainDetailInsight {
  const score = point?.strain ?? 0;
  const compatibleRange = point?.recovery == null ? null : recoveryCompatibleRange(point.recovery);
  const rangeStatus = compatibleRange ? strainRangeStatus(score, compatibleRange) : null;
  const contributors: StrainContributor[] = [];
  const workouts = dedupeWorkoutItems(items.filter((item) => (item.type === 'workout' || item.type === 'strength') && getHistoryItemDateKey(item) === checkIn.date));
  if (workouts.length) contributors.push({
    key: 'workout',
    title: workouts.length === 1 ? 'Recorded Training' : `${workouts.length} Recorded Sessions`,
    detail: `${score.toFixed(1)} Strain was calculated from the available workout record${workouts.length === 1 ? '' : 's'} for this day.`,
    confidence: 'high',
  });
  addConfirmedContext(contributors, checkIn);
  if (heartRate.buckets.length && heartRate.averageBpm != null) contributors.push({ key: 'heart_rate', title: 'All-Day Heart Rate Context', detail: `${heartRate.averageBpm.toFixed(0)} bpm average across ${heartRate.coveragePercent}% observed timeline coverage.`, confidence: 'context' });
  const nextAction = contributors.length
    ? 'Use this day as context for patterns over time, not as a target to reproduce.'
    : 'No retained workout, heart-rate, or check-in context is available for this day.';
  return { score, level: strainLevel(score), compatibleRange, rangeStatus, contributors, nextAction };
}

export function recoveryCompatibleRange(recovery: number): { minimum: number; maximum: number; label: string } {
  return recovery < 34
    ? { minimum: 0, maximum: 8, label: 'Recovery-focused' }
    : recovery < 67
      ? { minimum: 6, maximum: 13, label: 'Controlled load' }
      : { minimum: 8, maximum: 17, label: 'Planned training' };
}

function strainRangeStatus(score: number, range: { minimum: number; maximum: number }): 'below' | 'within' | 'above' {
  return score < range.minimum ? 'below' : score > range.maximum ? 'above' : 'within';
}

function strainLevel(score: number): string {
  return score < 4 ? 'light' : score < 10 ? 'moderate' : score < 15 ? 'high' : 'all_out';
}

function addConfirmedContext(contributors: StrainContributor[], checkIn: DailyStrainCheckIn): void {
  if (checkIn.environment === 'hot_humid') contributors.push({ key: 'heat', title: 'Hot Or Humid Conditions', detail: 'You confirmed heat or humidity for this day, which may have raised cardiovascular load.', confidence: 'high' });
  if (checkIn.stress === 'high' || checkIn.stress === 'moderate') contributors.push({ key: 'stress', title: `${checkIn.stress === 'high' ? 'High' : 'Moderate'} Stress Reported`, detail: 'This is based on your check-in, not inferred from heart rate alone.', confidence: 'high' });
}

function workoutContributor(workouts: TodayCompletedWorkoutSummary[]): StrainContributor {
  const minutes = Math.round(workouts.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0));
  const labels = [...new Set(workouts.map((workout) => workout.label))].join(', ');
  return { key: 'workout', title: workouts.length === 1 ? labels : `${workouts.length} Workouts`, detail: `${minutes} recorded minutes${labels ? ` · ${labels}` : ''}.`, confidence: 'high' };
}

function illnessContributor(context: CoachContext): StrainContributor | null {
  if (context.activeSick) return { key: 'illness', title: 'Symptoms Reported', detail: 'Your latest Sick Check-in is active. Elevated HR should not be treated as productive training load.', confidence: 'high' };
  const latest = context.sleepBaseline30d[0];
  const baseline = context.sleepBaseline30d.slice(1);
  if (!latest || baseline.length < 4) return null;
  const rhr = median(baseline.map((night) => night.restingHR));
  const hrv = median(baseline.map((night) => night.hrv));
  const rhrElevated = latest.restingHR != null && rhr != null && latest.restingHR >= rhr + 5;
  const hrvSuppressed = latest.hrv != null && hrv != null && latest.hrv <= hrv * 0.85;
  if (!rhrElevated && !hrvSuppressed) return null;
  return { key: 'illness', title: 'Recovery Signals Shifted', detail: `${rhrElevated ? 'Resting HR is above baseline' : ''}${rhrElevated && hrvSuppressed ? ' and ' : ''}${hrvSuppressed ? 'HRV is below baseline' : ''}. This can reflect incomplete recovery or illness, but is not a diagnosis.`, confidence: rhrElevated && hrvSuppressed ? 'possible' : 'context' };
}

function latestCaffeine(meals: MealContextSummary[]): { food: string; loggedAt: string | null } | null {
  return meals.flatMap((meal) => meal.foods.map((food) => ({ food, loggedAt: meal.loggedAt ?? null })))
    .filter((entry) => CAFFEINE_PATTERN.test(entry.food))
    .sort((a, b) => Date.parse(b.loggedAt ?? '') - Date.parse(a.loggedAt ?? ''))[0] ?? null;
}

function median(values: Array<number | null>): number | null {
  const sorted = values.filter((value): value is number => value != null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date) : 'an unconfirmed time';
}

function validStress(value: unknown): value is StressLevel { return value === 'low' || value === 'moderate' || value === 'high'; }
function validEnvironment(value: unknown): value is EnvironmentContext { return value === 'normal' || value === 'hot_humid' || value === 'indoor'; }
