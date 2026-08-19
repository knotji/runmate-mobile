// Mock data for the Move Next prototype — same rule as mockToday.ts /
// mockHealth.ts: self-contained, not wired to CoachContext.
import { barbellOutline, fitnessOutline, walkOutline } from 'ionicons/icons';

export interface MoveTodayPlan {
  title: string;
  detail: string;
  actionLabel: string;
  isRestDay: boolean;
}

export interface MoveTimelineItem {
  id: string;
  icon: string;
  label: string;
  title: string;
  detail: string;
  dateLabel: string;
  source: string;
}

export const MOVE_TODAY_PLAN: MoveTodayPlan = {
  title: 'Tempo Run · 5 km · 25 min',
  detail: 'Targets a comfortably hard effort — should feel sustainable, not maximal.',
  actionLabel: 'View Full Session',
  isRestDay: false,
};

export const MOVE_TIMELINE: MoveTimelineItem[] = [
  { id: '1', icon: walkOutline, label: 'Workout', title: 'Easy Run', detail: '5.2 km · 32 min · 128 bpm', dateLabel: 'Today', source: 'Health Connect' },
  { id: '2', icon: barbellOutline, label: 'Strength', title: 'Lower Body Strength', detail: '45 min · 6 exercises', dateLabel: 'Yesterday', source: 'Manual' },
  { id: '3', icon: fitnessOutline, label: 'Workout', title: 'Tempo Run', detail: '8.1 km · 41 min · 152 bpm', dateLabel: 'Tue', source: 'Health Connect' },
  { id: '4', icon: walkOutline, label: 'Workout', title: 'Recovery Walk', detail: '3.0 km · 34 min', dateLabel: 'Mon', source: 'Health Connect' },
  { id: '5', icon: fitnessOutline, label: 'Workout', title: 'Long Run', detail: '14.6 km · 78 min · 149 bpm', dateLabel: 'Sun', source: 'Health Connect' },
];
