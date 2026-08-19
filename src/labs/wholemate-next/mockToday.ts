// Self-contained sample data for the Today prototype. Deliberately not wired
// to CoachContextStore/Supabase — this lab explores visual language only,
// isolated from anything that could affect the shipped Today page.

export type BodyStatus = 'ready' | 'steady' | 'reduce' | 'recover';

export interface RingMetric {
  key: 'recovery' | 'sleep' | 'strain' | 'energy';
  label: string;
  value: number; // 0-100 (strain is normalized to 0-100 for the ring, real label shown separately)
  displayValue: string;
  unit?: string;
  status: 'good' | 'steady' | 'caution' | 'low';
}

export interface TodayMockScenario {
  id: string;
  label: string;
  status: BodyStatus;
  statusTitle: string;
  statusSummary: string;
  mainReason: { eyebrow: string; title: string; detail: string };
  oneThing: { title: string; detail: string; actionLabel: string };
  metrics: RingMetric[];
  freshness: string;
}

export const TODAY_SCENARIOS: TodayMockScenario[] = [
  {
    id: 'ready',
    label: 'Ready',
    status: 'ready',
    statusTitle: 'Ready To Push Today',
    statusSummary: 'Recovery and sleep are both ahead of your baseline.',
    mainReason: {
      eyebrow: 'Why',
      title: 'HRV is 14ms above your 30-day baseline',
      detail: 'Resting heart rate and sleep performance moved the same direction overnight — a consistent, well-recovered signal.',
    },
    oneThing: {
      title: 'Today is a good day for the harder session',
      detail: 'Your planned tempo run fits — nothing in your data argues against it.',
      actionLabel: 'View Today’s Plan',
    },
    metrics: [
      { key: 'recovery', label: 'Recovery', value: 86, displayValue: '86', unit: '/100', status: 'good' },
      { key: 'sleep', label: 'Sleep', value: 91, displayValue: '7h 42m', status: 'good' },
      { key: 'strain', label: 'Strain', value: 32, displayValue: '6.8', unit: '/21', status: 'steady' },
      { key: 'energy', label: 'Energy', value: 78, displayValue: '78', unit: '/100', status: 'good' },
    ],
    freshness: 'Updated 12 min ago',
  },
  {
    id: 'reduce',
    label: 'Keep It Controlled',
    status: 'reduce',
    statusTitle: 'Keep Today Controlled',
    statusSummary: 'Sleep performance is the limiter, not your overall recovery score.',
    mainReason: {
      eyebrow: 'Why',
      title: 'You were awake 58 minutes overnight — 38 min above your usual',
      detail: 'Everything else about last night reads normally. This one signal is enough to ask for an easier day.',
    },
    oneThing: {
      title: 'Trade the interval set for an easy 30-40 min',
      detail: 'Keeps the week on track without adding to a night that already cost you something.',
      actionLabel: 'Adjust Today’s Plan',
    },
    metrics: [
      { key: 'recovery', label: 'Recovery', value: 61, displayValue: '61', unit: '/100', status: 'steady' },
      { key: 'sleep', label: 'Sleep', value: 54, displayValue: '6h 05m', status: 'caution' },
      { key: 'strain', label: 'Strain', value: 58, displayValue: '12.4', unit: '/21', status: 'steady' },
      { key: 'energy', label: 'Energy', value: 49, displayValue: '49', unit: '/100', status: 'caution' },
    ],
    freshness: 'Updated 12 min ago',
  },
  {
    id: 'recover',
    label: 'Recover',
    status: 'recover',
    statusTitle: 'Recovery Comes First',
    statusSummary: 'Two overnight signals and this week’s training load agree.',
    mainReason: {
      eyebrow: 'Why',
      title: 'HRV and resting heart rate both moved against you',
      detail: 'Combined with a heavier training week, your body is asking for a real rest day rather than active recovery.',
    },
    oneThing: {
      title: 'Take today fully off',
      detail: 'A walk is fine if you want to move. Nothing structured until tomorrow’s numbers come back.',
      actionLabel: 'See What’s Shaping This',
    },
    metrics: [
      { key: 'recovery', label: 'Recovery', value: 29, displayValue: '29', unit: '/100', status: 'low' },
      { key: 'sleep', label: 'Sleep', value: 61, displayValue: '6h 50m', status: 'steady' },
      { key: 'strain', label: 'Strain', value: 71, displayValue: '15.9', unit: '/21', status: 'caution' },
      { key: 'energy', label: 'Energy', value: 22, displayValue: '22', unit: '/100', status: 'low' },
    ],
    freshness: 'Updated 12 min ago',
  },
];
