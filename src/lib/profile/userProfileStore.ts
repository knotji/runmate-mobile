import { create } from 'zustand';
import type { UserProfile } from '@/types/profile';

export type UserProfileState = {
  profile: UserProfile | null;
  lastUpdatedAt: string | null;
  setProfile: (profile: UserProfile | null) => void;
  invalidate: () => void;
};

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: null,
  lastUpdatedAt: null,
  setProfile: (profile) => set({ profile, lastUpdatedAt: new Date().toISOString() }),
  invalidate: () => set({ profile: null, lastUpdatedAt: null }),
}));
