import type { LocalHistoryItem } from '@/lib/localHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import type { CloudHistoryUpdateDetail } from '@/lib/cloudHistory';

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

export function uploadedActivityDateFromEvent(event: Event): string | null {
  const detail = (event as CustomEvent<CloudHistoryUpdateDetail>).detail;
  if (detail?.action !== 'save') return null;
  const uploadedItem = detail.savedItems?.find((item) => item.provider === 'generic_image' && /^\d{4}-\d{2}-\d{2}$/.test(item.dateKey ?? ''));
  return uploadedItem?.dateKey ?? null;
}
