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

export async function loadHealthCalendarHistory(
  loadPage: HistoryPageLoader = loadHistoryItems,
): Promise<HealthCalendarHistoryResult> {
  const items: LocalHistoryItem[] = [];

  for (let offset = 0; offset < HEALTH_CALENDAR_MAX_ROWS; offset += HEALTH_CALENDAR_PAGE_SIZE) {
    const result = await loadPage(CALENDAR_TYPES, { limit: HEALTH_CALENDAR_PAGE_SIZE, offset });
    if (!result.ok) return result;
    items.push(...result.items);
    if (result.items.length < HEALTH_CALENDAR_PAGE_SIZE) {
      return { ok: true, items: dedupeById(items), limited: false };
    }
  }

  return { ok: true, items: dedupeById(items), limited: true };
}

function dedupeById(items: LocalHistoryItem[]): LocalHistoryItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}
