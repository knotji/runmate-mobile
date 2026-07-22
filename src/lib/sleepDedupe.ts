import type { LocalHistoryItem } from "@/lib/localHistory";
import type { SleepAnalysis } from "@/types/logs";
import { getHistoryItemDateKey } from "@/lib/date";
import { historyRecordTimestamp, isUserCorrectedField } from "@/lib/reconciliationPolicy";

export type MergedSleepItem = LocalHistoryItem & {
  mergedFromDuplicates?: boolean;
  duplicateCount?: number;
  sourceRecordIds?: string[];
  reconciledSources?: string[];
  fieldSources?: Record<string, string>;
};

type SleepSourceKind = "samsung_health" | "structured" | "manual_upload";

const DEVICE_MEASURED_FIELDS = new Set([
  "actualSleepDurationMinutes", "actualSleepDurationText", "sleepDuration", "sleepDurationSource",
  "timeInBedMinutes", "timeInBedText", "timeInBedDerived", "sleepStartTime", "sleepEndTime",
  "avgSleepingHeartRate", "lowestSleepingHeartRate", "sleepHeartRateTimeline", "avgSleepingHrv", "avgRespiratoryRate", "sleepLatencyMinutes",
  "restingHRSource", "sleepHeartRateSampleCount", "sleepHeartRateCoveragePercent",
  "avgSpO2Percent", "lowestSpO2Percent", "skinTemperatureDeltaC", "sleepStageMinutes",
  "sleepStageAwakeMinutes", "sleepStageRemMinutes", "sleepStageLightMinutes", "sleepStageDeepMinutes",
  "restingHR", "hrv",
]);

function getSleepExtracted(item: LocalHistoryItem): Record<string, unknown> {
  const d = item.data as { extracted?: Record<string, unknown> } | null;
  return d?.extracted ?? {};
}

function scoreSleepRecord(item: LocalHistoryItem): number {
  const ext = getSleepExtracted(item);
  const d = item.data as SleepAnalysis | null;
  let score = 0;
  if (ext.actualSleepDurationMinutes != null || ext.sleepDuration != null) score += 4;
  if (ext.sleepScore != null) score += 3;
  if (ext.energyScore != null) score += 2;
  if (ext.restingHR != null || ext.avgSleepingHeartRate != null) score += 2;
  if (ext.hrv != null || ext.avgSleepingHrv != null) score += 2;
  if (ext.sleepStageDeepMinutes != null || ext.sleepStageRemMinutes != null || ext.sleepStageMinutes != null) score += 1;
  const unclear = Array.isArray(d?.unclearFields) ? (d!.unclearFields ?? []).length : 0;
  score -= unclear * 0.1;
  return score;
}

function sleepSourceKind(item: LocalHistoryItem): SleepSourceKind {
  const data = item.data as Record<string, unknown> | null;
  const extracted = getSleepExtracted(item);
  const sourceId = String(data?.sourceId ?? extracted.sourceId ?? "");
  if (
    item.source?.provider === "samsung_health"
    || sourceId === "com.sec.android.app.shealth"
    || item.id.startsWith("healthconnect-samsung-sleep-")
  ) return "samsung_health";
  if (item.source?.importType === "csv" || item.source?.provider === "garmin_connect" || item.source?.provider === "apple_health") return "structured";
  return "manual_upload";
}

function sourceLabel(item: LocalHistoryItem): string {
  const kind = sleepSourceKind(item);
  return kind === "samsung_health" ? "Samsung Health" : kind === "structured" ? "Structured Import" : "Manual Upload";
}

function orderedForField(items: LocalHistoryItem[], field: string): LocalHistoryItem[] {
  return [...items].sort((a, b) => {
    const correctedOrder = Number(isUserCorrectedField(b, field)) - Number(isUserCorrectedField(a, field));
    if (correctedOrder) return correctedOrder;
    if (isUserCorrectedField(a, field) && isUserCorrectedField(b, field)) {
      const correctionRecency = historyRecordTimestamp(b) - historyRecordTimestamp(a);
      if (correctionRecency) return correctionRecency;
    }
    if (DEVICE_MEASURED_FIELDS.has(field)) {
      const rank = { samsung_health: 3, structured: 2, manual_upload: 1 };
      const sourceOrder = rank[sleepSourceKind(b)] - rank[sleepSourceKind(a)];
      if (sourceOrder) return sourceOrder;

      // Prefer the complete device session when Health Connect returns both a
      // short fragment and the full night. Manual screenshots are different:
      // a later upload is an explicit correction or supplement for that night.
      if (sleepSourceKind(a) !== "manual_upload") {
        const durationOrder = measuredDurationMinutes(b) - measuredDurationMinutes(a);
        if (durationOrder) return durationOrder;
      } else {
        const recencyOrder = historyRecordTimestamp(b) - historyRecordTimestamp(a);
        if (recencyOrder) return recencyOrder;
      }
    } else {
      // Sleep Score and Energy Score are normally screenshot-only values. A
      // newer non-empty upload must update an older upload for the same night.
      const manualA = sleepSourceKind(a) === "manual_upload";
      const manualB = sleepSourceKind(b) === "manual_upload";
      if (manualA && manualB) {
        const recencyOrder = historyRecordTimestamp(b) - historyRecordTimestamp(a);
        if (recencyOrder) return recencyOrder;
      }
    }
    return scoreSleepRecord(b) - scoreSleepRecord(a)
      || historyRecordTimestamp(b) - historyRecordTimestamp(a);
  });
}

