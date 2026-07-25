import { create } from 'zustand';
import type { ConnectionState, SyncSummary } from '@/components/health/HealthSyncStatusCard';

export type HealthSyncState = {
  connection: ConnectionState | null;
  syncSummary: SyncSummary | null;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  lastSyncDetail: unknown | null;
  setConnection: (connection: ConnectionState | null) => void;
  setSyncSummary: (syncSummary: SyncSummary | null) => void;
  startSync: () => void;
  dispatchSyncCompleted: (detail?: unknown) => void;
};

export const useHealthSyncStore = create<HealthSyncState>((set) => ({
  connection: null,
  syncSummary: null,
  lastSyncedAt: null,
  isSyncing: false,
  lastSyncDetail: null,
  setConnection: (connection) => set({ connection }),
  setSyncSummary: (syncSummary) => set({ syncSummary }),
  startSync: () => set({ isSyncing: true }),
  dispatchSyncCompleted: (detail) => set({
    lastSyncedAt: new Date().toISOString(),
    isSyncing: false,
    lastSyncDetail: detail ?? null,
  }),
}));
