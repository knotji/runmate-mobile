import { create } from 'zustand';
import type { RaceGoal, RacePlan } from '@/types/race';

export type RacePlanState = {
  goal: RaceGoal | null;
  plan: RacePlan | null;
  lastUpdatedAt: string | null;
  setRacePlan: (goal: RaceGoal | null, plan: RacePlan | null) => void;
  invalidate: () => void;
};

export const useRacePlanStore = create<RacePlanState>((set) => ({
  goal: null,
  plan: null,
  lastUpdatedAt: null,
  setRacePlan: (goal, plan) => set({ goal, plan, lastUpdatedAt: new Date().toISOString() }),
  invalidate: () => set({ goal: null, plan: null, lastUpdatedAt: null }),
}));
