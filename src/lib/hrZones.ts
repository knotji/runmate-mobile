export type HeartRatePoint = { at: string; bpm: number };
export type HeartRateZoneIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type HeartRateZone = {
  zone: HeartRateZoneIndex;
  label: string;
  lowerBpm: number | null;
  upperBpm: number | null;
  seconds: number;
  percentage: number;
};

export type HeartRateZoneSummary = {
  method: 'hrr';
  maxHr: number;
  restingHr: number;
  measuredSeconds: number;
  workoutSeconds: number;
  coveragePercentage: number;
  zones: HeartRateZone[];
  load: { score: number; level: 'Light' | 'Moderate' | 'High' | 'Very High' } | null;
};

const ZONE_LABELS = ['Restorative', 'Recovery', 'Endurance', 'Aerobic', 'Anaerobic', 'Peak'] as const;
const ZONE_WEIGHTS = [0, 1, 2, 3, 4, 5] as const;
const MAX_SAMPLE_INTERVAL_SECONDS = 120;

export function calculateHeartRateZones(input: {
  points: HeartRatePoint[];
  workoutStart: string;
  workoutEnd: string;
  maxHr: number;
  restingHr: number;
}): HeartRateZoneSummary | null {
  const startMs = Date.parse(input.workoutStart);
  const endMs = Date.parse(input.workoutEnd);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  if (!Number.isFinite(input.maxHr) || !Number.isFinite(input.restingHr) || input.maxHr <= input.restingHr) return null;
  const points = normalizePoints(input.points, startMs, endMs);
  if (points.length < 2) return null;

  const seconds = [0, 0, 0, 0, 0, 0];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const intervalSeconds = Math.min(MAX_SAMPLE_INTERVAL_SECONDS, Math.max(0, (next.atMs - current.atMs) / 1000));
    if (intervalSeconds > 0) seconds[classifyHeartRateZone(current.bpm, input.restingHr, input.maxHr)] += intervalSeconds;
  }

  const measuredSeconds = seconds.reduce((sum, value) => sum + value, 0);
  if (measuredSeconds <= 0) return null;
  const workoutSeconds = Math.round((endMs - startMs) / 1000);
  const reserve = input.maxHr - input.restingHr;
  const boundaries = [0.4, 0.6, 0.7, 0.8, 0.9].map((ratio) => Math.round(input.restingHr + reserve * ratio));
  const zones = seconds.map((duration, zone): HeartRateZone => ({
    zone: zone as HeartRateZoneIndex,
    label: ZONE_LABELS[zone],
    lowerBpm: zone === 0 ? null : boundaries[zone - 1],
    upperBpm: zone === 5 ? null : boundaries[zone] - 1,
    seconds: Math.round(duration),
    percentage: Math.round((duration / measuredSeconds) * 100),
  }));
  const coveragePercentage = Math.min(100, Math.round((measuredSeconds / workoutSeconds) * 100));
  const weightedMinutes = zones.reduce((sum, zone) => sum + (zone.seconds / 60) * ZONE_WEIGHTS[zone.zone], 0);
  const score = Math.min(100, Math.round(weightedMinutes / 3));
  const load = coveragePercentage >= 50 ? { score, level: loadLevel(score) } : null;
  return { method: 'hrr', maxHr: Math.round(input.maxHr), restingHr: Math.round(input.restingHr), measuredSeconds: Math.round(measuredSeconds), workoutSeconds, coveragePercentage, zones, load };
}

export function classifyHeartRateZone(bpm: number, restingHr: number, maxHr: number): HeartRateZoneIndex {
  const reserveRatio = (bpm - restingHr) / (maxHr - restingHr);
  if (reserveRatio < 0.4) return 0;
  if (reserveRatio < 0.6) return 1;
  if (reserveRatio < 0.7) return 2;
  if (reserveRatio < 0.8) return 3;
  if (reserveRatio < 0.9) return 4;
  return 5;
}

export function restingHeartRateBaseline(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 30 && value <= 120).sort((a, b) => a - b);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[middle] : Math.round((valid[middle - 1] + valid[middle]) / 2);
}

function normalizePoints(points: HeartRatePoint[], startMs: number, endMs: number): Array<{ atMs: number; bpm: number }> {
  const byTime = new Map<number, number>();
  for (const point of points) {
    const atMs = Date.parse(point.at);
    if (Number.isFinite(atMs) && atMs >= startMs && atMs <= endMs && Number.isFinite(point.bpm) && point.bpm >= 30 && point.bpm <= 260) byTime.set(atMs, point.bpm);
  }
  return [...byTime].map(([atMs, bpm]) => ({ atMs, bpm })).sort((a, b) => a.atMs - b.atMs);
}

function loadLevel(score: number): 'Light' | 'Moderate' | 'High' | 'Very High' {
  if (score <= 20) return 'Light';
  if (score <= 45) return 'Moderate';
  if (score <= 70) return 'High';
  return 'Very High';
}
