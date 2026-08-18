import type { LocalHistoryItem } from './localHistory';

export function isMovementRecord(item: Pick<LocalHistoryItem, 'type'>): boolean {
  return item.type === 'workout' || item.type === 'strength';
}
