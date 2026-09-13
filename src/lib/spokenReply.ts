import { verdictForExtractedProduct } from '@/lib/aiExtraction';
import type { ExtractedProduct } from '@/types/ai';
import type { DietId } from '@/types/diet';
import type { VerdictStatus } from '@/types/verdict';

/** How each verdict is said out loud. "Not safe" reads better than "unsafe". */
const SPOKEN_STATUS: Record<VerdictStatus, string> = {
  safe: 'Safe',
  unsafe: 'Not safe',
  caution: 'Caution',
  unknown: 'Unknown',
};

/** Markdown and emoji are for the eye; strip them so they aren't read aloud. */
function forSpeech(text: string): string {
  return text
    .replace(/[*_`#>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[•⚠︎️✅❌]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Builds what the assistant says out loud.
 *
 * The verdict is spoken FIRST, and it's the same deterministic verdict the
 * badge shows — computed here from the product data, never taken from the
 * model's prose. Someone listening with the phone in their pocket hears the
 * same judgement a person reading the screen sees.
 */
export function buildSpokenReply(
  answer: string,
  products: ExtractedProduct[] | undefined,
  conditions: DietId[],
): string {
  const verdicts = (products ?? []).map((product) => {
    const { status } = verdictForExtractedProduct(product, conditions);
    const name = product.productName?.trim() || 'That product';
    return `${name}: ${SPOKEN_STATUS[status]}.`;
  });

  return [...verdicts, forSpeech(answer)].filter(Boolean).join(' ').trim();
}
