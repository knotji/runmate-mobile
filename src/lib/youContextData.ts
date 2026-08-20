// "Your Focus / Your Context / Today's Check-In" — the personal-context
// section added above You's settings list. Read-only, reuses the exact
// production functions the shipped app already calls (getTodayPlannedWorkout,
// isRestDayWorkout, loadDailyStrainCheckIn) so this can never invent a
// goal/context/check-in value. Ported from the validated
// src/labs/wholemate-next/realYou.ts prototype.
import { supabase } from './supabaseClient';
import { buildCoachContextFromSupabase } from './coachContextService';
import { getTodayPlannedWorkout, isRestDayWorkout } from './todayTrainingPlan';
import { loadDailyStrainCheckIn, type DailyStrainCheckIn, type EnvironmentContext, type StressLevel } from './strainContext';
import type { CoachContext } from './buildCoachContext';
import type { WeekWorkout } from '@/types/race';

export interface YouFocus {
  title: string;
  detail: string;
  ctaLabel: string;
  ctaPath: string;
}

export interface YouContextItem {
  label: string;
  value: string;
  tone: 'default' | 'caution';
  path?: string;
}

export interface YouCheckIn {
  hasCheckIn: boolean;
  stress: string | null;
  environment: string | null;
}

export interface YouContextData {
  focus: YouFocus;
  context: YouContextItem[];
  checkIn: YouCheckIn;
}

const STRESS_LABEL: Record<StressLevel, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
const ENVIRONMENT_LABEL: Record<EnvironmentContext, string> = { normal: 'Normal', hot_humid: 'Hot & Humid', indoor: 'Indoor' };

function formatRaceDate(raceDate: string | null): string | null {
  if (!raceDate) return null;
  const parsed = new Date(`${raceDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return raceDate;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

/**
 * Truly pure — every input is a value the caller already loaded, no I/O of
 * any kind happens in here (not even a synchronous localStorage read).
 * `plannedWorkout` and `checkIn` are passed in rather than fetched inside so
 * this function can be unit tested with plain fixtures and so
 * `loadFreshYouContextData` stays the single place that knows how each
 * piece is actually loaded.
 */
export function assembleYouContext(input: {
  coachContext: CoachContext;
  plannedWorkout: WeekWorkout | null;
  checkIn: DailyStrainCheckIn;
}): YouContextData {
  const { coachContext, plannedWorkout, checkIn: dailyCheckIn } = input;

  const focus: YouFocus = coachContext.activeRaceStatus === 'none' || !coachContext.raceName
    ? {
        title: 'No Goal Set',
        detail: 'Set a race or running goal so WholeMate can shape guidance around it.',
        ctaLabel: 'Set A Goal',
        ctaPath: '/race-goal',
      }
    : {
        title: coachContext.raceName,
        detail: [coachContext.raceDistance, formatRaceDate(coachContext.raceDate)].filter(Boolean).join(' · ') || 'Active goal',
        ctaLabel: 'View Goal',
        ctaPath: '/race-goal',
      };

  const restDay = isRestDayWorkout(plannedWorkout);
  const planLabel = !plannedWorkout
    ? 'No Session Scheduled'
    : restDay
      ? 'Rest Day'
      : [plannedWorkout.workoutType, plannedWorkout.distanceKm != null ? `${plannedWorkout.distanceKm} km` : null, plannedWorkout.durationMin != null ? `${plannedWorkout.durationMin} min` : null]
          .filter(Boolean)
          .join(' · ');

  const contextItems: YouContextItem[] = [
    { label: 'Today’s Plan', value: planLabel, tone: 'default', path: '/weekly-plan' },
    {
      label: 'Pain Status',
      value: coachContext.activePain && coachContext.latestPain ? `${coachContext.latestPain.painLocation} · ${coachContext.latestPain.painLevel}/10` : 'None Reported',
      tone: coachContext.activePain ? 'caution' : 'default',
      path: '/pain-trends',
    },
  ];
  if (coachContext.latestBody?.weightKg != null) {
    contextItems.push({ label: 'Body Weight', value: `${coachContext.latestBody.weightKg} kg`, tone: 'default', path: '/body-weight-trend' });
  }
  if (coachContext.activeSick) {
    contextItems.push({ label: 'Health Status', value: 'Sick Check-In Active', tone: 'caution' });
  }

  const checkIn: YouCheckIn = {
    hasCheckIn: dailyCheckIn.stress != null || dailyCheckIn.environment != null,
    stress: dailyCheckIn.stress ? STRESS_LABEL[dailyCheckIn.stress] : null,
    environment: dailyCheckIn.environment ? ENVIRONMENT_LABEL[dailyCheckIn.environment] : null,
  };

  return { focus, context: contextItems, checkIn };
}

export type YouContextResult =
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: YouContextData };

export async function loadFreshYouContextData(): Promise<YouContextResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'unauthenticated' };

  try {
    const coachContext = await buildCoachContextFromSupabase({});
    const plannedWorkout = getTodayPlannedWorkout(coachContext);
    const checkIn = loadDailyStrainCheckIn(coachContext.todayDate);
    return { status: 'ready', data: assembleYouContext({ coachContext, plannedWorkout, checkIn }) };
  } catch (error) {
    console.error('[you-context] load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your context.' };
  }
}
