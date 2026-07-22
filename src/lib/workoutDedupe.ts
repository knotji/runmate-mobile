import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import {
  historyRecordTimestamp,
  isUserCorrectedField,
  reconciliationSourceLabel,
  reconciliationSourceRank,
} from '@/lib/reconciliationPolicy';

export type MergedWorkoutItem = LocalHistoryItem & {
  mergedFromDuplicates?: boolean;
  reconciledSources?: string[];
  sourceRecordIds?: string[];
  fieldSources?: Record<string, string>;
};

const DEVICE_FIELDS = new Set([
  'date', 'workoutKind', 'distanceKm', 'duration', 'avgPace', 'maxPace', 'avgSpeedKmh', 'maxSpeedKmh',
  'avgHR', 'maxHR', 'calories', 'cadence', 'maxCadence', 'steps', 'elevationGain', 'vo2Max',
  'distanceM', 'poolLengthM', 'totalLengths', 'totalStrokes', 'avgSwolf', 'bestSwolf',
]);

export function dedupeWorkoutItems(items: LocalHistoryItem[]): MergedWorkoutItem[] {
  const groups: LocalHistoryItem[][] = [];
  for (const item of items) {
    const group = groups.find((candidate) => candidate.some((existing) => sameSession(existing, item)));
    if (group) group.push(item); else groups.push([item]);
  }
  return groups.map(mergeGroup).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function mergeGroup(group: LocalHistoryItem[]): MergedWorkoutItem {
  if (group.length === 1) return group[0];
  const primary = [...group].sort((a, b) => sourceRank(b) - sourceRank(a) || historyRecordTimestamp(b) - historyRecordTimestamp(a))[0];
  const keys = new Set(group.flatMap((item) => Object.keys(extracted(item))));
  const mergedExtracted: Record<string, unknown> = {};
  const fieldSources: Record<string, string> = {};
  for (const key of keys) {
    const ordered = [...group].sort((a, b) => fieldRank(b, key) - fieldRank(a, key) || historyRecordTimestamp(b) - historyRecordTimestamp(a));
    const selected = ordered.find((item) => meaningful(extracted(item)[key]));
    if (selected) {
      mergedExtracted[key] = extracted(selected)[key];
      fieldSources[key] = isUserCorrectedField(selected, key) ? 'User Corrected' : sourceLabel(selected);
    }
  }
  const coachSource = [...group].sort((a, b) => coachScore(b) - coachScore(a))[0];
  const sourceSet = new Set(group.map(sourceLabel));
  const reconciledSources = ['Samsung Health', 'Strava', 'Structured Import', 'Upload'].filter((source) => sourceSet.has(source));
  return {
    ...primary,
    data: {
      ...record(primary.data),
      extracted: mergedExtracted,
      coach: record(coachSource.data).coach ?? record(primary.data).coach,
      reconciliation: { canonical: true, sources: reconciledSources, fieldSources, sourceRecordIds: group.map((item) => item.id) },
    },
    mergedFromDuplicates: true,
    reconciledSources,
    sourceRecordIds: group.map((item) => item.id),
    fieldSources,
  };
}

function sameSession(a: LocalHistoryItem, b: LocalHistoryItem): boolean {
  if (getHistoryItemDateKey(a) !== getHistoryItemDateKey(b)) return false;
  const aExt = extracted(a); const bExt = extracted(b);
  const aKind = normalizedKind(a, aExt); const bKind = normalizedKind(b, bExt);
  if (!compatibleKind(aKind, bKind)) return false;
  const aStart = workoutStart(a); const bStart = workoutStart(b);
  if (aStart != null && bStart != null) return Math.abs(aStart - bStart) <= 10 * 60_000;
  const aDuration = durationMinutes(aExt.duration); const bDuration = durationMinutes(bExt.duration);
  if (aDuration == null || bDuration == null) return false;
  if (Math.abs(aDuration - bDuration) > Math.max(5, Math.max(aDuration, bDuration) * 0.15)) return false;
  const aDistance = numeric(aExt.distanceKm) ?? metersToKm(aExt.distanceM);
  const bDistance = numeric(bExt.distanceKm) ?? metersToKm(bExt.distanceM);
  return aDistance == null || bDistance == null || Math.abs(aDistance - bDistance) <= Math.max(0.2, Math.max(aDistance, bDistance) * 0.1);
}

function compatibleKind(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  // Older image analyses often used `other` even when the screenshot clearly
  // represented a swim or strength session. In that case duration/distance
  // below are the safer reconciliation signals than the legacy AI label.
  if (a === 'other' || b === 'other') return true;
  return new Set([a, b]).size === 2 && ['outdoor_run', 'treadmill'].includes(a) && ['outdoor_run', 'treadmill'].includes(b);
}

function normalizedKind(item: LocalHistoryItem, ext: Record<string, unknown>): string | null {
  const kind = text(ext.workoutKind)?.trim().toLowerCase();
  if (kind && kind !== 'workout') return kind;
  if (item.type === 'strength') return 'strength';
  const name = text(ext.workoutName)?.toLowerCase() ?? '';
  if (/swim|pool|ว่าย/.test(name)) return 'swimming';
  if (/strength|weight|circuit|resistance|เวท/.test(name)) return 'strength';
  if (/treadmill|ลู่/.test(name)) return 'treadmill';
  if (/run|running|วิ่ง/.test(name)) return 'outdoor_run';
  if (/walk|walking|เดิน/.test(name)) return 'walk';
  return kind || null;
}

function sourceRank(item: LocalHistoryItem): number { return reconciliationSourceRank(item); }
function fieldRank(item: LocalHistoryItem, field: string): number {
  if (isUserCorrectedField(item, field)) return 10_000 + completeness(item);
  return DEVICE_FIELDS.has(field) ? sourceRank(item) * 100 + completeness(item) : completeness(item);
}
function completeness(item: LocalHistoryItem): number { return Object.values(extracted(item)).filter(meaningful).length; }
function coachScore(item: LocalHistoryItem): number { return Object.values(record(record(item.data).coach)).filter(meaningful).length; }
function sourceLabel(item: LocalHistoryItem): string {
  const label = reconciliationSourceLabel(item);
  return label === 'Manual Upload' || label === 'Manual Entry' ? 'Upload' : label;
}
function extracted(item: LocalHistoryItem): Record<string, unknown> { return record(record(item.data).extracted); }
function workoutStart(item: LocalHistoryItem): number | null { const value = record(item.data).workoutStartTime; const parsed = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function durationMinutes(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  const parts = normalized.split(':').map(Number);
  if (parts.length >= 2 && parts.every(Number.isFinite)) return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
  const hours = Number(normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/)?.[1] ?? 0);
  const minutes = Number(normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute)/)?.[1] ?? 0);
  return hours || minutes ? hours * 60 + minutes : null;
}
function metersToKm(value: unknown): number | null { const number = numeric(value); return number == null ? null : number / 1000; }
function numeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function text(value: unknown): string | null { return typeof value === 'string' && value ? value : null; }
function meaningful(value: unknown): boolean { return value !== null && value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0); }
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
