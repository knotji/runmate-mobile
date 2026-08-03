export type HistoryType = "sleep" | "meal" | "workout" | "body" | "summary" | "pain" | "strength" | "strength_template" | "health_check" | "sick";

export type LocalHistoryItem = {
  id: string;
  type: HistoryType;
  createdAt: string;
  recordedAt?: string;
  dateKey?: string;
  source?: {
    provider: "samsung_health" | "garmin_connect" | "apple_health" | "strava" | "generic_csv" | "generic_image" | "manual";
    importType: "image" | "csv" | "pdf" | "manual" | "health_connect";
    originalFileName?: string;
    detectedFormat?: string;
    importedAt: string;
    confidence?: number;
    missingFields?: string[];
  };
  data: unknown;
};

export function isHealthConnectImportedItem(item: LocalHistoryItem): boolean {
  return item.source?.importType === "health_connect";
}

export function isHiddenFromRunMateData(data: unknown): boolean {
  return Boolean(data && typeof data === "object" && (data as Record<string, unknown>).hiddenFromRunMate === true);
}
