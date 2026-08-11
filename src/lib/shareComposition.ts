import type { CoachContext } from '@/lib/buildCoachContext';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import type { EnergyReserve } from '@/lib/energyReserve';
import { buildTodayBrief } from '@/lib/todayBrief';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import type { WeeklyRecapHighlights } from '@/lib/weeklyRecapHighlights';
import { getAvailableWorkoutMetrics, type SportType, type WorkoutMetricKey } from '@/lib/workoutShareMetrics';

export type ShareLayout = 'minimal' | 'stack' | 'signature';
export type ShareTextTreatment = 'light' | 'dark';
export type ShareBackground = 'transparent' | 'soft';
export type ShareKind = 'workout' | 'recovery' | 'today' | 'weekly';

export type ShareMetric = {
  key: string;
  label: string;
  value: string;
  unit?: string;
};

export type ShareComposition = {
  kind: ShareKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  hero?: { value: string; unit?: string; label?: string };
  metrics: ShareMetric[];
  callout?: { eyebrow: string; title: string; detail?: string };
  meta?: string;
  accent: 'teal' | 'blue' | 'amber';
  flow: 'movement' | 'rest' | 'balance' | 'progress';
  accessibleDescription: string;
};

export interface WorkoutShareData {
  title: string;
  type?: SportType;
  distanceKm?: number;
  durationSeconds: number;
  paceFormatted?: string;
  avgHeartRateBpm?: number;
  caloriesKcal?: number;
  elevationMeters?: number;
  loadScore?: number;
  dateStr?: string;
  isStrength?: boolean;
}

export function workoutShareComposition(data: WorkoutShareData, selected: WorkoutMetricKey[]): ShareComposition {
  const sportType = data.type ?? (data.isStrength ? 'strength' : 'workout');
  const available = getAvailableWorkoutMetrics({
    sportType,
    distanceKm: data.distanceKm,
    durationSeconds: data.durationSeconds,
    pace: data.paceFormatted,
    averageHeartRate: data.avgHeartRateBpm,
    caloriesKcal: data.caloriesKcal,
    elevationMeters: data.elevationMeters,
    loadScore: data.loadScore,
  });
  const metrics = available.filter((metric) => selected.includes(metric.key)).slice(0, 3);
  const hero = metrics[0] ? { value: metrics[0].value, unit: metrics[0].unit, label: metrics[0].label } : undefined;
  return {
    kind: 'workout',
    eyebrow: sportLabel(sportType),
    title: data.title,
    hero,
    metrics: metrics.slice(1),
    meta: data.dateStr,
    accent: sportType === 'strength' ? 'amber' : 'teal',
    flow: 'movement',
    accessibleDescription: `${data.title}${hero ? `, ${hero.label} ${hero.value}${hero.unit ? ` ${hero.unit}` : ''}` : ''}`,
  };
}

export function recoveryShareComposition(context: CoachContext, energy?: EnergyReserve | null): ShareComposition {
  const recovery = context.recoverySystem;
  const scoreAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  const score = scoreAvailable ? Math.round(recovery.overallScore) : null;
  const sleepScore = recovery.sleepPerformance.state !== 'unscorable' ? Math.round(recovery.sleepPerformance.score) : null;
  const metrics: ShareMetric[] = [];
  if (sleepScore != null) metrics.push({ key: 'sleep', label: 'Sleep', value: `${sleepScore}`, unit: '/100' });
  if (Number.isFinite(recovery.strain.score)) metrics.push({ key: 'strain', label: 'Strain', value: recovery.strain.score.toFixed(1), unit: '/21' });
  if (energy?.available && energy.score != null) metrics.push({ key: 'energy', label: 'Energy', value: `${energy.score}`, unit: '/100' });
  return {
    kind: 'recovery',
    eyebrow: 'Recovery Today',
    title: score != null ? recovery.overallLabel : 'Waiting For Fresh Data',
    subtitle: score != null ? 'Your body signals, made easier to read.' : 'Sync the latest overnight data before using today\'s score.',
    hero: score != null ? { value: `${score}`, unit: '/100', label: 'Recovery' } : undefined,
    metrics: metrics.slice(0, 3),
    meta: formatToday(context.todayDate),
    accent: score != null && score < 67 ? 'amber' : 'teal',
    flow: 'rest',
    accessibleDescription: score != null ? `Recovery ${score} out of 100, ${recovery.overallLabel}` : 'Recovery is waiting for fresh data',
  };
}

