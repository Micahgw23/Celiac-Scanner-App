import { DIETARY_RULES } from '@/lib/dietaryRules';
import { scanIngredientText } from '@/lib/ingredientKeywords';
import { evaluateProduct } from '@/lib/rulesEngine';
import type { DietId } from '@/types/diet';
import type { ExtractedProduct } from '@/types/ai';
import type { OffProduct } from '@/types/product';
import type { VerdictResult } from '@/types/verdict';

/**
 * Every Open Food Facts allergen tag we recognize. Anything the model emits
 * that isn't in here is discarded rather than trusted — a model that invents
 * "en:definitely-safe" must not be able to influence a verdict.
 *
 * Built from DIETARY_RULES so adding a diet automatically widens this set,
 * plus the remaining real OFF allergen taxonomy ids that no diet uses yet.
 */
const EXTRA_KNOWN_ALLERGEN_TAGS = [
  'en:celery',
  'en:mustard',
  'en:lupin',
  'en:sulphur-dioxide-and-sulphites',
  'en:gelatin',
];

export const KNOWN_TAGS: ReadonlySet<string> = new Set([
  ...Object.values(DIETARY_RULES).flatMap((rule) => [
    ...rule.unsafeAllergenTags,
    ...rule.cautionTraceTags,
    ...(rule.unsafeAnalysisTags ?? []),
    ...(rule.positiveLabelTags ?? []),
  ]),
  ...EXTRA_KNOWN_ALLERGEN_TAGS,
]);

/** Normalizes casing/whitespace and drops anything outside the known taxonomy. */
export function sanitizeTags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().toLowerCase();
    if (KNOWN_TAGS.has(tag)) seen.add(tag);
  }
  return Array.from(seen);
}

/**
 * Maps the model's extraction onto the same OffProduct shape the barcode path
 * produces, so both paths converge on one verdict function.
 *
 * The model's tags are unioned with tags derived deterministically from the
 * ingredient text (scanIngredientText), so a model that transcribes "wheat
 * flour" but forgets to emit "en:gluten" still produces a gluten verdict. The
 * union can only add tags — the scan never removes one the model reported.
 */
export function toOffProduct(extracted: ExtractedProduct): OffProduct {
  const ingredientsText = extracted.ingredientsText?.trim() || null;
  const scanned = scanIngredientText(ingredientsText);
  return {
    code: extracted.barcode ?? undefined,
    product_name: extracted.productName,
    brands: extracted.brand,
    image_front_small_url: null,
    allergens_tags: sanitizeTags([...(extracted.allergensTags ?? []), ...scanned.allergenTags]),
    traces_tags: sanitizeTags([...(extracted.tracesTags ?? []), ...scanned.traceTags]),
    labels_tags: [],
    ingredients_analysis_tags: [],
    ingredients_text: ingredientsText,
  };
}

/**
 * The verdict for an AI-identified product.
 *
 * Two safety properties, both tested:
 *  1. The verdict itself comes from `evaluateProduct` — never from the model.
 *     The model only supplies data; the deterministic engine judges it.
 *  2. A "safe" result derived from unverified model recall (rather than a real
 *     database lookup or a label photo) is downgraded to "unknown". Nothing
 *     checked that the model listed every allergen, and a false "safe" is the
 *     one outcome a celiac user cannot afford. Unsafe/Caution are never
 *     downgraded. A 'label-photo' result keeps "safe": the label itself is the
 *     source, and its text was keyword-scanned in toOffProduct.
 */
export function verdictForExtractedProduct(
  extracted: ExtractedProduct,
  userDiets: DietId[],
): VerdictResult {
  const verdict = evaluateProduct(toOffProduct(extracted), userDiets);

  if (extracted.source === 'model-knowledge' && verdict.status === 'safe') {
    return {
      status: 'unknown',
      triggeredTags: [],
      triggeredDiets: [],
      reason:
        "This wasn't found in a product database, so it couldn't be verified. Check the label before eating it.",
    };
  }

  return verdict;
}
