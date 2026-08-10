export const TODAY_SYNC_STORAGE_KEY = 'runmate:today-health-last-completed-at';

export function getPersistedTodaySyncAt(): number {
  try {
    const value = Number(window.localStorage.getItem(TODAY_SYNC_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function persistTodaySyncAt(value: number): void {
  try { window.localStorage.setItem(TODAY_SYNC_STORAGE_KEY, String(value)); }
  catch { /* The in-memory cooldown still prevents duplicate work in this session. */ }
}
