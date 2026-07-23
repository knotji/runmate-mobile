import type { LocalHistoryItem } from '@/lib/localHistory';

export type HealthSyncCounts = {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
};

export function classifyHealthSyncItems(incoming: LocalHistoryItem[], existing: LocalHistoryItem[]): HealthSyncCounts {
  const byId = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const previous = byId.get(item.id);
    if (!previous) added += 1;
    else if (syncFingerprint(previous) === syncFingerprint(item)) unchanged += 1;
    else updated += 1;
  }
  return { added, updated, unchanged, failed: 0 };
}

export function selectChangedHealthSyncItems(incoming: LocalHistoryItem[], existing: LocalHistoryItem[]): LocalHistoryItem[] {
  const byId = new Map(existing.map((item) => [item.id, item]));
  return incoming.filter((item) => {
    const previous = byId.get(item.id);
    return !previous || syncFingerprint(previous) !== syncFingerprint(item);
  });
}

function syncFingerprint(item: LocalHistoryItem): string {
  const data = record(item.data);
  return JSON.stringify({
    type: item.type,
    dateKey: item.dateKey ?? data.dateKey ?? null,
    recordedAt: item.recordedAt ?? data.recordedAt ?? null,
    extracted: data.extracted ?? null,
    sourceId: data.sourceId ?? null,
    platformId: data.platformId ?? null,
    workoutStartTime: data.workoutStartTime ?? null,
    workoutEndTime: data.workoutEndTime ?? null,
    heartRateSamples: normalizeHeartRateSamples(data.heartRateSamples),
    healthConnect: data.healthConnect ?? null,
  });
}

function normalizeHeartRateSamples(value: unknown): Array<{ at: string; bpm: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((sample) => {
      const row = record(sample);
      return {
        at: typeof row.at === 'string' ? row.at : '',
        bpm: typeof row.bpm === 'number' && Number.isFinite(row.bpm) ? Math.round(row.bpm) : 0,
      };
    })
    .filter((sample) => sample.at && sample.bpm >= 30 && sample.bpm <= 260)
    .sort((a, b) => a.at.localeCompare(b.at));
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
