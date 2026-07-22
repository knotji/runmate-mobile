import type { LocalHistoryItem } from '@/lib/localHistory';

export type ReconciliationSourceKind = 'health_connect' | 'structured_import' | 'manual_upload' | 'manual_entry';

export type ReviewReconciliationInput = {
  reviewedAt: string;
  userCorrectedFields: string[];
};

export function reconciliationSourceKind(item: LocalHistoryItem): ReconciliationSourceKind {
  if (item.source?.importType === 'health_connect') return 'health_connect';
  if (item.source?.importType === 'csv' || item.source?.provider === 'garmin_connect' || item.source?.provider === 'apple_health') return 'structured_import';
  if (item.source?.provider === 'manual' || item.source?.importType === 'manual') return 'manual_entry';
  return 'manual_upload';
}

export function reconciliationSourceLabel(item: LocalHistoryItem): string {
  if (item.source?.provider === 'samsung_health') return 'Samsung Health';
  if (item.source?.provider === 'strava') return 'Strava';
  const kind = reconciliationSourceKind(item);
  if (kind === 'structured_import') return 'Structured Import';
  if (kind === 'manual_entry') return 'Manual Entry';
  return 'Manual Upload';
}

export function reconciliationSourceRank(item: LocalHistoryItem): number {
  const kind = reconciliationSourceKind(item);
  if (kind === 'health_connect') return 3;
  if (kind === 'structured_import') return 2;
  return 1;
}

export function historyRecordTimestamp(item: LocalHistoryItem): number {
  const importedAt = item.source?.importedAt ? Date.parse(item.source.importedAt) : Number.NaN;
  if (Number.isFinite(importedAt)) return importedAt;
  const createdAt = Date.parse(item.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

export function userCorrectedFields(item: LocalHistoryItem): ReadonlySet<string> {
  const input = record(record(item.data).reconciliationInput);
  const fields = Array.isArray(input.userCorrectedFields)
    ? input.userCorrectedFields.filter((field): field is string => typeof field === 'string' && Boolean(field.trim()))
    : [];
  return new Set(fields);
}

export function isUserCorrectedField(item: LocalHistoryItem, field: string): boolean {
  const corrected = userCorrectedFields(item);
  if (corrected.has(field)) return true;
  if ((field === 'actualSleepDurationMinutes' || field === 'actualSleepDurationText') && corrected.has('sleepDuration')) return true;
  return false;
}

export function buildReviewReconciliationInput(
  original: Record<string, unknown>,
  reviewed: Record<string, unknown>,
  fields: readonly string[],
  reviewedAt = new Date().toISOString(),
): ReviewReconciliationInput {
  const userCorrectedFields = [...new Set(fields)].filter((field) => !sameValue(original[field], reviewed[field]));
  return { reviewedAt, userCorrectedFields };
}

function sameValue(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
