/** FNV-1a hash used to derive stable, short history-item ids from Health Connect platform keys. */
export function stableKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Tracks the last-successful-sync timestamp for a Health Connect sync job in localStorage. */
export function createLastSyncedAtStore(storageKey: string) {
  return {
    get(): string | null {
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    recordNow(): void {
      try {
        window.localStorage.setItem(storageKey, new Date().toISOString());
      } catch {
        // Sync remains successful when local display metadata cannot be persisted.
      }
    },
  };
}
