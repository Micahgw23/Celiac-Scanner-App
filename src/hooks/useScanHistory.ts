import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import type { ScanRecord } from '@/types/scan';

const HISTORY_LIMIT = 50;

interface ScanHistoryState {
  records: (ScanRecord & { id: string })[];
  loading: boolean;
  error: string | null;
}

/** Live list of the user's most recent scans, newest first. */
export function useScanHistory(uid: string | null): ScanHistoryState {
  const [records, setRecords] = useState<(ScanRecord & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // uid starts null while auth is still resolving; `loading`'s initial
    // state already covers that, so there's nothing to set here yet.
    if (!uid) return;

    const q = query(collection(db, 'users', uid, 'scanHistory'), orderBy('scannedAt', 'desc'), limit(HISTORY_LIMIT));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRecords(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as ScanRecord) })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [uid]);

  return { records, loading, error };
}

/** Fire-and-forget write of a completed scan result into the user's history. */
export async function recordScan(uid: string, record: Omit<ScanRecord, 'scannedAt'>): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'scanHistory'), {
    ...record,
    scannedAt: serverTimestamp(),
  });
}
