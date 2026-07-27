import type { LocalHistoryItem } from '@/lib/localHistory';

const MAX_AGE_MS = 5 * 60 * 1000;

type WeeklySummaryHistorySnapshot = {
  savedAt: number;
  items: LocalHistoryItem[];
};

let snapshot: WeeklySummaryHistorySnapshot | null = null;

export function loadWeeklySummaryHistorySnapshot(now = Date.now()): LocalHistoryItem[] | null {
  if (!snapshot || now - snapshot.savedAt > MAX_AGE_MS) return null;
  return snapshot.items;
}

export function saveWeeklySummaryHistorySnapshot(items: LocalHistoryItem[], now = Date.now()): void {
  snapshot = { savedAt: now, items };
}

export function clearWeeklySummaryHistorySnapshot(): void {
  snapshot = null;
}
