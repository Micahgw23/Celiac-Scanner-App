import { AuthError, verifyFirebaseToken } from './firebaseAuth';
import { lookupProduct } from './openFoodFacts';
import { LABEL_SYSTEM_PROMPT, SYSTEM_PROMPT, buildProfileContext } from './prompt';

export interface Env {
  OPENROUTER_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  /** Optional: KV namespace for per-user daily quotas. */
  AI_QUOTA?: KVNamespace;
  /** Optional: Cloudflare rate limiting binding for burst protection. */
  BURST_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  /** Workers AI binding, used for speech-to-text. */
  AI?: Ai;
  MODEL?: string;
  DAILY_LIMIT?: string;
  TRANSCRIBE_DAILY_LIMIT?: string;
}

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
const DEFAULT_DAILY_LIMIT = 20;
const DEFAULT_TRANSCRIBE_DAILY_LIMIT = 40;
const MAX_TOOL_ROUNDS = 3;
const MAX_MESSAGES = 20;
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

/**
 * Body size caps. The free plan allows far larger bodies, but only 10 ms of CPU
 * per request, and parsing a big JSON body is CPU — so these stay small. The
 * app downsizes photos (~1280px JPEG) and caps recordings at 30s to fit.
 */
const MAX_BODY_BYTES = {
  ask: 64 * 1024,
  label: 1024 * 1024,
  transcribe: 1.5 * 1024 * 1024,
};

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

const LOOKUP_TOOL = {
  type: 'function' as const,
  function: {
    name: 'lookup_product',
    description:
      'Look up a food product in the Open Food Facts database by name and/or brand. Always use this before answering about a specific branded product.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Product name and brand, e.g. "Barilla spaghetti" or "Cheerios".',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Verifies the caller's Firebase ID token and applies the burst limiter.
 * Returns the uid, or an error Response to send back as-is.
 */
async function authenticate(request: Request, env: Env): Promise<string | Response> {
  if (!env.FIREBASE_PROJECT_ID) return json({ error: 'Server is missing its project id.' }, 500);

  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return json({ error: 'Sign-in required.' }, 401);

  let uid: string;
  try {
    uid = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
  } catch (err) {
    return json({ error: err instanceof AuthError ? err.message : 'Could not verify sign-in.' }, 401);
  }

  if (env.BURST_LIMITER) {
    const { success } = await env.BURST_LIMITER.limit({ key: uid });
    if (!success) return json({ error: 'Slow down a moment, then try again.' }, 429);
  }

  return uid;
}

/**
 * Enforces a per-user daily cap. Returns true if the request is allowed.
 * KV's free tier (~1k writes/day) doubles as a hard ceiling on total spend,
 * which is intentional for an MVP: it fails closed rather than billing.
 *
 * `bucket` separates counters: '' is the OpenRouter quota shared by /ask and
 * /label (key format unchanged from before, so existing counters carry over);
 * 'transcribe' is the speech-to-text quota.
 */
async function checkDailyQuota(
  env: Env,
  uid: string,
  bucket: '' | 'transcribe',
  limit: number,
): Promise<boolean> {
  if (!env.AI_QUOTA) return true; // Not configured — burst limiter is the only guard.

  const day = new Date().toISOString().slice(0, 10);
  const key = bucket ? `quota:${bucket}:${uid}:${day}` : `quota:${uid}:${day}`;

  const current = Number((await env.AI_QUOTA.get(key)) ?? '0');
  if (current >= limit) return false;

  // 48h TTL so yesterday's keys expire on their own.
  await env.AI_QUOTA.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}

/** Reads and parses a JSON body, refusing anything over `maxBytes` with a 413. */
async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T | Response> {
  const tooLarge = () =>
    json({ error: 'That upload is too large. Try again with a smaller photo or a shorter recording.' }, 413);

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) return tooLarge();

  const text = await request.text();
  if (text.length > maxBytes) return tooLarge();

  try {
    return JSON.parse(text) as T;
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
}

async function callOpenRouter(
  env: Env,
  messages: ChatMessage[],
  { tools }: { tools: boolean },
): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Food Scanner',
    },
    body: JSON.stringify({
      model: env.MODEL ?? DEFAULT_MODEL,
      messages,
      ...(tools ? { tools: [LOOKUP_TOOL] } : {}),
      temperature: 0.2,
      max_tokens: 1500,
      // Some OpenRouter models (e.g. kimi-k2.5) default reasoning ON, and
      // reasoning tokens are billed/counted as output tokens against the same
      // max_tokens budget above -- without this, the model can burn the whole
      // budget "thinking" and return an empty/truncated answer. This app has
      // no use for a visible reasoning trace, so turn it off outright.
      reasoning: { effort: 'none' },
      response_format: { type: 'json_object' },
    }),
  });
}

