import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { BodyCompositionAnalysis } from '@/types/logs';

export type BodyWeightTrendPoint = {
  date: string;
  weightKg: number | null;
  bodyFatPercent: number | null;
};

export type BodyWeightTrendInsight = {
  direction: 'up' | 'down' | 'steady' | 'no_data';
  title: string;
  summary: string;
};

export type BodyWeightTrendLog = {
  date: string;
  recordedAt: string;
  weightKg: number;
  bodyFatPercent: number | null;
};

const TREND_THRESHOLD_KG = 0.5;

export function buildBodyWeightTrend(
  items: LocalHistoryItem[],
  days: 7 | 30,
  todayDate: string,
): { points: BodyWeightTrendPoint[]; insight: BodyWeightTrendInsight; logs: BodyWeightTrendLog[]; hasEnoughData: boolean } {
  const startDate = shiftDate(todayDate, -(days - 1));
  const logs = items
    .filter((item) => item.type === 'body')
    .map((item) => toBodyWeightLog(item))
    .filter((log): log is BodyWeightTrendLog => log !== null)
    .filter((log) => log.date >= startDate && log.date <= todayDate)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  const byDate = new Map<string, BodyWeightTrendLog>();
  for (const log of logs) {
    const existing = byDate.get(log.date);
    if (!existing || log.recordedAt > existing.recordedAt) byDate.set(log.date, log);
  }

  const points: BodyWeightTrendPoint[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDate(startDate, offset);
    const dayLog = byDate.get(date) ?? null;
    points.push({ date, weightKg: dayLog?.weightKg ?? null, bodyFatPercent: dayLog?.bodyFatPercent ?? null });
  }

  const latest = logs[0] ?? null;
  const hasEnoughData = logs.length >= 2;

  return { points, insight: buildInsight(points, latest), logs, hasEnoughData };
}

function buildInsight(points: BodyWeightTrendPoint[], latest: BodyWeightTrendLog | null): BodyWeightTrendInsight {
  if (!latest) {
    return { direction: 'no_data', title: 'No Weigh-Ins Logged', summary: 'Connect Health Connect or log a body weight to see a trend here.' };
  }

  const scored = points.filter((point): point is BodyWeightTrendPoint & { weightKg: number } => point.weightKg != null);
  if (scored.length < 2) {
    return { direction: 'steady', title: 'Tracking Started', summary: `Latest reading is ${latest.weightKg} kg.` };
  }

  const earliest = scored[0];
  const newest = scored[scored.length - 1];
  const delta = newest.weightKg - earliest.weightKg;

  if (delta <= -TREND_THRESHOLD_KG) {
    return { direction: 'down', title: 'Body Weight Is Trending Down', summary: `Down ${Math.abs(delta).toFixed(1)} kg over this window, now ${newest.weightKg} kg.` };
  }
  if (delta >= TREND_THRESHOLD_KG) {
    return { direction: 'up', title: 'Body Weight Is Trending Up', summary: `Up ${delta.toFixed(1)} kg over this window, now ${newest.weightKg} kg.` };
  }
  return { direction: 'steady', title: 'Body Weight Is Holding Steady', summary: `Staying near ${newest.weightKg} kg across this window.` };
}

function toBodyWeightLog(item: LocalHistoryItem): BodyWeightTrendLog | null {
  const data = item.data as { extracted?: Partial<BodyCompositionAnalysis['extracted']> } | null;
  const weightKg = Number(data?.extracted?.weightKg);
  if (!Number.isFinite(weightKg)) return null;
  const bodyFatPercent = Number(data?.extracted?.bodyFatPercent);

  return {
    date: getHistoryItemDateKey(item),
    recordedAt: item.recordedAt ?? item.createdAt,
    weightKg: Math.round(weightKg * 10) / 10,
    bodyFatPercent: Number.isFinite(bodyFatPercent) ? Math.round(bodyFatPercent * 10) / 10 : null,
  };
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
