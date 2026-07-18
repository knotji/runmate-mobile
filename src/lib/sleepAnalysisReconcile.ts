import type { SleepAnalysis } from '@/types/logs';

export function reconcileSleepAnalysis(analysis: SleepAnalysis): SleepAnalysis {
  const extracted = analysis.extracted;
  const sleepStages = [
    extracted.sleepStageRemMinutes,
    extracted.sleepStageLightMinutes,
    extracted.sleepStageDeepMinutes,
  ];
  const awake = extracted.sleepStageAwakeMinutes;
  const timeInBed = extracted.timeInBedMinutes;
  if (sleepStages.some((value) => !isFiniteNumber(value)) || !isFiniteNumber(awake) || !isFiniteNumber(timeInBed)) return analysis;

  const stageSleepMinutes = sleepStages.reduce<number>((total, value) => total + Number(value), 0);
  const stageTimeInBed = stageSleepMinutes + awake;
  if (Math.abs(stageTimeInBed - timeInBed) > 5) return analysis;

  const durationFromText = parseDurationMinutes(extracted.sleepDuration);
  const reportedDuration = extracted.actualSleepDurationMinutes ?? durationFromText;
  if (reportedDuration != null && Math.abs(reportedDuration - stageSleepMinutes) <= 5 && (durationFromText == null || Math.abs(durationFromText - stageSleepMinutes) <= 5)) return analysis;

  return {
    ...analysis,
    extracted: {
      ...extracted,
      sleepDuration: formatMinutes(stageSleepMinutes),
      actualSleepDurationMinutes: stageSleepMinutes,
      sleepDurationSource: 'actual',
    },
    needsReview: true,
    unclearFields: [...new Set([...(analysis.unclearFields ?? []), 'Sleep Duration ถูกสลับกับ Time In Bed และแก้จากผลรวม Sleep Stages'])],
  };
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseDurationMinutes(value: string | null): number | null {
  if (!value) return null;
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)\s*m/i)?.[1] ?? 0);
  const total = Math.round(hours * 60 + minutes);
  return total > 0 ? total : null;
}

function formatMinutes(value: number): string {
  return `${Math.floor(value / 60)}h ${value % 60}m`;
}