/** The model is asked for raw JSON, but tolerate fenced output rather than failing the turn. */
function parseModelJson(raw: string): { answer: string; products: unknown[] } {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const parsed = JSON.parse(cleaned) as { answer?: unknown; products?: unknown };
    return {
      answer: typeof parsed.answer === 'string' ? parsed.answer : cleaned,
      products: Array.isArray(parsed.products) ? parsed.products : [],
    };
  } catch {
    // Model ignored the format — surface its prose rather than an error page.
    return { answer: cleaned, products: [] };
  }
}

type Completion = { choices?: { message?: ChatMessage & { content?: string | null } }[] };

function profileMessage(body: { conditions?: unknown; customRestrictions?: unknown }): ChatMessage {
  const strings = (value: unknown) =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, 20) : [];
  return {
    role: 'system',
    content: buildProfileContext(strings(body.conditions), strings(body.customRestrictions)),
  };
}

async function handleAsk(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'Server is missing its API key.' }, 500);

  const uid = await authenticate(request, env);
  if (uid instanceof Response) return uid;

  const body = await readJsonBody<{
    messages?: { role: string; content: string }[];
    conditions?: string[];
    customRestrictions?: string[];
  }>(request, MAX_BODY_BYTES.ask);
  if (body instanceof Response) return body;

  const incoming = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES);
  if (incoming.length === 0) return json({ error: 'No message provided.' }, 400);

  const limit = Number(env.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  if (!(await checkDailyQuota(env, uid, '', limit))) {
    return json({ error: "You've reached today's limit for AI questions. Try again tomorrow." }, 429);
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    profileMessage(body),
    ...incoming.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  // Tool loop: let the model look products up, then answer. Bounded so a
  // misbehaving model can't spin and run up cost.
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await callOpenRouter(env, messages, { tools: true });
    if (!res.ok) {
      const detail = await res.text();
      console.error('OpenRouter error', res.status, detail);
      return json({ error: 'The assistant is unavailable right now. Try again shortly.' }, 502);
    }

    const message = ((await res.json()) as Completion).choices?.[0]?.message;
    if (!message) return json({ error: 'The assistant returned an empty response.' }, 502);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0 || round === MAX_TOOL_ROUNDS) {
      const { answer, products } = parseModelJson(typeof message.content === 'string' ? message.content : '');
      return json({ answer, products });
    }

    messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: toolCalls });

    for (const call of toolCalls) {
      let query = '';
      try {
        query = (JSON.parse(call.function.arguments) as { query?: string }).query ?? '';
      } catch {
        query = '';
      }
      const result = query ? await lookupProduct(query) : { found: false };
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return json({ error: 'The assistant could not complete the request.' }, 502);
}

/**
 * Reads an ingredient label from a photo. One model call and no tools: the
 * label itself is the source of truth, and skipping the tool loop avoids
 * re-sending (and re-billing) the image on every round.
 */
