import { useEffect, useState } from 'react';
import type { CoachContext } from '@/lib/buildCoachContext';

export const COACH_CONTEXT_EVENT = 'runmate:coach-context-updated';

export type CoachContextState = {
  context: CoachContext | null;
  isLoading: boolean;
  lastUpdatedAt: string | null;
  error: string | null;
};

let globalState: CoachContextState = {
  context: null,
  isLoading: false,
  lastUpdatedAt: null,
  error: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export const coachContextStore = {
  getState(): CoachContextState {
    return globalState;
  },

  setState(partial: Partial<CoachContextState>) {
    globalState = { ...globalState, ...partial };
    notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setContext(context: CoachContext) {
    this.setState({
      context,
      isLoading: false,
      lastUpdatedAt: new Date().toISOString(),
      error: null,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COACH_CONTEXT_EVENT, { detail: { context } }));
    }
  },

  setLoading(isLoading: boolean) {
    this.setState({ isLoading });
  },

  setError(error: string | null) {
    this.setState({ error, isLoading: false });
  },

  invalidate() {
    this.setState({ context: null, lastUpdatedAt: null });
  },
};

export function useCoachContextState(): CoachContextState {
  const [state, setState] = useState<CoachContextState>(coachContextStore.getState());

  useEffect(() => {
    const unsubscribeStore = coachContextStore.subscribe(() => {
      setState(coachContextStore.getState());
    });

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.context) {
        coachContextStore.setState({
          context: detail.context,
          lastUpdatedAt: new Date().toISOString(),
          isLoading: false,
          error: null,
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(COACH_CONTEXT_EVENT, handleCustomEvent);
    }

    return () => {
      unsubscribeStore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(COACH_CONTEXT_EVENT, handleCustomEvent);
      }
    };
  }, []);

  return state;
}
