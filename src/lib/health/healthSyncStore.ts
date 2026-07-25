import { useEffect, useState } from 'react';
import type { ConnectionState, SyncSummary } from '@/components/health/HealthSyncStatusCard';

export const HEALTH_SYNC_EVENT = 'runmate:health-synced';

export type HealthSyncState = {
  connection: ConnectionState | null;
  syncSummary: SyncSummary | null;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastSyncDetail: unknown | null;
};

let globalState: HealthSyncState = {
  connection: null,
  syncSummary: null,
  lastSyncedAt: null,
  isSyncing: false,
  lastSyncDetail: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export const healthSyncStore = {
  getState(): HealthSyncState {
    return globalState;
  },

  setState(partial: Partial<HealthSyncState>) {
    globalState = { ...globalState, ...partial };
    notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  startSync() {
    this.setState({ isSyncing: true });
  },

  dispatchSyncCompleted(detail?: unknown) {
    const nowIso = new Date().toISOString();
    this.setState({
      lastSyncedAt: nowIso,
      isSyncing: false,
      lastSyncDetail: detail ?? null,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(HEALTH_SYNC_EVENT, { detail }));
    }
  },
};

export function useHealthSyncState(): HealthSyncState {
  const [state, setState] = useState<HealthSyncState>(healthSyncStore.getState());

  useEffect(() => {
    const unsubscribeStore = healthSyncStore.subscribe(() => {
      setState(healthSyncStore.getState());
    });

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      healthSyncStore.setState({
        lastSyncedAt: new Date().toISOString(),
        lastSyncDetail: detail ?? globalState.lastSyncDetail,
        isSyncing: false,
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(HEALTH_SYNC_EVENT, handleCustomEvent);
    }

    return () => {
      unsubscribeStore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(HEALTH_SYNC_EVENT, handleCustomEvent);
      }
    };
  }, []);

  return state;
}
