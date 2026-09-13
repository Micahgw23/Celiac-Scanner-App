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

/**
 * POSTs to the AI proxy with the user's Firebase ID token. The proxy holds the
 * model API key — it is never in this bundle, since anything shipped in the app
 * is readable. Server error messages are written for users, so they're surfaced
 * as-is.
 */
async function postToProxy(path: string, payload: unknown): Promise<Record<string, unknown>> {
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
    res = await fetch(`${PROXY_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new AiRequestError('Could not reach the assistant. Check your connection and try again.');
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const serverMessage = typeof body.error === 'string' ? body.error : undefined;

  if (res.status === 429) {
    throw new AiRateLimitError(serverMessage ?? 'Too many requests. Try again later.');
  }
  if (res.status === 413) {
    throw new AiRequestError(serverMessage ?? 'That upload is too large.');
  }
  if (!res.ok) {
    throw new AiRequestError(serverMessage ?? `The assistant failed (${res.status}).`);
  }

  return body;
}

function toAskResponse(body: Record<string, unknown>): AskResponse {
  return {
    answer: typeof body.answer === 'string' ? body.answer : '',
    products: Array.isArray(body.products) ? (body.products as ExtractedProduct[]) : [],
  };
}

interface AskOptions {
  messages: { role: 'user' | 'assistant'; content: string }[];
  conditions: string[];
  customRestrictions: string[];
}

/** Sends a chat question to the AI proxy. */
export async function ask({ messages, conditions, customRestrictions }: AskOptions): Promise<AskResponse> {
  return toAskResponse(await postToProxy('/ask', { messages, conditions, customRestrictions }));
}

interface ReadLabelOptions {
  /** Raw base64 JPEG, no `data:` prefix. */
  imageBase64: string;
  conditions: string[];
  customRestrictions: string[];
}

/**
 * Sends a photo of an ingredient label to be transcribed and tagged. The
 * response carries extracted data only — the verdict is computed on-device by
 * verdictForExtractedProduct.
 */
export async function readLabel({
  imageBase64,
  conditions,
  customRestrictions,
}: ReadLabelOptions): Promise<AskResponse> {
  const response = toAskResponse(
    await postToProxy('/label', { imageBase64, conditions, customRestrictions }),
  );
  // The server already sets this; enforce it here too so a label result can
  // never be mistaken for a database lookup.
  return {
    ...response,
    products: response.products.map((p) => ({ ...p, source: 'label-photo' as const })),
  };
}

/** Speech-to-text for a recorded voice question. `audioBase64` is the raw m4a bytes, base64. */
export async function transcribe({ audioBase64 }: { audioBase64: string }): Promise<string> {
  const body = await postToProxy('/transcribe', { audioBase64 });
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new AiRequestError("I didn't catch that. Try again.");
  return text;
}
