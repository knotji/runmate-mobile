import type { LocalHistoryItem } from '@/lib/localHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';

export const ACTIVITY_RECENT_LOOKBACK_DAYS = 45;
export const ACTIVITY_RECENT_ROW_LIMIT = 700;

export function prepareActivityHistoryItems(items: LocalHistoryItem[]): LocalHistoryItem[] {
  const sleep = dedupeSleepItems(items.filter((item) => item.type === 'sleep'));
  const workouts = dedupeWorkoutItems(items.filter((item) => item.type === 'workout' || item.type === 'strength'));
  return [
    ...items.filter((item) => item.type !== 'sleep' && item.type !== 'workout' && item.type !== 'strength'),
    ...sleep,
    ...workouts,
  ];
}

export function mergeActivityHistoryItems(current: LocalHistoryItem[], incoming: LocalHistoryItem[]): LocalHistoryItem[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return prepareActivityHistoryItems([...byId.values()]);
}

export function activityRecentHistoryOptions(now = Date.now()) {
  return {
    limit: ACTIVITY_RECENT_ROW_LIMIT,
    createdAfter: new Date(now - ACTIVITY_RECENT_LOOKBACK_DAYS * 86_400_000).toISOString(),
  };
}
