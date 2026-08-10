import type { LocalHistoryItem } from './localHistory';

const MAX_AGE_MS = 5 * 60 * 1000;

type HealthCalendarSnapshot = {
  savedAt: number;
  items: LocalHistoryItem[];
};

let snapshot: HealthCalendarSnapshot | null = null;

export function loadHealthCalendarSnapshot(now = Date.now()): LocalHistoryItem[] | null {
  if (!snapshot || now - snapshot.savedAt > MAX_AGE_MS) return null;
  return snapshot.items;
}

export function saveHealthCalendarSnapshot(items: LocalHistoryItem[], now = Date.now()): void {
  snapshot = { savedAt: now, items };
}

export function clearHealthCalendarSnapshot(): void {
  snapshot = null;
}
