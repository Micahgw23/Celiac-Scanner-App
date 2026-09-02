# AI proxy worker

A small Cloudflare Worker that sits between the app and the AI model.

**Why it exists:** anything bundled into the Expo app is readable by anyone who installs it, so the
model API key cannot live there. This worker holds the key, verifies that the caller is a real
signed-in user of the app, and enforces usage limits.

## What it does

1. Verifies the caller's Firebase ID token (RS256 signature against Google's public keys, plus
   `aud`/`iss`/`exp` checks). No valid token, no model call.
2. Rate limits per user — a short burst window plus an optional daily cap.
3. Calls [OpenRouter](https://openrouter.ai) with `moonshotai/kimi-k2.5`, giving the model one tool,
   `lookup_product`, backed by Open Food Facts so answers are grounded in real data.
4. Returns `{ answer, products[] }`. **It never returns a verdict** — the app computes safe/unsafe
   itself with the same rules engine the barcode scanner uses (`src/lib/aiExtraction.ts`).

## Setup

```bash
cd worker
npm install
npx wrangler login
```

> **macOS note:** this machine reports macOS 13.4, and Wrangler warns that its *local* runtime
> (`wrangler dev`) needs 13.5+. Deploying (`npm run deploy`) builds and uploads to Cloudflare, so it
> is unaffected — but if `wrangler dev` misbehaves locally, test against the deployed worker instead.

Set the API key as a secret (get one at https://openrouter.ai/keys):

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

> OpenRouter is prepaid — add a small amount of credit (~$5 goes a very long way at Kimi K2.5
> pricing, roughly 4,000 questions) or paid models will return an insufficient-credit error.

Create the KV namespace used for daily per-user quotas, then paste the printed id into
`wrangler.toml` and uncomment that block:

```bash
npx wrangler kv namespace create AI_QUOTA
```

Deploy:

```bash
npm run deploy
```

Copy the deployed URL into the app's `.env` as `EXPO_PUBLIC_AI_PROXY_URL`.

## Cost controls

| Control | Where | Default |
| --- | --- | --- |
| Auth required | `firebaseAuth.ts` | Signed-in app users only |
| Burst limit | `wrangler.toml` | 6 requests / 60s per user |
| Daily cap | `AI_QUOTA` KV | 20 requests / day per user (`DAILY_LIMIT`) |
| Tool-loop bound | `index.ts` | Max 3 lookup rounds per question |
| Platform ceiling | Cloudflare free tier | ~100k requests/day, then requests fail rather than bill |

At Kimi K2.5 pricing (~$0.45/1M input, $2.25/1M output) a typical question costs about **$0.001**.

This effectively caps total spend on the free plan — a deliberate fail-closed property, not an oversight.
Raise it by upgrading the Cloudflare plan when real usage justifies it.

## Testing

```bash
# Should return {"ok":true}
curl https://<your-worker>.workers.dev/health

# Should return 401 — no token
curl -X POST https://<your-worker>.workers.dev/ask \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Is Cheerios gluten free?"}]}'
```

To test a real call you need a Firebase ID token from a signed-in app session.

## Changing model

Edit `MODEL` in `wrangler.toml` — any [OpenRouter model id](https://openrouter.ai/models) works
(e.g. `deepseek/deepseek-v4-flash`, `anthropic/claude-haiku-4.5`). Redeploy to apply. The model must
support tool calling for the product lookup to work.
