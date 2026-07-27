import type { CoachContext } from './buildCoachContext';

export function requiresFullSleepHistory(context: CoachContext, selectedDate: string | null): boolean {
  return Boolean(selectedDate) && !context.sleepHistory.some((night) => night.date === selectedDate);
}
