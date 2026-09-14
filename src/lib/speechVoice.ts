/**
 * Picks the best-sounding installed text-to-speech voice.
 *
 * iOS ships only "compact" voices by default; the good Enhanced and Premium
 * ones are a ~100 MB download the user performs in Settings, and no API lets
 * an app trigger it. So the job here is to make the most of whatever is
 * actually installed.
 *
 * The critical detail: expo-speech's iOS module collapses Apple's three
 * quality levels into two (`voice.quality == .enhanced ? "Enhanced" : "Default"`),
 * so Apple's *Premium* voices are reported as `quality: "Default"`. Ranking by
 * `quality` alone therefore misses the best voices — the identifier must be
 * matched too.
 */

/** Structural shape of expo-speech's Voice, kept local so this stays pure and testable. */
export interface SpeechVoiceLike {
  identifier: string;
  name: string;
  language: string;
  quality?: string;
}

/**
 * Warm, natural en-US voices, best first. Used as a tiebreaker so the app
 * doesn't land on a clipped or unusually flat voice when several rank equally.
 */
const PREFERRED_NAMES = ['ava', 'samantha', 'allison', 'susan', 'joelle', 'zoe', 'karen', 'serena'];

/**
 * Apple's novelty voices (Bubbles, Zarvox, Bad News…). They're installed by
 * default and would be actively wrong for reading a food-safety verdict.
 */
const NOVELTY = [
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'deranged',
  'good news', 'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble',
  'zarvox', 'fred', 'grandma', 'grandpa', 'rocko', 'shelley', 'sandy', 'flo', 'eddy',
  'junior', 'kathy', 'princess', 'ralph', 'agnes', 'bruce', 'victoria',
];

function isEnglish(voice: SpeechVoiceLike): boolean {
  return typeof voice.language === 'string' && voice.language.toLowerCase().startsWith('en');
}

function isNovelty(voice: SpeechVoiceLike): boolean {
  const name = (voice.name ?? '').toLowerCase();
  return NOVELTY.some((n) => name === n || name.startsWith(`${n} `));
}

/** Higher is better. */
export function scoreVoice(voice: SpeechVoiceLike): number {
  if (!isEnglish(voice) || isNovelty(voice)) return -1;

  const id = (voice.identifier ?? '').toLowerCase();
  const name = (voice.name ?? '').toLowerCase();

  // Siri voices are blocked for third-party apps — never select one.
  if (id.includes('siri')) return -1;

  let score: number;
  if (id.includes('com.apple.voice.premium')) score = 500;
  else if (id.includes('com.apple.voice.enhanced')) score = 400;
  else if (voice.quality === 'Enhanced') score = 350;
  else if (id.includes('compact')) score = 100;
  else score = 150;

  const preferredIndex = PREFERRED_NAMES.findIndex((n) => name.includes(n));
  if (preferredIndex >= 0) score += 40 - preferredIndex * 4;

  if (voice.language?.toLowerCase() === 'en-us') score += 20;

  return score;
}

/**
 * Returns the identifier to pass to `Speech.speak({ voice })`, or undefined to
 * let the system choose (when nothing suitable is installed).
 */
export function pickBestVoice(voices: SpeechVoiceLike[] | null | undefined): string | undefined {
  let best: SpeechVoiceLike | undefined;
  let bestScore = 0;

  for (const voice of voices ?? []) {
    if (!voice || typeof voice.identifier !== 'string') continue;
    const score = scoreVoice(voice);
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best?.identifier;
}

/**
 * Whether a downloaded high-quality voice is present. When false, the app
 * offers a one-time tip pointing at the iOS Settings path — that download is
 * the single biggest free improvement available to the spoken answers.
 */
export function hasHighQualityVoice(voices: SpeechVoiceLike[] | null | undefined): boolean {
  return (voices ?? []).some((voice) => {
    if (!voice || !isEnglish(voice)) return false;
    const id = (voice.identifier ?? '').toLowerCase();
    return (
      id.includes('com.apple.voice.premium') ||
      id.includes('com.apple.voice.enhanced') ||
      voice.quality === 'Enhanced'
    );
  });
}

/** Slightly slower than default: verdicts carry detail worth hearing clearly. */
export const SPEECH_OPTIONS = {
  language: 'en-US',
  rate: 0.95,
  // Deliberately 1.0 — on iOS pitch is a formant multiplier, and shifting it
  // sounds synthetic. The robotic quality comes from the voice, not the pitch.
  pitch: 1.0,
} as const;
