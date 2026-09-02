# Food Scanner

An app for people with celiac disease or other dietary restrictions: scan a product's
barcode and instantly see whether it's safe for you, based on ingredient/allergen data
from [Open Food Facts](https://world.openfoodfacts.org/).

The barcode scanner and the AI assistant are both built (a restaurant safety map is
planned next — see "What's next" below). Built with [Expo](https://expo.dev) + React
Native + TypeScript, with Firebase for auth/data and a Cloudflare Worker proxying the
AI assistant.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

This app needs a Firebase project for anonymous sign-in and to store your dietary
profile and scan history.

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a project (the free Spark plan is enough).
2. **Authentication** → Sign-in method → enable **Anonymous**.
3. **Firestore Database** → Create database → start in **Native mode**.
4. Project Settings → General → "Your apps" → add a **Web app** (the JS SDK works for Expo too) → copy the config values.
5. Copy `.env.example` to `.env` and fill in the values you copied:

   ```bash
   cp .env.example .env
   ```

6. Deploy the security rules in [firestore.rules](firestore.rules) so users can only
   read/write their own data (requires the [Firebase CLI](https://firebase.google.com/docs/cli)):

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add   # select the project you created
   firebase deploy --only firestore:rules
   ```

   Until you deploy these rules, Firestore's default rules will reject all reads/writes.

### 3. Run the app

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on your phone (iOS or Android). A physical
device is required to test the barcode scanner — simulators don't have a usable camera.

## How the safety check works

`src/lib/rulesEngine.ts` compares a scanned product's Open Food Facts tags against your
selected diets/allergies (`src/lib/dietaryRules.ts`) and returns one of four verdicts:

- **Safe** — no matching allergens or traces found.
- **Not Safe** — the product's ingredients contain something on your restricted list.
- **Caution** — the product only carries a "may contain traces of" warning, not a
  direct allergen.
- **Unknown** — the product wasn't found, or doesn't have enough ingredient data to
  check. Shown instead of "Safe" whenever data is missing — a false "Safe" is worse
  than an inconclusive result.

A product being labeled e.g. "certified gluten-free" is shown as informational only —
it never overrides an actual traces/allergen warning found in the data.

Run the rules-engine tests any time with:

```bash
npm test
```

## The AI assistant

Ask about any food or brand in plain language ("Is Cheerios gluten free?"). Optional — the
scanner works without it.

**The AI never decides whether something is safe.** It looks products up in Open Food Facts and
reports what it found; the same `rulesEngine.ts` above computes the verdict on your device. That's
why a chat answer and a barcode scan of the same product always agree. If the AI answers from its
own knowledge rather than a database lookup, a "safe" result is downgraded to **Unknown** and
labeled unverified — nothing checked that it listed every allergen.

Setup is in [worker/README.md](worker/README.md): deploy the proxy worker, then set
`EXPO_PUBLIC_AI_PROXY_URL` in `.env`. The model API key lives only on the worker, never in the app.

## Manual test barcodes

Useful for exercising each verdict path on a physical device:

| Barcode | Product | Good for testing |
| --- | --- | --- |
| `0016000275287` | Cheerios | Unsafe (contains gluten) |
| `0689544083016` | Fage Total 0% yogurt | Safe for celiac-only profile; Unsafe once you add dairy-free |
| `0810032300463` | Go Raw pumpkin seeds | Caution (gluten traces, despite a "certified gluten-free" label) |
| any barcode not in the database | — | Unknown |

## Project structure

```
src/
  app/            Expo Router screens (onboarding, scan, result, history)
  lib/             Firebase setup, Open Food Facts client, dietary rules + rules engine
  hooks/          Auth, profile, and scan-history hooks
  components/     Shared UI (VerdictBadge, ProductCard, DietSelector)
  types/           Shared TypeScript types
firestore.rules      Firestore security rules (deploy via Firebase CLI)
```

## What's next

Not built yet, but the architecture leaves room for it:

- **Restaurant map** — browse and review restaurants as safe for specific diets. Needs
  identified (non-anonymous) accounts; the current anonymous auth can be upgraded via
  `linkWithCredential` without losing existing profiles/history.