function measuredDurationMinutes(item: LocalHistoryItem): number {
  const extracted = getSleepExtracted(item);
  const duration = extracted.actualSleepDurationMinutes ?? extracted.timeInBedMinutes;
  return typeof duration === "number" && Number.isFinite(duration) ? duration : 0;
}

function mergeSleepStages(items: LocalHistoryItem[], fieldSources: Record<string, string>): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  for (const stage of ["awake", "rem", "light", "deep"]) {
    const flatField = `sleepStage${stage[0].toUpperCase()}${stage.slice(1)}Minutes`;
    for (const item of orderedForField(items, flatField)) {
      const extracted = getSleepExtracted(item);
      const stages = extracted.sleepStageMinutes as Record<string, unknown> | null | undefined;
      const value = stages?.[stage] ?? extracted[flatField];
      if (value != null) {
        result[stage] = value;
        fieldSources[`sleepStageMinutes.${stage}`] = fieldSourceLabel(item, flatField);
        break;
      }
    }
  }
  return Object.keys(result).length ? result : null;
}

function mergeExtractedFields(items: LocalHistoryItem[]): { extracted: Record<string, unknown>; fieldSources: Record<string, string> } {
  const keys = new Set(items.flatMap((item) => Object.keys(getSleepExtracted(item))));
  const extracted: Record<string, unknown> = {};
  const fieldSources: Record<string, string> = {};
  for (const key of keys) {
    if (key === "sleepStageMinutes") {
      const stages = mergeSleepStages(items, fieldSources);
      if (stages) extracted[key] = stages;
      continue;
    }
    for (const item of orderedForField(items, key)) {
      const value = getSleepExtracted(item)[key];
      if (value != null) {
        extracted[key] = value;
        fieldSources[key] = fieldSourceLabel(item, key);
        break;
      }
    }
  }
  return { extracted, fieldSources };
}

function fieldSourceLabel(item: LocalHistoryItem, field: string): string {
  return isUserCorrectedField(item, field) ? "User Corrected" : sourceLabel(item);
}

function pickBestCoach(items: LocalHistoryItem[]): unknown {
  const sorted = [...items].sort((a, b) => scoreSleepRecord(b) - scoreSleepRecord(a));
  for (const item of sorted) {
    const d = item.data as { coach?: unknown } | null;
    if (d?.coach) return d.coach;
  }
  return undefined;
}

function mergeUnclearFields(items: LocalHistoryItem[]): string[] {
  const allSets = items.map((item) => {
    const d = item.data as SleepAnalysis | null;
    return new Set<string>(Array.isArray(d?.unclearFields) ? (d!.unclearFields ?? []) : []);
  });
  if (!allSets.length) return [];
  return [...allSets[0]].filter((field) => allSets.every((s) => s.has(field)));
}

function pickBestConfidence(items: LocalHistoryItem[]): SleepAnalysis["confidence"] {
  if (items.some((item) => (item.data as SleepAnalysis | null)?.confidence === "high")) return "high";
  if (items.some((item) => (item.data as SleepAnalysis | null)?.confidence === "medium")) return "medium";
  return "low";
}

export function dedupeSleepItems(items: LocalHistoryItem[]): MergedSleepItem[] {
  const groups = new Map<string, LocalHistoryItem[]>();
  for (const item of items) {
    const key = getHistoryItemDateKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const result: MergedSleepItem[] = [];
  for (const [, group] of groups) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      const rank = { samsung_health: 3, structured: 2, manual_upload: 1 };
      return rank[sleepSourceKind(b)] - rank[sleepSourceKind(a)]
        || measuredDurationMinutes(b) - measuredDurationMinutes(a)
        || scoreSleepRecord(b) - scoreSleepRecord(a);
    });
    const primary = sorted[0];
    const merged = mergeExtractedFields(group);
    const reconciledSources = [...new Set(group.map(sourceLabel))];
    result.push({
      ...primary,
      data: {
        ...(primary.data as Record<string, unknown>),
        extracted: merged.extracted,
        coach: pickBestCoach(group),
        confidence: pickBestConfidence(group),
        unclearFields: mergeUnclearFields(group),
        reconciliation: {
          canonical: true,
          sources: reconciledSources,
          fieldSources: merged.fieldSources,
          sourceRecordIds: group.map((item) => item.id),
        },
      },
      mergedFromDuplicates: true,
      duplicateCount: group.length,
      sourceRecordIds: group.map((item) => item.id),
      reconciledSources,
      fieldSources: merged.fieldSources,
    });
  }

  return result.sort((a, b) => {
    const dateOrder = getHistoryItemDateKey(b).localeCompare(getHistoryItemDateKey(a));
    return dateOrder || Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}
