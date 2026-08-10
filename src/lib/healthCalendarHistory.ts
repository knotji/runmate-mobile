import { loadHistoryItems, type HistoryLoadOptions } from './cloudHistory';
import type { HistoryType, LocalHistoryItem } from './localHistory';

const CALENDAR_TYPES: HistoryType[] = ['sleep', 'meal', 'workout', 'strength'];
export const HEALTH_CALENDAR_PAGE_SIZE = 1000;
export const HEALTH_CALENDAR_MAX_ROWS = 5000;

type HistoryPageLoader = (
  types: HistoryType[],
  options: HistoryLoadOptions,
) => Promise<{ ok: true; items: LocalHistoryItem[] } | { ok: false; error: string }>;

export type HealthCalendarHistoryResult =
  | { ok: true; items: LocalHistoryItem[]; limited: boolean }
  | { ok: false; error: string };

export type HealthCalendarRecentHistoryResult =
  | { ok: true; items: LocalHistoryItem[]; hasMore: boolean }
  | { ok: false; error: string };

export async function loadHealthCalendarRecentHistory(
  loadPage: HistoryPageLoader = loadHistoryItems,
): Promise<HealthCalendarRecentHistoryResult> {
  const result = await loadPage(CALENDAR_TYPES, { limit: HEALTH_CALENDAR_PAGE_SIZE, offset: 0 });
  if (!result.ok) return result;
  return {
    ok: true,
    items: dedupeById(result.items),
    hasMore: result.items.length === HEALTH_CALENDAR_PAGE_SIZE,
  };
}

export async function loadHealthCalendarArchiveHistory(
  recentItems: LocalHistoryItem[],
  loadPage: HistoryPageLoader = loadHistoryItems,
): Promise<HealthCalendarHistoryResult> {
  const items = [...recentItems];

  for (let offset = HEALTH_CALENDAR_PAGE_SIZE; offset < HEALTH_CALENDAR_MAX_ROWS; offset += HEALTH_CALENDAR_PAGE_SIZE) {
    const result = await loadPage(CALENDAR_TYPES, { limit: HEALTH_CALENDAR_PAGE_SIZE, offset });
    if (!result.ok) return result;
    items.push(...result.items);
    if (result.items.length < HEALTH_CALENDAR_PAGE_SIZE) {
      return { ok: true, items: dedupeById(items), limited: false };
    }
  }

  return { ok: true, items: dedupeById(items), limited: true };
}

export async function loadHealthCalendarHistory(
  loadPage: HistoryPageLoader = loadHistoryItems,
): Promise<HealthCalendarHistoryResult> {
  const recent = await loadHealthCalendarRecentHistory(loadPage);
  if (!recent.ok) return recent;
  if (!recent.hasMore) return { ok: true, items: recent.items, limited: false };
  return loadHealthCalendarArchiveHistory(recent.items, loadPage);
}

export function mergeHealthCalendarHistoryItems(
  current: LocalHistoryItem[],
  incoming: LocalHistoryItem[],
): LocalHistoryItem[] {
  return dedupeById([...current, ...incoming]);
}

function dedupeById(items: LocalHistoryItem[]): LocalHistoryItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
