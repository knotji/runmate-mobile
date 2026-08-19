// Mock data for the Health Next prototype — same rule as mockToday.ts:
// self-contained, not wired to CoachContext, visual exploration only.

export interface TrendDay {
  label: string;
  value: number; // 0-100
  status: 'good' | 'steady' | 'caution' | 'low';
}

export interface StatTile {
  key: string;
  eyebrow: string;
  value: string;
  unit?: string;
  deltaLabel: string;
  deltaDirection: 'up' | 'down' | 'flat';
  goodDirection: 'up' | 'down'; // which direction counts as "good" for this metric
}

export interface DataSourceRow {
  label: string;
  detail: string;
  state: 'ok' | 'stale' | 'missing';
}

export const RECOVERY_TREND: TrendDay[] = [
  { label: 'Wed', value: 58, status: 'steady' },
  { label: 'Thu', value: 71, status: 'good' },
  { label: 'Fri', value: 64, status: 'steady' },
  { label: 'Sat', value: 45, status: 'caution' },
  { label: 'Sun', value: 52, status: 'steady' },
  { label: 'Mon', value: 77, status: 'good' },
  { label: 'Tue', value: 86, status: 'good' },
];

export const HEALTH_STAT_TILES: StatTile[] = [
  { key: 'hrv', eyebrow: 'HRV vs Baseline', value: '61', unit: 'ms', deltaLabel: '+9 ms this week', deltaDirection: 'up', goodDirection: 'up' },
  { key: 'rhr', eyebrow: 'Resting HR vs Baseline', value: '54', unit: 'bpm', deltaLabel: '-2 bpm this week', deltaDirection: 'down', goodDirection: 'down' },
  { key: 'sleep', eyebrow: 'Sleep · 7 Day Avg', value: '7h 12m', deltaLabel: '+18 min vs last week', deltaDirection: 'up', goodDirection: 'up' },
  { key: 'nutrition', eyebrow: 'Nutrition · 7 Day Avg', value: '2,340', unit: 'kcal', deltaLabel: 'Within your usual range', deltaDirection: 'flat', goodDirection: 'up' },
];

export const DATA_SOURCES: DataSourceRow[] = [
  { label: 'Health Connect', detail: 'Synced 12 min ago', state: 'ok' },
  { label: 'Manual weight log', detail: 'Last entry 3 days ago', state: 'stale' },
  { label: 'Respiratory rate', detail: 'Not reported by this device’s Health Connect source — shown as missing, never estimated', state: 'missing' },
];
