import type { CoachContext, WeekSleepRow } from './buildCoachContext';

export type SleepCoverageItem = {
  label: string;
  available: boolean;
  value: string | null;
  note?: string;
};

export type SleepDiagnostics = {
  latest: WeekSleepRow | null;
  coverage: SleepCoverageItem[];
  baselineNightCount: number;
  warnings: string[];
};

export function buildSleepDiagnostics(context: CoachContext, selectedDate?: string): SleepDiagnostics {
  const latest = selectedDate
    ? context.sleepHistory.find((night) => night.date === selectedDate) ?? context.sleepBaseline30d[0] ?? null
    : context.sleepBaseline30d[0] ?? null;
  const hasStages = latest != null && [latest.awakeMinutes, latest.remMinutes, latest.lightMinutes, latest.deepMinutes].some((value) => value != null);
  const coverage: SleepCoverageItem[] = [
    { label: 'Sleep Duration', available: latest?.durationMinutes != null, value: formatMinutes(latest?.durationMinutes ?? null) },
    { label: 'Time In Bed', available: latest?.timeInBedMinutes != null, value: formatMinutes(latest?.timeInBedMinutes ?? null) },
    { label: 'HRV', available: latest?.hrv != null, value: latest?.hrv == null ? null : `${latest.hrv} ms` },
    {
      label: 'Resting Heart Rate',
      available: latest?.restingHR != null,
      value: latest?.restingHR == null ? null : `${latest.restingHR} bpm`,
      note: latest?.restingHRSource === 'estimated_sleep_hr' ? 'Estimated from sleep HR samples' : undefined,
    },
    { label: 'Respiratory Rate', available: latest?.respiratoryRate != null, value: latest?.respiratoryRate == null ? null : `${latest.respiratoryRate}/min` },
    { label: 'Sleep Stages', available: hasStages, value: hasStages ? 'Available' : null },
    { label: 'Sleep Schedule', available: latest?.sleepStartTime != null && latest?.sleepEndTime != null, value: latest?.sleepStartTime && latest.sleepEndTime ? 'Available' : null },
  ];
  const warnings: string[] = [];
  if (!latest) warnings.push('No sleep record is available in the last 30 days.');
  else if (!selectedDate && latest.date !== context.todayDate) warnings.push(`Latest sleep is from ${latest.date}, not today (${context.todayDate}).`);
  if (context.sleepBaseline30d.length < 4) warnings.push('Fewer than four nights are available, so the personal baseline is still calibrating.');
  if (context.sleepBaseline30d.some((night) => night.date > context.todayDate)) warnings.push('A future-dated sleep record was found. Check the source timezone and date mapping.');
  return { latest, coverage, baselineNightCount: context.sleepBaseline30d.length, warnings };
}

function formatMinutes(value: number | null): string | null {
  if (value == null) return null;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${hours}h ${minutes}m`;
}
