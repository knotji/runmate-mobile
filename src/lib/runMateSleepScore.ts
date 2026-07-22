export type RunMateSleepScoreNight = {
  durationMinutes: number | null;
  timeInBedMinutes: number | null;
  sleepStartTime: string | null;
  sleepEndTime: string | null;
  remMinutes: number | null;
  lightMinutes: number | null;
  deepMinutes: number | null;
};

export type RunMateSleepScoreResult = {
  score: number | null;
  sleepNeedMinutes: number;
  actualSleepMinutes: number | null;
  sufficiencyScore: number | null;
  consistencyScore: number | null;
  efficiencyScore: number | null;
  qualityScore: number | null;
  sleepDebtMinutes: number;
  strainNeedMinutes: number;
  typicalWakeMinutes: number | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export function calculateRunMateSleepScore(nights: RunMateSleepScoreNight[], strainScore = 0): RunMateSleepScoreResult {
  const latest = nights[0] ?? null;
  const durations = nights.map((night) => night.durationMinutes).filter((value): value is number => value != null);
  const baselineMinutes = median(durations.slice(1)) ?? median(durations) ?? 8 * 60;
  const sleepDebtMinutes = Math.round(Math.min(120, durations.slice(0, 5).reduce((debt, duration) => debt + Math.max(0, baselineMinutes - duration) * 0.25, 0)));
  const strainNeedMinutes = Math.round((strainScore / 21) * 60);
  const sleepNeedMinutes = Math.round(clamp(baselineMinutes + sleepDebtMinutes + strainNeedMinutes, 7 * 60, 10 * 60));
  const actualSleepMinutes = latest?.durationMinutes ?? null;
  const sufficiencyScore = actualSleepMinutes == null ? null : Math.round(clamp(actualSleepMinutes / sleepNeedMinutes * 100));
  const bedtimes = nights.map((night) => circularTimeMinutes(night.sleepStartTime)).filter((value): value is number => value != null);
  const wakeTimes = nights.map((night) => circularTimeMinutes(night.sleepEndTime)).filter((value): value is number => value != null);
  const consistencyParts = [variabilityScore(bedtimes), variabilityScore(wakeTimes)].filter((value): value is number => value != null);
  const consistencyScore = consistencyParts.length ? Math.round(mean(consistencyParts) ?? 0) : null;
  const efficiencyScore = actualSleepMinutes != null && latest?.timeInBedMinutes != null && latest.timeInBedMinutes > 0
    ? Math.round(clamp(actualSleepMinutes / latest.timeInBedMinutes * 100))
    : null;
  const restorativeMinutes = (latest?.remMinutes ?? 0) + (latest?.deepMinutes ?? 0);
  const stagedSleepMinutes = restorativeMinutes + (latest?.lightMinutes ?? 0);
  const stageQualityScore = stagedSleepMinutes > 0 ? Math.round(clamp(restorativeMinutes / stagedSleepMinutes / 0.4 * 100)) : null;
  const qualityScore = stageQualityScore;
  const components: Array<{ score: number; weight: number }> = [];
  if (sufficiencyScore != null) components.push({ score: sufficiencyScore, weight: 0.55 });
  if (consistencyScore != null) components.push({ score: consistencyScore, weight: 0.15 });
  if (efficiencyScore != null) components.push({ score: efficiencyScore, weight: 0.15 });
  if (qualityScore != null) components.push({ score: qualityScore, weight: 0.15 });
  const weightTotal = components.reduce((sum, component) => sum + component.weight, 0);
  const score = actualSleepMinutes != null && weightTotal
    ? Math.round(components.reduce((sum, component) => sum + component.score * component.weight, 0) / weightTotal)
    : null;
  return {
    score,
    sleepNeedMinutes,
    actualSleepMinutes,
    sufficiencyScore,
    consistencyScore,
    efficiencyScore,
    qualityScore,
    sleepDebtMinutes,
    strainNeedMinutes,
    typicalWakeMinutes: median(wakeTimes),
  };
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function circularTimeMinutes(value: string | null): number | null {
  if (!value) return null;
  if (value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      const minute = Number(parts.find((part) => part.type === 'minute')?.value);
      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        const localMinutes = hour * 60 + minute;
        return localMinutes < 12 * 60 ? localMinutes + 24 * 60 : localMinutes;
      }
    }
  }
  const match = value.match(/(?:T|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
}

function variabilityScore(values: number[]): number | null {
  if (values.length < 3) return null;
  const average = mean(values);
  if (average == null) return null;
  const averageDeviation = mean(values.map((value) => Math.abs(value - average))) ?? 0;
  return Math.round(clamp(100 - averageDeviation / 1.2));
}
