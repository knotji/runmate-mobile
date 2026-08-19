// Real (only) data for the You Next prototype. Unlike Today/Health/Move,
// You has no mock mode — it's inherently personal, so it either reads the
// signed-in account's real context (read-only, same builders the shipped
// app already uses) or shows an honest empty/signed-out state. Never
// fabricates a goal, context value, or check-in.
import { supabase } from '@/lib/supabaseClient';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { getTodayPlannedWorkout, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import { loadDailyStrainCheckIn, type EnvironmentContext, type StressLevel } from '@/lib/strainContext';

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

export type RealYouResult =
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | { status: 'ready'; focus: YouFocus; context: YouContextItem[]; checkIn: YouCheckIn };

const STRESS_LABEL: Record<StressLevel, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
const ENVIRONMENT_LABEL: Record<EnvironmentContext, string> = { normal: 'Normal', hot_humid: 'Hot & Humid', indoor: 'Indoor' };

function formatRaceDate(raceDate: string | null): string | null {
  if (!raceDate) return null;
  const parsed = new Date(`${raceDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return raceDate;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
}

export async function loadRealYouData(): Promise<RealYouResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'unauthenticated' };

  try {
    const context = await buildCoachContextFromSupabase({});

    const focus: YouFocus = context.activeRaceStatus === 'none' || !context.raceName
      ? {
          title: 'No Goal Set',
          detail: 'Set a race or running goal so WholeMate can shape guidance around it.',
          ctaLabel: 'Set A Goal',
          ctaPath: '/race-goal',
        }
      : {
          title: context.raceName,
          detail: [context.raceDistance, formatRaceDate(context.raceDate)].filter(Boolean).join(' · ') || 'Active goal',
          ctaLabel: 'View Goal',
          ctaPath: '/race-goal',
        };

    const planned = getTodayPlannedWorkout(context);
    const restDay = isRestDayWorkout(planned);
    const planLabel = !planned
      ? 'No Session Scheduled'
      : restDay
        ? 'Rest Day'
        : [planned.workoutType, planned.distanceKm != null ? `${planned.distanceKm} km` : null, planned.durationMin != null ? `${planned.durationMin} min` : null]
            .filter(Boolean)
            .join(' · ');

    const contextItems: YouContextItem[] = [
      { label: 'Today’s Plan', value: planLabel, tone: 'default', path: '/weekly-plan' },
      {
        label: 'Pain Status',
        value: context.activePain && context.latestPain ? `${context.latestPain.painLocation} · ${context.latestPain.painLevel}/10` : 'None Reported',
        tone: context.activePain ? 'caution' : 'default',
        path: '/pain-trends',
      },
    ];
    if (context.latestBody?.weightKg != null) {
      contextItems.push({ label: 'Body Weight', value: `${context.latestBody.weightKg} kg`, tone: 'default', path: '/body-weight-trend' });
    }
    if (context.activeSick) {
      contextItems.push({ label: 'Health Status', value: 'Sick Check-In Active', tone: 'caution' });
    }

    const dailyCheckIn = loadDailyStrainCheckIn(context.todayDate);
    const checkIn: YouCheckIn = {
      hasCheckIn: dailyCheckIn.stress != null || dailyCheckIn.environment != null,
      stress: dailyCheckIn.stress ? STRESS_LABEL[dailyCheckIn.stress] : null,
      environment: dailyCheckIn.environment ? ENVIRONMENT_LABEL[dailyCheckIn.environment] : null,
    };

    return { status: 'ready', focus, context: contextItems, checkIn };
  } catch (error) {
    console.error('[wholemate-next] real You data load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your real data.' };
  }
}
