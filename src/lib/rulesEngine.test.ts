import {
  cheerios,
  emptyDataProduct,
  fageYogurt,
  goRawPumpkinSeeds,
  nonVeganProduct,
  plainSafeProduct,
} from '@/lib/__fixtures__/products';
import { evaluateProduct } from '@/lib/rulesEngine';

describe('evaluateProduct', () => {
  it('flags Unsafe when an allergens_tags entry matches the user diet', () => {
    const result = evaluateProduct(cheerios, ['celiac']);
    expect(result.status).toBe('unsafe');
    expect(result.triggeredTags).toContain('en:gluten');
    expect(result.triggeredDiets).toEqual(['celiac']);
  });

  it('only lists the diet that actually matched in a multi-diet profile', () => {
    // Fage yogurt only has a milk allergen, not gluten.
    const result = evaluateProduct(fageYogurt, ['celiac', 'dairy-free']);
    expect(result.status).toBe('unsafe');
    expect(result.triggeredDiets).toEqual(['dairy-free']);
    expect(result.triggeredDiets).not.toContain('celiac');
  });

  it('is Safe for a celiac-only profile when the only allergen is unrelated (milk)', () => {
    const result = evaluateProduct(fageYogurt, ['celiac']);
    expect(result.status).toBe('safe');
  });

  it('flags Caution when only traces_tags match (no direct allergen)', () => {
    const result = evaluateProduct(goRawPumpkinSeeds, ['celiac']);
    expect(result.status).toBe('caution');
    expect(result.triggeredTags).toContain('en:gluten');
  });

  it('regression: a certified-gluten-free label never downgrades a traces-based Caution', () => {
    // goRawPumpkinSeeds is simultaneously labeled certified-gluten-free AND
    // carries a gluten traces warning — this is real, verified Open Food Facts data.
    const result = evaluateProduct(goRawPumpkinSeeds, ['celiac']);
    expect(result.status).not.toBe('safe');
    expect(result.status).toBe('caution');
  });

  it('is Safe when ingredient data exists and nothing matches the user diets', () => {
    const result = evaluateProduct(plainSafeProduct, ['celiac', 'peanut-free']);
    expect(result.status).toBe('safe');
    expect(result.triggeredTags).toEqual([]);
  });

  it('is Unknown when the product was not found (null)', () => {
    const result = evaluateProduct(null, ['celiac']);
    expect(result.status).toBe('unknown');
  });

  it('is Unknown (not Safe) when the product has no allergen/trace/ingredient data at all', () => {
    const result = evaluateProduct(emptyDataProduct, ['celiac']);
    expect(result.status).toBe('unknown');
  });

  it('is robust to inconsistent tag casing in real data (e.g. "en:Corn")', () => {
    // Cheerios fixture includes "en:Corn" (capitalized) alongside "en:gluten".
    const result = evaluateProduct(cheerios, ['celiac']);
    expect(result.status).toBe('unsafe');
  });

  it('checks ingredients_analysis_tags for vegan/vegetarian diets', () => {
    const result = evaluateProduct(nonVeganProduct, ['vegan']);
    expect(result.status).toBe('unsafe');
    expect(result.triggeredTags).toContain('en:non-vegan');
  });

  it('returns Unknown with no triggered diets/tags when nothing is set for an empty diet list', () => {
    const result = evaluateProduct(plainSafeProduct, []);
    expect(result.status).toBe('safe');
    expect(result.triggeredDiets).toEqual([]);
  });
});
