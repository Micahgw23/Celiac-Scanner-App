import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/lib/firebase';
import type { AssistantChatMessage, ExtractedProduct } from '@/types/ai';

const HISTORY_LIMIT = 50;

interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  products?: ExtractedProduct[];
  createdAt: unknown;
}

/**
 * Loads the user's saved conversation once on mount, oldest first.
 *
 * Deliberately a one-shot load rather than a live subscription: the screen owns
 * the in-flight conversation in local state, and a live listener would fight it
 * by re-ordering messages mid-turn.
 */
export function useAssistantHistory(uid: string | null) {
  const [initialMessages, setInitialMessages] = useState<AssistantChatMessage[] | null>(null);

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'users', uid, 'assistantMessages'),
      orderBy('createdAt', 'desc'),
      limit(HISTORY_LIMIT),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded = snapshot.docs
          .map((d) => d.data() as StoredMessage)
          .reverse()
          .map<AssistantChatMessage>(({ role, content, products }) => ({
            role,
            content,
            ...(products ? { products } : {}),
          }));
        setInitialMessages(loaded);
        unsubscribe();
      },
      () => setInitialMessages([]),
    );

    return unsubscribe;
  }, [uid]);

  return { initialMessages };
}

/** Fire-and-forget persistence of one chat turn. */
export async function saveAssistantMessage(
  uid: string,
  message: AssistantChatMessage,
): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'assistantMessages'), {
    role: message.role,
    content: message.content,
    // Firestore rejects undefined; only include products when present.
    ...(message.products ? { products: message.products } : {}),
    createdAt: serverTimestamp(),
  });
}
