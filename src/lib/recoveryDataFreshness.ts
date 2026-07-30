export type RecoveryDataStatus = 'fresh' | 'refreshing' | 'stale' | 'fallback';

const RECOVERY_FRESH_MS = 30 * 60 * 1000;

export function resolveRecoveryDataStatus(input: {
  savedAt: string | null;
  refreshing: boolean;
  refreshFailed: boolean;
  now?: Date | string | number;
}): RecoveryDataStatus {
  if (input.refreshFailed) return 'fallback';
  if (input.refreshing) return 'refreshing';
  if (!input.savedAt) return 'stale';
  const ageMs = new Date(input.now ?? Date.now()).getTime() - Date.parse(input.savedAt);
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= RECOVERY_FRESH_MS ? 'fresh' : 'stale';
}

export function recoveryDataStatusCopy(status: RecoveryDataStatus, savedAt: string | null): {
  label: string;
  detail: string;
} {
  if (status === 'refreshing') return { label: 'Updating', detail: 'Checking Health Connect for newer data…' };
  if (status === 'fallback') return { label: 'Saved Data', detail: `Refresh unavailable · Showing ${formatSavedTime(savedAt)}` };
  if (status === 'stale') return { label: 'May Be Outdated', detail: `Last updated ${formatSavedTime(savedAt)}` };
  return { label: 'Up To Date', detail: `Updated ${formatSavedTime(savedAt)}` };
}

function formatSavedTime(savedAt: string | null): string {
  if (!savedAt || !Number.isFinite(Date.parse(savedAt))) return 'earlier today';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(savedAt));
}
