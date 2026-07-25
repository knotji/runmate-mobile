import { useEffect, useState } from 'react';
import type { RaceGoal, RacePlan } from '@/types/race';

export const RACE_PLAN_EVENT = 'runmate:race-plan-updated';

export type RacePlanState = {
  goal: RaceGoal | null;
  plan: RacePlan | null;
  lastUpdatedAt: string | null;
};

let globalState: RacePlanState = {
  goal: null,
  plan: null,
  lastUpdatedAt: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export const racePlanStore = {
  getState(): RacePlanState {
    return globalState;
  },

  setState(partial: Partial<RacePlanState>) {
    globalState = { ...globalState, ...partial };
    notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setRacePlan(goal: RaceGoal | null, plan: RacePlan | null) {
    this.setState({
      goal,
      plan,
      lastUpdatedAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RACE_PLAN_EVENT, { detail: { goal, plan } }));
    }
  },

  invalidate() {
    this.setState({ goal: null, plan: null, lastUpdatedAt: null });
  },
};

export function useRacePlanState(): RacePlanState {
  const [state, setState] = useState<RacePlanState>(racePlanStore.getState());

  useEffect(() => {
    const unsubscribeStore = racePlanStore.subscribe(() => {
      setState(racePlanStore.getState());
    });

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      racePlanStore.setState({
        goal: detail?.goal ?? null,
        plan: detail?.plan ?? null,
        lastUpdatedAt: new Date().toISOString(),
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(RACE_PLAN_EVENT, handleCustomEvent);
    }

    return () => {
      unsubscribeStore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(RACE_PLAN_EVENT, handleCustomEvent);
      }
    };
  }, []);

  return state;
}
