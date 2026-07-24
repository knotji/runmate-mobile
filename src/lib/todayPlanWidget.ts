import { Capacitor, registerPlugin } from '@capacitor/core';
import type { CoachContext } from '@/lib/buildCoachContext';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus, isRestDayWorkout, translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';

export type TodayPlanWidgetStatus = 'no_plan' | 'rest' | 'pending' | 'completed' | 'logged_different';
export type TodayPlanWidgetRecoveryZone = 'low' | 'fair' | 'good';

export type TodayPlanWidgetData = {
  date: string;
  workoutType: string | null;
  description: string | null;
  distanceKm: number | null;
  pace: string | null;
  status: TodayPlanWidgetStatus;
  recoveryScore: number | null;
  recoveryZone: TodayPlanWidgetRecoveryZone | null;
};

interface TodayPlanWidgetNativePlugin {
  updateTodayPlan(options: { planJson: string }): Promise<void>;
}

const TodayPlanWidget = registerPlugin<TodayPlanWidgetNativePlugin>('TodayPlanWidget');

export function buildTodayPlanWidgetData(context: CoachContext): TodayPlanWidgetData {
  const { recoveryScore, recoveryZone } = buildRecoveryFields(context);
  const planned = getTodayPlannedWorkout(context);
  if (!planned) {
    return { date: context.todayDate, workoutType: null, description: null, distanceKm: null, pace: null, status: 'no_plan', recoveryScore, recoveryZone };
  }
  if (isRestDayWorkout(planned)) {
    return { date: context.todayDate, workoutType: 'Rest Day', description: null, distanceKm: null, pace: null, status: 'rest', recoveryScore, recoveryZone };
  }

  const status = getTodayTrainingPlanStatus(context, planned);
  const description = planned.description || planned.workoutType
    ? translatePlanFieldToEnglish(planned.description || planned.workoutType)
    : null;

  return {
    date: context.todayDate,
    workoutType: planned.workoutType ?? null,
    description: description && description !== planned.workoutType ? description : null,
    distanceKm: planned.distanceKm ?? null,
    pace: planned.targetPace ? translatePlanFieldToEnglish(planned.targetPace) : null,
    status,
    recoveryScore,
    recoveryZone,
  };
}

function buildRecoveryFields(context: CoachContext): { recoveryScore: number | null; recoveryZone: TodayPlanWidgetRecoveryZone | null } {
  const recovery = context.recoverySystem;
  const scorable = recovery != null && (recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating');
  if (!scorable) return { recoveryScore: null, recoveryZone: null };
  const zone: TodayPlanWidgetRecoveryZone = recovery.overallLabel === 'Low' ? 'low' : recovery.overallLabel === 'Fair' ? 'fair' : 'good';
  return { recoveryScore: recovery.overallScore, recoveryZone: zone };
}

/** Best-effort: keeps the Android home-screen widget in sync with today's plan. No-op off native Android. */
export async function pushTodayPlanToWidget(context: CoachContext): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  try {
    const data = buildTodayPlanWidgetData(context);
    await TodayPlanWidget.updateTodayPlan({ planJson: JSON.stringify(data) });
  } catch {
    // The widget is a convenience surface; a failed push should never affect the app.
  }
}
