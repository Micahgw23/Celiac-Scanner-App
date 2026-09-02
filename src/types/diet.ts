/**
 * The set of dietary restrictions/allergies the app understands out of the box.
 * Each one maps to a rule in `src/lib/dietaryRules.ts` — adding a new diet is a
 * data-table entry there, not a code change.
 */
export type DietId =
  | 'celiac'
  | 'dairy-free'
  | 'egg-free'
  | 'peanut-free'
  | 'tree-nut-free'
  | 'soy-free'
  | 'shellfish-free'
  | 'fish-free'
  | 'sesame-free'
  | 'vegan'
  | 'vegetarian';

export interface DietaryProfile {
  /** Diets/allergies matched against Open Food Facts tag data. */
  conditions: DietId[];
  /**
   * Free-text restrictions the user cares about that aren't in `conditions`.
   * Informational only in v1 — not matched against product data automatically.
   */
  customRestrictions: string[];
}