export function todayShareComposition(context: CoachContext, energy?: EnergyReserve | null): ShareComposition {
  const planned = getTodayPlannedWorkout(context);
  const planStatus = getTodayTrainingPlanStatus(context, planned);
  const recommendation = buildAdaptiveTrainingRecommendation(context, planned);
  const brief = buildTodayBrief(context, { planned, recommendation, planStatus });
  const metrics: ShareMetric[] = [];
  const recovery = context.recoverySystem;
  if (recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating') {
    metrics.push({ key: 'recovery', label: 'Recovery', value: `${Math.round(recovery.overallScore)}`, unit: '/100' });
  }
  if (recovery.sleepPerformance.state !== 'unscorable') {
    metrics.push({ key: 'sleep', label: 'Sleep', value: `${Math.round(recovery.sleepPerformance.score)}`, unit: '/100' });
  }
  if (energy?.available && energy.score != null) metrics.push({ key: 'energy', label: 'Energy', value: `${energy.score}`, unit: '/100' });
  return {
    kind: 'today',
    eyebrow: 'Body Status Today',
    title: brief.readiness.title,
    subtitle: brief.limiter.title,
    metrics: metrics.slice(0, 3),
    callout: { eyebrow: 'One Useful Move', title: brief.action.title, detail: brief.action.summary },
    meta: formatToday(context.todayDate),
    accent: recovery.overallScore < 67 ? 'amber' : 'teal',
    flow: 'balance',
    accessibleDescription: `${brief.readiness.title}. ${brief.limiter.title}. ${brief.action.title}.`,
  };
}

export function weeklyShareComposition(data: WeeklyRecapHighlights): ShareComposition {
  const metrics: ShareMetric[] = [];
  if (data.sessions > 0) metrics.push({ key: 'sessions', label: 'Sessions', value: `${data.sessions}` });
  if (data.distanceKm > 0) metrics.push({ key: 'distance', label: 'Distance', value: data.distanceKm.toFixed(1), unit: 'km' });
  if (data.activeMinutes > 0) metrics.push({ key: 'active-time', label: 'Active Time', value: formatMinutes(data.activeMinutes) });
  if (data.adherencePlanned > 0) metrics.push({ key: 'adherence', label: 'Plan Follow-Through', value: `${data.adherencePercentage}%` });
  const hero = data.recoveryAverage != null
    ? { value: `${data.recoveryAverage}`, unit: '/100', label: 'Average Recovery' }
    : metrics[0] ? { value: metrics[0].value, unit: metrics[0].unit, label: metrics[0].label } : undefined;
  const heroKey = data.recoveryAverage != null ? null : metrics[0]?.key;
  return {
    kind: 'weekly',
    eyebrow: data.period === 'month' ? 'Month In Motion' : 'Week In Motion',
    title: data.recoveryInsightTitle || data.periodTitle,
    subtitle: data.recoveryInsightSummary || undefined,
    hero,
    metrics: metrics.filter((metric) => metric.key !== heroKey).slice(0, 3),
    meta: data.dateRangeLabel,
    accent: 'blue',
    flow: 'progress',
    accessibleDescription: `${data.periodTitle}, ${data.dateRangeLabel}, ${metrics.map((metric) => `${metric.label} ${metric.value}`).join(', ')}`,
  };
}

function sportLabel(sport: SportType): string {
  if (sport === 'running') return 'Run Complete';
  if (sport === 'walking') return 'Walk Complete';
  if (sport === 'cycling') return 'Ride Complete';
  if (sport === 'strength') return 'Strength Complete';
  if (sport === 'swimming') return 'Swim Complete';
  return 'Workout Complete';
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatToday(date: string): string {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(parsed);
}
