import { DIETARY_RULES } from '@/lib/dietaryRules';
import type { DietId } from '@/types/diet';
import type { OffProduct } from '@/types/product';
import type { TriggeredMatch, VerdictResult } from '@/types/verdict';

/**
 * The core safety check: does this product violate any of the user's diets?
 *
 * Fails closed, not open — this matters for a celiac safety app:
 *  - Missing/insufficient data => Unknown, never Safe.
 *  - A positive label (e.g. "certified-gluten-free") never suppresses an
 *    Unsafe/Caution verdict computed from allergens_tags/traces_tags. Real
 *    Open Food Facts data has products that are both labeled certified-gluten-free
 *    AND carry a gluten traces warning — see rulesEngine.test.ts.
 *
 * Verdict precedence: Unsafe > Caution > Unknown (no data) > Safe.
 */
export function evaluateProduct(product: OffProduct | null | undefined, userDiets: DietId[]): VerdictResult {
  if (!product) {
    return {
      status: 'unknown',
      triggeredTags: [],
      triggeredDiets: [],
      reason: 'Product not found in Open Food Facts.',
    };
  }

  const allergenTags = normalizeTags(product.allergens_tags);
  const traceTags = normalizeTags(product.traces_tags);
  const analysisTags = normalizeTags(product.ingredients_analysis_tags);

  const unsafe: TriggeredMatch[] = [];
  const caution: TriggeredMatch[] = [];

  for (const dietId of userDiets) {
    const rule = DIETARY_RULES[dietId];
    if (!rule) continue;

    for (const tag of rule.unsafeAllergenTags) {
      if (allergenTags.includes(tag)) unsafe.push({ tag, diet: dietId });
    }
    for (const tag of rule.unsafeAnalysisTags ?? []) {
      if (analysisTags.includes(tag)) unsafe.push({ tag, diet: dietId });
    }
    for (const tag of rule.cautionTraceTags) {
      if (traceTags.includes(tag)) caution.push({ tag, diet: dietId });
    }
  }

  if (unsafe.length > 0) {
    return buildVerdict('unsafe', unsafe, describeMatches('This product contains', unsafe));
  }

  if (caution.length > 0) {
    return buildVerdict('caution', caution, describeMatches('This product may contain traces of', caution));
  }

  const hasAnyData = allergenTags.length > 0 || traceTags.length > 0 || Boolean(product.ingredients_text);
  if (!hasAnyData) {
    return {
      status: 'unknown',
      triggeredTags: [],
      triggeredDiets: [],
      reason: 'Not enough ingredient/allergen data to verify this product.',
    };
  }

  return {
    status: 'safe',
    triggeredTags: [],
    triggeredDiets: [],
    reason: 'No matching allergens or traces found for your diets.',
  };
}

function normalizeTags(tags?: string[] | null): string[] {
  return (tags ?? []).map((t) => t.trim().toLowerCase());
}

function buildVerdict(status: 'unsafe' | 'caution', matches: TriggeredMatch[], reason: string): VerdictResult {
  return {
    status,
    triggeredTags: dedupe(matches.map((m) => m.tag)),
    triggeredDiets: dedupe(matches.map((m) => m.diet)),
    reason,
  };
}

function describeMatches(prefix: string, matches: TriggeredMatch[]): string {
  const parts = matches.map((m) => `${m.tag.replace('en:', '')} (violates your ${DIETARY_RULES[m.diet].label} diet)`);
  return `${prefix} ${dedupe(parts).join(', ')}.`;
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
