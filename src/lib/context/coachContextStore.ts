import { create } from 'zustand';
import type { CoachContext } from '@/lib/buildCoachContext';

export type CoachContextState = {
  context: CoachContext | null;
  isLoading: boolean;
  lastUpdatedAt: string | null;
  error: string | null;
  setContext: (context: CoachContext) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  invalidate: () => void;
};

export const useCoachContextStore = create<CoachContextState>((set) => ({
  context: null,
  isLoading: false,
  lastUpdatedAt: null,
  error: null,
  setContext: (context) => set({ context, isLoading: false, lastUpdatedAt: new Date().toISOString(), error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  invalidate: () => set({ context: null, lastUpdatedAt: null }),
}));
