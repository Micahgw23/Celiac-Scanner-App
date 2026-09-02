import type { DietId } from '@/types/diet';

/**
 * Maps one diet/allergy to the Open Food Facts tags that matter for it.
 *
 * - `unsafeAllergenTags` / `unsafeAnalysisTags`: presence => Unsafe.
 * - `cautionTraceTags`: presence (and no unsafe match) => Caution ("may contain").
 * - `positiveLabelTags`: shown as an informational badge ONLY. A positive label
 *   (e.g. "certified gluten-free") must never downgrade an Unsafe/Caution verdict
 *   computed from allergens/traces — real Open Food Facts data has products
 *   labeled "certified-gluten-free" that also carry a gluten traces warning.
 *   See rulesEngine.ts and its tests for that exact case.
 */
export interface DietRule {
  id: DietId;
  label: string;
  unsafeAllergenTags: string[];
  cautionTraceTags: string[];
  unsafeAnalysisTags?: string[];
  positiveLabelTags?: string[];
}

// Real OFF allergen taxonomy ids (confirmed against the live allergens.json
// taxonomy and real product payloads while designing this app):
// en:gluten, en:milk, en:eggs, en:fish, en:crustaceans, en:molluscs, en:peanuts,
// en:nuts, en:sesame-seeds, en:soybeans, en:celery, en:mustard, en:lupin,
// en:sulphur-dioxide-and-sulphites, en:gelatin.
export const DIETARY_RULES: Record<DietId, DietRule> = {
  celiac: {
    id: 'celiac',
    label: 'Celiac / Gluten-Free (strict)',
    unsafeAllergenTags: ['en:gluten'],
    cautionTraceTags: ['en:gluten'],
    positiveLabelTags: ['en:gluten-free', 'en:no-gluten', 'en:certified-gluten-free'],
  },
  'dairy-free': {
    id: 'dairy-free',
    label: 'Dairy-Free / Milk Allergy',
    unsafeAllergenTags: ['en:milk'],
    cautionTraceTags: ['en:milk'],
  },
  'egg-free': {
    id: 'egg-free',
    label: 'Egg-Free',
    unsafeAllergenTags: ['en:eggs'],
    cautionTraceTags: ['en:eggs'],
  },
  'peanut-free': {
    id: 'peanut-free',
    label: 'Peanut-Free',
    unsafeAllergenTags: ['en:peanuts'],
    cautionTraceTags: ['en:peanuts'],
  },
  'tree-nut-free': {
    id: 'tree-nut-free',
    label: 'Tree Nut-Free',
    unsafeAllergenTags: ['en:nuts'],
    cautionTraceTags: ['en:nuts'],
  },
  'soy-free': {
    id: 'soy-free',
    label: 'Soy-Free',
    unsafeAllergenTags: ['en:soybeans'],
    cautionTraceTags: ['en:soybeans'],
  },
  'shellfish-free': {
    id: 'shellfish-free',
    label: 'Shellfish-Free',
    unsafeAllergenTags: ['en:crustaceans', 'en:molluscs'],
    cautionTraceTags: ['en:crustaceans', 'en:molluscs'],
  },
  'fish-free': {
    id: 'fish-free',
    label: 'Fish-Free',
    unsafeAllergenTags: ['en:fish'],
    cautionTraceTags: ['en:fish'],
  },
  'sesame-free': {
    id: 'sesame-free',
    label: 'Sesame-Free',
    unsafeAllergenTags: ['en:sesame-seeds'],
    cautionTraceTags: ['en:sesame-seeds'],
  },
  vegan: {
    id: 'vegan',
    label: 'Vegan',
    unsafeAllergenTags: [],
    cautionTraceTags: [],
    unsafeAnalysisTags: ['en:non-vegan'],
  },
  vegetarian: {
    id: 'vegetarian',
    label: 'Vegetarian',
    unsafeAllergenTags: [],
    cautionTraceTags: [],
    unsafeAnalysisTags: ['en:non-vegetarian'],
  },
};

export const ALL_DIETARY_RULES: DietRule[] = Object.values(DIETARY_RULES);
