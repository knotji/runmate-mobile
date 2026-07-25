import { useEffect, useState } from 'react';
import type { UserProfile } from '@/types/profile';

export const USER_PROFILE_EVENT = 'runmate:user-profile-updated';

export type UserProfileState = {
  profile: UserProfile | null;
  lastUpdatedAt: string | null;
};

let globalState: UserProfileState = {
  profile: null,
  lastUpdatedAt: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export const userProfileStore = {
  getState(): UserProfileState {
    return globalState;
  },

  setState(partial: Partial<UserProfileState>) {
    globalState = { ...globalState, ...partial };
    notifyListeners();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setProfile(profile: UserProfile | null) {
    this.setState({
      profile,
      lastUpdatedAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(USER_PROFILE_EVENT, { detail: { profile } }));
    }
  },

  invalidate() {
    this.setState({ profile: null, lastUpdatedAt: null });
  },
};

export function useUserProfileState(): UserProfileState {
  const [state, setState] = useState<UserProfileState>(userProfileStore.getState());

  useEffect(() => {
    const unsubscribeStore = userProfileStore.subscribe(() => {
      setState(userProfileStore.getState());
    });

    const handleCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      userProfileStore.setState({
        profile: detail?.profile ?? null,
        lastUpdatedAt: new Date().toISOString(),
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(USER_PROFILE_EVENT, handleCustomEvent);
    }

    return () => {
      unsubscribeStore();
      if (typeof window !== 'undefined') {
        window.removeEventListener(USER_PROFILE_EVENT, handleCustomEvent);
      }
    };
  }, []);

  return state;
}
