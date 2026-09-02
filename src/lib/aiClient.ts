import { auth } from '@/lib/firebase';
import type { AskResponse, ExtractedProduct } from '@/types/ai';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL;

/** Network/server failure — distinct from the assistant answering "I don't know". */
export class AiRequestError extends Error {}
/** The user hit their daily/burst limit. Message is safe to show as-is. */
export class AiRateLimitError extends Error {}

export function isAiConfigured(): boolean {
  return Boolean(PROXY_URL);
}

interface AskOptions {
  messages: { role: 'user' | 'assistant'; content: string }[];
  conditions: string[];
  customRestrictions: string[];
}

/**
 * Sends a question to the AI proxy. The proxy holds the model API key — it is
 * never in this bundle, since anything shipped in the app is readable.
 */
export async function ask({
  messages,
  conditions,
  customRestrictions,
}: AskOptions): Promise<AskResponse> {
  if (!PROXY_URL) {
    throw new AiRequestError(
      'The assistant is not configured yet. Add EXPO_PUBLIC_AI_PROXY_URL to .env (see .env.example).',
    );
  }

  const user = auth.currentUser;
  if (!user) throw new AiRequestError('You need to be signed in to use the assistant.');

  const token = await user.getIdToken();

  let res: Response;
  try {
    res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages, conditions, customRestrictions }),
    });
  } catch {
    throw new AiRequestError('Could not reach the assistant. Check your connection and try again.');
  }

  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AiRateLimitError(body.error ?? 'Too many requests. Try again later.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AiRequestError(body.error ?? `The assistant failed (${res.status}).`);
  }

  const body = (await res.json()) as { answer?: unknown; products?: unknown };
  return {
    answer: typeof body.answer === 'string' ? body.answer : '',
    products: Array.isArray(body.products) ? (body.products as ExtractedProduct[]) : [],
  };
}
