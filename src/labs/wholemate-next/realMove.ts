// Optional real-data mode for the Move Next prototype — same rule as
// realToday.ts / realHealth.ts: read-only, reuses the exact builders the
// shipped Move/Race Goal pages already call.
import { supabase } from '@/lib/supabaseClient';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { getTodayPlannedWorkout, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { activityRecentHistoryOptions, sortHistoryItemsByEventTimeDesc } from '@/lib/activityHistoryLoad';
import { describeHistoryItem, activitySourceLabel } from '@/lib/activityHistoryPresentation';
import { getHistoryItemDateKey } from '@/lib/date';
import type { MoveTimelineItem, MoveTodayPlan } from './mockMove';

const TIMELINE_ROW_LIMIT = 8;

function dateLabel(dateKey: string, today: string): string {
  if (dateKey === today) return 'Today';
  const yesterday = new Date(`${today}T12:00:00+07:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

export type RealMoveResult =
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | { status: 'ready'; plan: MoveTodayPlan; timeline: MoveTimelineItem[] };

export async function loadRealMoveData(): Promise<RealMoveResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'unauthenticated' };

  try {
    const [context, historyResult] = await Promise.all([
      buildCoachContextFromSupabase({}),
      loadHistoryItems(['workout', 'strength'], activityRecentHistoryOptions()),
    ]);

    if (!historyResult.ok) {
      return { status: 'error', message: historyResult.error };
    }

    const planned = getTodayPlannedWorkout(context);
    const restDay = isRestDayWorkout(planned);
    const plan: MoveTodayPlan = planned
      ? {
          title: restDay
            ? 'Rest Day'
            : [planned.workoutType, planned.distanceKm != null ? `${planned.distanceKm} km` : null, planned.durationMin != null ? `${planned.durationMin} min` : null].filter(Boolean).join(' · '),
          detail: restDay ? 'Recovery is the plan for today.' : 'Follow the planned session for today.',
          actionLabel: restDay ? 'See Weekly Plan' : 'View Full Session',
          isRestDay: restDay,
        }
      : {
          title: 'No Plan For Today',
          detail: 'There\'s no active race plan or scheduled session for today.',
          actionLabel: 'See Weekly Plan',
          isRestDay: false,
        };

    const items = sortHistoryItemsByEventTimeDesc(historyResult.items).slice(0, TIMELINE_ROW_LIMIT);
    const today = context.todayDate;
    const timeline: MoveTimelineItem[] = items.map((item) => {
      const described = describeHistoryItem(item);
      return {
        id: item.id,
        icon: described.icon,
        label: described.label,
        title: described.title,
        detail: described.detail,
        dateLabel: dateLabel(getHistoryItemDateKey(item), today),
        source: activitySourceLabel(item),
      };
    });

    return { status: 'ready', plan, timeline };
  } catch (error) {
    console.error('[wholemate-next] real Move data load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your real data.' };
  }
}
