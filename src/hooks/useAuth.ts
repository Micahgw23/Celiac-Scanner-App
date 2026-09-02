import { onAuthStateChanged, signInAnonymously, type User } from '@firebase/auth';
import { useEffect, useState } from 'react';

import { auth, isFirebaseConfigured } from '@/lib/firebase';

const CONFIG_ERROR = 'Firebase is not configured yet. Add your project keys to .env (see .env.example).';

interface AuthState {
  user: User | null;
  /** True until we know whether we have a signed-in user or not. */
  initializing: boolean;
  error: string | null;
}

/**
 * Signs the user in anonymously on first launch and keeps `user` in sync.
 * Persisted via AsyncStorage (see src/lib/firebase.ts), so the same anonymous
 * uid — and therefore the same profile/history — comes back on every app
 * restart rather than creating a new anonymous user each time.
 */
export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  // isFirebaseConfigured() doesn't depend on anything that changes, so it's
  // resolved as the initial state rather than via a setState call inside the
  // effect body (every setState below happens inside a subscription/promise
  // callback, not synchronously in the effect itself).
  const [initializing, setInitializing] = useState(() => isFirebaseConfigured());
  const [error, setError] = useState<string | null>(() => (isFirebaseConfigured() ? null : CONFIG_ERROR));

  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (firebaseUser) {
          setUser(firebaseUser);
          setInitializing(false);
        } else {
          signInAnonymously(auth).catch((err) => {
            setError(err instanceof Error ? err.message : 'Failed to sign in.');
            setInitializing(false);
          });
        }
      },
      (err) => {
        setError(err.message);
        setInitializing(false);
      },
    );

    return unsubscribe;
  }, []);

  return { user, initializing, error };
}
