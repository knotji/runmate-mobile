import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { PainLog, PainRiskLevel, PainStatus } from '@/types/pain';

export type PainTrendPoint = {
  date: string;
  painLevel: number | null;
  location: string | null;
  status: PainStatus | null;
  riskLevel: PainRiskLevel | null;
};

export type PainTrendInsight = {
  direction: 'improving' | 'worsening' | 'steady' | 'no_data';
  title: string;
  summary: string;
};

export type PainTrendLog = {
  date: string;
  painLocation: string;
  painSide: string;
  painLevel: number;
  status: PainStatus;
  riskLevel: PainRiskLevel;
  trainingImpact: string;
  redFlags: string[];
};

export function buildPainTrend(
  items: LocalHistoryItem[],
  days: 7 | 30,
  todayDate: string,
): { points: PainTrendPoint[]; insight: PainTrendInsight; logs: PainTrendLog[]; hasActivePain: boolean } {
  const startDate = shiftDate(todayDate, -(days - 1));
  const logs = items
    .filter((item) => item.type === 'pain')
    .map((item) => toPainTrendLog(item))
    .filter((log): log is PainTrendLog => log !== null)
    .filter((log) => log.date >= startDate && log.date <= todayDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  const byDate = new Map<string, PainTrendLog[]>();
  for (const log of logs) byDate.set(log.date, [...(byDate.get(log.date) ?? []), log]);

  const points: PainTrendPoint[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = shiftDate(startDate, offset);
    const dayLogs = byDate.get(date) ?? [];
    const worst = dayLogs.reduce<PainTrendLog | null>((max, log) => (!max || log.painLevel > max.painLevel ? log : max), null);
    points.push({
      date,
      painLevel: worst?.painLevel ?? null,
      location: worst?.painLocation ?? null,
      status: worst?.status ?? null,
      riskLevel: worst?.riskLevel ?? null,
    });
  }

  const latest = logs[0] ?? null;
  const hasActivePain = latest?.status === 'active';

  return { points, insight: buildInsight(points, latest), logs, hasActivePain };
}

function buildInsight(points: PainTrendPoint[], latest: PainTrendLog | null): PainTrendInsight {
  if (!latest) {
    return { direction: 'no_data', title: 'No Pain Logged', summary: 'No pain or injury has been logged in this window.' };
  }
  if (latest.status === 'resolved') {
    return { direction: 'improving', title: 'Latest Report Is Resolved', summary: `${latest.painLocation} was marked resolved on ${formatRowDate(latest.date)}.` };
  }

  const scored = points.filter((point): point is PainTrendPoint & { painLevel: number } => point.painLevel != null);
  if (scored.length < 2) {
    return { direction: 'steady', title: 'Tracking Started', summary: `${latest.painLocation} is at level ${latest.painLevel}/10.` };
  }

  const firstHalf = scored.slice(0, Math.floor(scored.length / 2));
  const secondHalf = scored.slice(Math.floor(scored.length / 2));
  const earlierAvg = average(firstHalf.map((point) => point.painLevel));
  const recentAvg = average(secondHalf.map((point) => point.painLevel));
  const delta = recentAvg - earlierAvg;

  if (delta <= -1) {
    return { direction: 'improving', title: 'Pain Is Trending Down', summary: `${latest.painLocation} averaged ${recentAvg.toFixed(1)}/10 recently, down from ${earlierAvg.toFixed(1)}/10 earlier.` };
  }
  if (delta >= 1) {
    return { direction: 'worsening', title: 'Pain Is Trending Up', summary: `${latest.painLocation} averaged ${recentAvg.toFixed(1)}/10 recently, up from ${earlierAvg.toFixed(1)}/10 earlier.` };
  }
  return { direction: 'steady', title: 'Pain Is Holding Steady', summary: `${latest.painLocation} has stayed near ${recentAvg.toFixed(1)}/10 across this window.` };
}

function toPainTrendLog(item: LocalHistoryItem): PainTrendLog | null {
  const data = item.data as Partial<PainLog> | null;
  if (!data) return null;
  const painLevel = Number(data.painLevel);
  if (!Number.isFinite(painLevel)) return null;

  const redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];
  const painType = Array.isArray(data.painType) ? data.painType : [];
  const hasRedFlag = data.swellingOrRedness === 'yes'
    || data.canBearWeight === 'no'
    || redFlags.length > 0
    || painType.some((type) => /sharp|numb|แปลบ|ชา/i.test(type));

  const storedStatus = data.recoveryStatus;
  const markedResolved = data.resolved === true || data.status === 'resolved';
  const status: PainStatus = storedStatus === 'active_pain'
    ? 'active'
    : storedStatus === 'improving'
      ? 'active'
      : storedStatus === 'cleared_light' || storedStatus === 'cleared_normal'
        ? 'resolved'
        : markedResolved && !hasRedFlag
          ? 'resolved'
          : 'active';

  return {
    date: getHistoryItemDateKey(item),
    painLocation: data.painLocation ?? 'Unspecified',
    painSide: data.painSide ?? 'unknown',
    painLevel,
    status,
    riskLevel: data.riskLevel ?? 'low',
    trainingImpact: data.trainingImpact ?? 'run_ok_easy',
    redFlags,
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shiftDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00+07:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatRowDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
