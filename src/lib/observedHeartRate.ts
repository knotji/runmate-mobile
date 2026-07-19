import type { LocalHistoryItem } from '@/lib/localHistory';

export type ObservedHeartRate = { bpm: number; recordedAt?: string };

export function findHighestObservedHeartRate(items: LocalHistoryItem[]): ObservedHeartRate | null {
  let highest: ObservedHeartRate | null = null;
  for (const item of items) {
    if (item.type !== 'workout' && item.type !== 'strength') continue;
    const data = asRecord(item.data);
    const extracted = asRecord(data.extracted);
    const candidate = numberValue(extracted.maxHR ?? extracted.maxHr ?? data.maxHR ?? data.maxHr);
    if (candidate == null || candidate < 60 || candidate > 240) continue;
    if (!highest || candidate > highest.bpm) highest = { bpm: Math.round(candidate), recordedAt: item.recordedAt ?? item.createdAt };
  }
  return highest;
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function numberValue(value: unknown): number | null { const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
