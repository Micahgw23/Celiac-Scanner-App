import { AuthError, verifyFirebaseToken } from './firebaseAuth';
import { lookupProduct } from './openFoodFacts';
import { SYSTEM_PROMPT, buildProfileContext } from './prompt';

export interface Env {
  OPENROUTER_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  /** Optional: KV namespace for per-user daily quotas. */
  AI_QUOTA?: KVNamespace;
  /** Optional: Cloudflare rate limiting binding for burst protection. */
  BURST_LIMITER?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };
  MODEL?: string;
  DAILY_LIMIT?: string;
}

const DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
const DEFAULT_DAILY_LIMIT = 20;
const MAX_TOOL_ROUNDS = 3;
const MAX_MESSAGES = 20;

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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
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
 * Enforces a per-user daily cap. Returns true if the request is allowed.
 * KV's free tier (~1k writes/day) doubles as a hard ceiling on total spend,
 * which is intentional for an MVP: it fails closed rather than billing.
 */
async function checkDailyQuota(env: Env, uid: string): Promise<boolean> {
  if (!env.AI_QUOTA) return true; // Not configured — burst limiter is the only guard.

  const limit = Number(env.DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${uid}:${day}`;

  const current = Number((await env.AI_QUOTA.get(key)) ?? '0');
  if (current >= limit) return false;

  // 48h TTL so yesterday's keys expire on their own.
  await env.AI_QUOTA.put(key, String(current + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}

async function callOpenRouter(env: Env, messages: ChatMessage[]): Promise<Response> {
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
      tools: [LOOKUP_TOOL],
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

async function handleAsk(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) return json({ error: 'Server is missing its API key.' }, 500);
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

  if (!(await checkDailyQuota(env, uid))) {
    return json({ error: "You've reached today's limit for AI questions. Try again tomorrow." }, 429);
  }

  let body: {
    messages?: { role: string; content: string }[];
    conditions?: string[];
    customRestrictions?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const incoming = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES);
  if (incoming.length === 0) return json({ error: 'No message provided.' }, 400);

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'system',
      content: buildProfileContext(body.conditions ?? [], body.customRestrictions ?? []),
    },
    ...incoming.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  // Tool loop: let the model look products up, then answer. Bounded so a
  // misbehaving model can't spin and run up cost.
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await callOpenRouter(env, messages);
    if (!res.ok) {
      const detail = await res.text();
      console.error('OpenRouter error', res.status, detail);
      return json({ error: 'The assistant is unavailable right now. Try again shortly.' }, 502);
    }

    const completion = (await res.json()) as {
      choices?: { message?: ChatMessage & { content?: string | null } }[];
    };
    const message = completion.choices?.[0]?.message;
    if (!message) return json({ error: 'The assistant returned an empty response.' }, 502);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0 || round === MAX_TOOL_ROUNDS) {
      const { answer, products } = parseModelJson(message.content ?? '');
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const { pathname } = new URL(request.url);
    if (pathname === '/health') return json({ ok: true });
    if (pathname === '/ask' && request.method === 'POST') return handleAsk(request, env);

    return json({ error: 'Not found.' }, 404);
  },
};
