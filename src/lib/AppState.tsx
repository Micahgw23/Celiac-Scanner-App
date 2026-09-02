import { createContext, type ReactNode, useContext } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { DietaryProfile } from '@/types/diet';

interface AppStateValue {
  uid: string | null;
  /** True until we know whether we have a signed-in user AND their profile doc. */
  loading: boolean;
  error: string | null;
  profile: DietaryProfile | null;
  saveProfile: (profile: DietaryProfile) => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

/**
 * Boots anonymous auth and loads the user's dietary profile once, at the
 * root layout, so every screen (onboarding/scan/result/history) reads the
 * same live state via useAppState() instead of each re-deriving it.
 */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user, initializing: authInitializing, error: authError } = useAuth();
  const uid = user?.uid ?? null;
  const { profile, loading: profileLoading, error: profileError, saveProfile } = useUserProfile(uid);

  const value: AppStateValue = {
    uid,
    loading: authInitializing || (Boolean(uid) && profileLoading),
    error: authError ?? profileError,
    profile,
    saveProfile,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within an AppStateProvider');
  return ctx;
}
