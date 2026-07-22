import type { LocalHistoryItem } from '@/lib/localHistory';
import { calculateHeartRateZones } from '@/lib/hrZones';
import { getBangkokDateKey, shiftDate } from '@/lib/date';

export type FatigueZone = 'optimal' | 'building' | 'high_fatigue' | 'overreaching';

export type FatigueStatus = {
  ctl: number; // Chronic Training Load (42-day fitness)
  atl: number; // Acute Training Load (7-day fatigue)
  tsb: number; // Training Stress Balance (CTL - ATL)
  zone: FatigueZone;
  label: string;
  summary: string;
};

export type Vo2MaxTrend = {
  current: number | null;
  average30d: number | null;
  change30d: number | null;
  direction: 'up' | 'down' | 'steady' | 'unavailable';
  summary: string;
};

export function calculateTrainingStressBalance(
  items: LocalHistoryItem[],
  profile: Record<string, unknown> | null,
  todayDate: string = getBangkokDateKey(Date.now()),
): { fatigue: FatigueStatus; vo2Max: Vo2MaxTrend } {
  // Collect 42 days of workouts
  const workouts = items.filter((item) => item.type === 'workout' || item.type === 'strength');
  const dailyLoads = new Map<string, number>();

  for (let i = 41; i >= 0; i--) {
    const date = shiftDate(todayDate, -i);
    dailyLoads.set(date, 0);
  }

  let totalVo2Max = 0;
  let vo2MaxCount = 0;
  let latestVo2Max: number | null = null;
  let oldestVo2Max: number | null = null;

  for (const item of workouts) {
    const date = item.dateKey || getBangkokDateKey(item.createdAt);
    const data = record(item.data);
    const extracted = record(data.extracted);

    // Extract VO2 Max if present
    const rawVo2 = typeof extracted.vo2Max === 'number' ? extracted.vo2Max : typeof data.vo2Max === 'number' ? data.vo2Max : null;
    if (rawVo2 != null && Number.isFinite(rawVo2) && rawVo2 > 0) {
      if (latestVo2Max == null) latestVo2Max = rawVo2;
      oldestVo2Max = rawVo2;
      totalVo2Max += rawVo2;
      vo2MaxCount++;
    }

    if (!dailyLoads.has(date)) continue;

    // Calculate session load
    let load = 0;
    if (Array.isArray(extracted.heartRateTimeline) && extracted.heartRateTimeline.length > 0) {
      const maxHr = typeof profile?.maxHr === 'number' ? profile.maxHr : 185;
      const restingHr = typeof profile?.normalRestingHr === 'number' ? profile.normalRestingHr : 60;
      const workoutStart = (typeof extracted.workoutStartTime === 'string' && extracted.workoutStartTime) || (typeof extracted.startDate === 'string' && extracted.startDate) || item.createdAt;
      const workoutEnd = (typeof extracted.workoutEndTime === 'string' && extracted.workoutEndTime) || (typeof extracted.endDate === 'string' && extracted.endDate) || item.createdAt;
      const summary = calculateHeartRateZones({
        points: extracted.heartRateTimeline as Array<{ at: string; bpm: number }>,
        workoutStart,
        workoutEnd,
        maxHr,
        restingHr,
      });
      if (summary?.load?.score != null) {
        load = summary.load.score;
      }
    }

    if (load === 0) {
      // Fall back to estimated duration / distance load
      const durationMin = typeof extracted.durationMinutes === 'number' ? extracted.durationMinutes : typeof extracted.durationMin === 'number' ? extracted.durationMin : 30;
      const distanceKm = typeof extracted.distanceKm === 'number' ? extracted.distanceKm : 0;
      load = Math.min(100, Math.round(durationMin * 0.8 + distanceKm * 2));
    }

    dailyLoads.set(date, (dailyLoads.get(date) ?? 0) + load);
  }

  // Calculate CTL (42-day EMA) & ATL (7-day EMA)
  let ctl = 0;
  let atl = 0;
  const kCtl = 1 - Math.exp(-1 / 42);
  const kAtl = 1 - Math.exp(-1 / 7);

  for (let i = 41; i >= 0; i--) {
    const date = shiftDate(todayDate, -i);
    const dayLoad = dailyLoads.get(date) ?? 0;
    ctl = ctl + (dayLoad - ctl) * kCtl;
    atl = atl + (dayLoad - atl) * kAtl;
  }

  ctl = Math.round(ctl);
  atl = Math.round(atl);
  const tsb = ctl - atl;

  const fatigue = classifyFatigue(ctl, atl, tsb);
  const vo2Max = summarizeVo2Max(latestVo2Max, oldestVo2Max, totalVo2Max, vo2MaxCount);

  return { fatigue, vo2Max };
}

function classifyFatigue(ctl: number, atl: number, tsb: number): FatigueStatus {
  let zone: FatigueZone = 'building';
  let label = 'Building / Productive';
  let summary = 'Training load is accumulating productively. Keep recovery steady.';

  if (tsb > 5) {
    zone = 'optimal';
    label = 'Optimal / Fresh';
    summary = 'Your body is well-rested and ready for high performance or key workouts.';
  } else if (tsb >= -10) {
    zone = 'building';
    label = 'Building / Productive';
    summary = 'Training load is accumulating productively. Recovery is balanced with fatigue.';
  } else if (tsb >= -25) {
    zone = 'high_fatigue';
    label = 'High Fatigue';
    summary = 'Substantial training fatigue detected. Prioritize sleep and active recovery.';
  } else {
    zone = 'overreaching';
    label = 'Overreaching Warning';
    summary = 'Fatigue significantly outweighs fitness. High risk of overtraining or injury.';
  }

  return { ctl, atl, tsb, zone, label, summary };
}

function summarizeVo2Max(
  latest: number | null,
  oldest: number | null,
  total: number,
  count: number,
): Vo2MaxTrend {
  if (latest == null || count === 0) {
    return {
      current: null,
      average30d: null,
      change30d: null,
      direction: 'unavailable',
      summary: 'No VO₂ Max records available yet.',
    };
  }

  const average30d = Math.round((total / count) * 10) / 10;
  const change30d = oldest != null ? Math.round((latest - oldest) * 10) / 10 : 0;
  let direction: Vo2MaxTrend['direction'] = 'steady';

  if (change30d >= 0.5) direction = 'up';
  else if (change30d <= -0.5) direction = 'down';

  const summary = direction === 'up'
    ? `VO₂ Max increased by ${change30d} ml/kg/min over the past 30 days.`
    : direction === 'down'
      ? `VO₂ Max dropped by ${Math.abs(change30d)} ml/kg/min. Monitor training fatigue.`
      : 'VO₂ Max has remained steady over recent workouts.';

  return {
    current: Math.round(latest * 10) / 10,
    average30d,
    change30d,
    direction,
    summary,
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}