async function handleLabel(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'Server is missing its API key.' }, 500);

  const uid = await authenticate(request, env);
  if (uid instanceof Response) return uid;

  const body = await readJsonBody<{
    imageBase64?: unknown;
    conditions?: unknown;
    customRestrictions?: unknown;
  }>(request, MAX_BODY_BYTES.label);
  if (body instanceof Response) return body;

  // Raw base64 JPEG (starts with the base64 of the JPEG magic bytes FF D8 FF).
  // A prefix check instead of a full-string regex keeps CPU time flat.
  const image = body.imageBase64;
  if (typeof image !== 'string' || !image.startsWith('/9j/')) {
    return json({ error: 'Expected a JPEG photo.' }, 400);
  }

  const limit = Number(env.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  if (!(await checkDailyQuota(env, uid, '', limit))) {
    return json({ error: "You've reached today's limit for AI requests. Try again tomorrow." }, 429);
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: LABEL_SYSTEM_PROMPT },
    profileMessage(body),
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Read the ingredient label in this photo.' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
      ],
    },
  ];

  const res = await callOpenRouter(env, messages, { tools: false });
  if (!res.ok) {
    const detail = await res.text();
    console.error('OpenRouter label error', res.status, detail);
    return json({ error: 'Could not read the label right now. Try again shortly.' }, 502);
  }

  const message = ((await res.json()) as Completion).choices?.[0]?.message;
  const parsed = parseModelJson(typeof message?.content === 'string' ? message.content : '');

  // The source is set here, not trusted from the model: this data came from
  // the user's photo regardless of what the model claims.
  const products = parsed.products
    .slice(0, 1)
    .filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null)
    .map((p) => ({ ...p, source: 'label-photo' }));

  const answer =
    products.length > 0
      ? parsed.answer
      : parsed.answer || "I couldn't read the label. Try again closer, in good light, with the ingredient list filling the frame.";

  return json({ answer, products });
}

/** Speech-to-text for voice questions, via Workers AI Whisper (free daily allocation). */
async function handleTranscribe(request: Request, env: Env): Promise<Response> {
  if (!env.AI) return json({ error: 'Voice is not set up on the server.' }, 500);

  const uid = await authenticate(request, env);
  if (uid instanceof Response) return uid;

  const body = await readJsonBody<{ audioBase64?: unknown }>(request, MAX_BODY_BYTES.transcribe);
  if (body instanceof Response) return body;

  const audio = body.audioBase64;
  if (typeof audio !== 'string' || audio.length < 100) {
    return json({ error: 'No recording received.' }, 400);
  }

  const limit = Number(env.TRANSCRIBE_DAILY_LIMIT ?? DEFAULT_TRANSCRIBE_DAILY_LIMIT);
  if (!(await checkDailyQuota(env, uid, 'transcribe', limit))) {
    return json({ error: "You've reached today's limit for voice questions. You can still type." }, 429);
  }

  let text = '';
  try {
    const result = await env.AI.run(WHISPER_MODEL, {
      audio,
      task: 'transcribe',
      language: 'en',
      vad_filter: true,
      // Biases recognition toward this app's vocabulary, so "gluten" doesn't
      // come back as "glutton" — questions are sent automatically.
      initial_prompt:
        'A question about food, ingredients, allergies, celiac disease, gluten, dairy, nuts, or a brand name.',
    });
    text = (result as { text?: string }).text?.trim() ?? '';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Whisper error', message);
    // The free Workers AI allocation is shared by all users; when it runs out
    // for the day, say so plainly rather than returning a generic failure.
    if (/neuron|quota|limit|capacity|4006/i.test(message)) {
      return json({ error: 'Voice is busy today. Type your question instead.' }, 503);
    }
    return json({ error: "Couldn't process that recording. Try again, or type your question." }, 502);
  }

  if (!text) return json({ error: "I didn't catch that. Try again a little closer to the phone." }, 422);
  return json({ text });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const { pathname } = new URL(request.url);
    if (pathname === '/health') return json({ ok: true });
    if (request.method === 'POST') {
      if (pathname === '/ask') return handleAsk(request, env);
      if (pathname === '/label') return handleLabel(request, env);
      if (pathname === '/transcribe') return handleTranscribe(request, env);
    }

    return json({ error: 'Not found.' }, 404);
  },
};
