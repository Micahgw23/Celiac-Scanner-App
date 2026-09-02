import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import type { DietaryProfile } from '@/types/diet';

interface UserProfileState {
  profile: DietaryProfile | null;
  /** True until the initial Firestore read completes. */
  loading: boolean;
  error: string | null;
  saveProfile: (profile: DietaryProfile) => Promise<void>;
}

/** Live-syncs users/{uid}'s dietary profile. `uid` is null while auth is still resolving. */
export function useUserProfile(uid: string | null): UserProfileState {
  const [profile, setProfile] = useState<DietaryProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // uid starts null while auth is still resolving; `loading`'s initial
    // state already covers that, so there's nothing to set here yet.
    if (!uid) return;

    const unsubscribe = onSnapshot(
      doc(db, 'users', uid),
      (snapshot) => {
        const data = snapshot.data();
        setProfile(data ? (data.dietaryProfile as DietaryProfile) : null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  async function saveProfile(next: DietaryProfile) {
    if (!uid) throw new Error('Cannot save a profile before signing in.');
    const ref = doc(db, 'users', uid);
    const existing = await getDoc(ref);
    await setDoc(
      ref,
      {
        dietaryProfile: next,
        updatedAt: serverTimestamp(),
        ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );
  }

  return { profile, loading, error, saveProfile };
}
