import { describe, expect, it } from "vitest";
import { dedupeSleepItems } from "./sleepDedupe";
import type { LocalHistoryItem } from "./localHistory";

function sleepItem(
  id: string,
  source: NonNullable<LocalHistoryItem["source"]>,
  extracted: Record<string, unknown>,
  coach?: Record<string, unknown>,
  createdAt = "2026-07-18T06:00:00.000Z",
): LocalHistoryItem {
  return {
    id,
    type: "sleep",
    createdAt,
    dateKey: "2026-07-18",
    source,
    data: { extracted, coach, confidence: "high", unclearFields: [] },
  };
}

describe("sleep reconciliation", () => {
  it("uses Samsung measured fields and preserves upload-only score and coaching", () => {
    const upload = sleepItem("sleep-upload", { provider: "generic_image", importType: "image", importedAt: "2026-07-18T06:00:00Z" }, {
      actualSleepDurationMinutes: 380,
      sleepScore: 79,
      visibleNotes: "Late bedtime",
    }, { aiSummary: "Protect tonight's bedtime" });
    const samsung = sleepItem("healthconnect-samsung-sleep-abc", { provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-18T06:05:00Z" }, {
      actualSleepDurationMinutes: 375,
      timeInBedMinutes: 430,
      sleepStageMinutes: { awake: 55, rem: 110, light: 210, deep: 55 },
    });

    const [result] = dedupeSleepItems([upload, samsung]);
    const data = result.data as { extracted: Record<string, unknown>; coach: Record<string, unknown>; reconciliation: { sources: string[] } };
    expect(result.id).toBe(samsung.id);
    expect(data.extracted.actualSleepDurationMinutes).toBe(375);
    expect(data.extracted.sleepScore).toBe(79);
    expect(data.coach.aiSummary).toBe("Protect tonight's bedtime");
    expect(data.reconciliation.sources).toEqual(["Manual Upload", "Samsung Health"]);
    expect(result.fieldSources?.actualSleepDurationMinutes).toBe("Samsung Health");
    expect(result.fieldSources?.sleepScore).toBe("Manual Upload");
  });

  it("reconciles stage fields independently without adding duplicate durations", () => {
    const upload = sleepItem("sleep-upload", { provider: "generic_image", importType: "image", importedAt: "2026-07-18T06:00:00Z" }, {
      sleepStageMinutes: { awake: 50, rem: 100, light: 200, deep: 60 },
    });
    const samsung = sleepItem("healthconnect-samsung-sleep-abc", { provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-18T06:05:00Z" }, {
      sleepStageMinutes: { awake: 55, rem: 111, light: 213 },
    });
    const [result] = dedupeSleepItems([upload, samsung]);
    const stages = (result.data as { extracted: { sleepStageMinutes: Record<string, number> } }).extracted.sleepStageMinutes;
    expect(stages).toEqual({ awake: 55, rem: 111, light: 213, deep: 60 });
  });

  it("prefers the full Samsung session over a pre-midnight fragment", () => {
    const fragment = sleepItem("healthconnect-samsung-sleep-fragment", { provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-10T06:05:00Z" }, {
      actualSleepDurationMinutes: 41,
      timeInBedMinutes: 44,
      sleepStageMinutes: { light: 41 },
    });
    const fullSession = sleepItem("healthconnect-samsung-sleep-full", { provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-10T06:05:00Z" }, {
      actualSleepDurationMinutes: 353,
      timeInBedMinutes: 402,
      sleepStageMinutes: { awake: 42, rem: 37, light: 304, deep: 12 },
    });
    const [result] = dedupeSleepItems([fragment, fullSession]);
    const extracted = (result.data as { extracted: Record<string, unknown> }).extracted;
    expect(result.id).toBe(fullSession.id);
    expect(extracted.actualSleepDurationMinutes).toBe(353);
    expect(extracted.timeInBedMinutes).toBe(402);
    expect(extracted.sleepStageMinutes).toEqual({ awake: 42, rem: 37, light: 304, deep: 12 });
  });

  it("uses the latest non-empty manual values as corrections for the same night", () => {
    const oldUpload = sleepItem("sleep-upload-old", {
      provider: "generic_image", importType: "image", importedAt: "2026-07-18T06:00:00Z",
    }, {
      actualSleepDurationMinutes: 380,
      sleepScore: 72,
      energyScore: 68,
      hrv: 80,
    });
    const latestUpload = sleepItem("sleep-upload-new", {
      provider: "generic_image", importType: "image", importedAt: "2026-07-18T07:00:00Z",
    }, {
      actualSleepDurationMinutes: null,
      sleepScore: 79,
      energyScore: 83,
      hrv: 102,
    }, undefined, "2026-07-18T07:00:00.000Z");

    const [result] = dedupeSleepItems([oldUpload, latestUpload]);
    const extracted = (result.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.actualSleepDurationMinutes).toBe(380);
    expect(extracted.sleepScore).toBe(79);
    expect(extracted.energyScore).toBe(83);
    expect(extracted.hrv).toBe(102);
  });

  it("keeps Samsung measurements authoritative after a newer manual upload", () => {
    const samsung = sleepItem("healthconnect-samsung-sleep-full", {
      provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-18T06:00:00Z",
    }, {
      actualSleepDurationMinutes: 353,
      timeInBedMinutes: 402,
      sleepStageMinutes: { awake: 42, rem: 37, light: 304, deep: 12 },
    });
    const latestUpload = sleepItem("sleep-upload-new", {
      provider: "generic_image", importType: "image", importedAt: "2026-07-18T07:00:00Z",
    }, {
      actualSleepDurationMinutes: 380,
      timeInBedMinutes: 430,
      sleepScore: 79,
      energyScore: 83,
    }, undefined, "2026-07-18T07:00:00.000Z");

    const [result] = dedupeSleepItems([samsung, latestUpload]);
    const extracted = (result.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.actualSleepDurationMinutes).toBe(353);
    expect(extracted.timeInBedMinutes).toBe(402);
    expect(extracted.sleepScore).toBe(79);
    expect(extracted.energyScore).toBe(83);
  });

  it("preserves sleep values explicitly corrected during upload review", () => {
    const samsung = sleepItem("healthconnect-samsung-sleep-full", {
      provider: "samsung_health", importType: "health_connect", importedAt: "2026-07-18T06:00:00Z",
    }, {
      actualSleepDurationMinutes: 353,
      sleepStageMinutes: { awake: 42, rem: 37, light: 262, deep: 12 },
    });
    const upload = sleepItem("sleep-upload-corrected", {
      provider: "generic_image", importType: "image", importedAt: "2026-07-18T07:00:00Z",
    }, {
      sleepDuration: "6h 10m",
      actualSleepDurationMinutes: 370,
      sleepStageRemMinutes: 45,
      sleepStageMinutes: { rem: 45 },
    });
    upload.data = {
      ...(upload.data as Record<string, unknown>),
      reconciliationInput: { userCorrectedFields: ["sleepDuration", "sleepStageRemMinutes"] },
    };

    const [result] = dedupeSleepItems([samsung, upload]);
    const extracted = (result.data as { extracted: Record<string, unknown> }).extracted;
    expect(extracted.actualSleepDurationMinutes).toBe(370);
    expect((extracted.sleepStageMinutes as Record<string, unknown>).rem).toBe(45);
    expect(result.fieldSources?.actualSleepDurationMinutes).toBe("User Corrected");
    expect(result.fieldSources?.["sleepStageMinutes.rem"]).toBe("User Corrected");
  });
});
