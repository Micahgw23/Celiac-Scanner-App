import { scanIngredientText } from '@/lib/ingredientKeywords';

describe('scanIngredientText', () => {
  it('finds gluten from a wheat ingredient', () => {
    expect(scanIngredientText('Whole grain wheat flour, sugar, salt.').allergenTags).toContain(
      'en:gluten',
    );
  });

  it('does not treat buckwheat as wheat (buckwheat is gluten-free)', () => {
    expect(scanIngredientText('Buckwheat flour, water, salt.')).toEqual({
      allergenTags: [],
      traceTags: [],
    });
  });

  it('finds gluten from barley malt', () => {
    expect(scanIngredientText('Rice, barley malt extract.').allergenTags).toContain('en:gluten');
  });

  it('does not treat maltodextrin as malt', () => {
    expect(scanIngredientText('Corn, maltodextrin, salt.').allergenTags).not.toContain('en:gluten');
  });

  it('puts a "may contain" sentence into traces, not direct allergens', () => {
    const result = scanIngredientText('Rice, sugar, salt. May contain wheat.');
    expect(result.traceTags).toEqual(['en:gluten']);
    expect(result.allergenTags).toEqual([]);
  });

  it('handles "made in a facility" statements as traces', () => {
    const result = scanIngredientText(
      'Almonds, sea salt. Made in a facility that also processes peanuts and wheat.',
    );
    expect(result.allergenTags).toEqual(['en:nuts']);
    expect(result.traceTags).toEqual(expect.arrayContaining(['en:gluten', 'en:peanuts']));
  });

  it('keeps direct allergens before a trace sentence as direct', () => {
    const result = scanIngredientText('Wheat flour, milk. May contain soy.');
    expect(result.allergenTags).toEqual(expect.arrayContaining(['en:gluten', 'en:milk']));
    expect(result.traceTags).toEqual(['en:soybeans']);
  });

  it('finds milk from derivative ingredient names', () => {
    for (const text of ['whey protein', 'sodium caseinate', 'lactose', 'butter', 'ghee']) {
      expect(scanIngredientText(text).allergenTags).toContain('en:milk');
    }
  });

  it('does not treat plant milks, cocoa butter, or bean curd as dairy', () => {
    for (const text of ['coconut milk', 'almond milk', 'cocoa butter', 'bean curd']) {
      expect(scanIngredientText(text).allergenTags).not.toContain('en:milk');
    }
  });

  it('excludes "peanut butter" from milk but still counts it as peanuts', () => {
    const result = scanIngredientText('Peanut butter, honey.');
    expect(result.allergenTags).toContain('en:peanuts');
    expect(result.allergenTags).not.toContain('en:milk');
  });

  it('ignores "-free" claims ("wheat-free", "nut free")', () => {
    expect(scanIngredientText('Wheat-free, nut free oat-free snack of rice.')).toEqual({
      allergenTags: [],
      traceTags: [],
    });
  });

  it('flags regular oats as a gluten trace (Caution), but not gluten-free oats', () => {
    expect(scanIngredientText('Rolled oats, honey.')).toEqual({
      allergenTags: [],
      traceTags: ['en:gluten'],
    });
    expect(scanIngredientText('Gluten-free oats, honey.')).toEqual({
      allergenTags: [],
      traceTags: [],
    });
  });

  it('matches whole words only', () => {
    // coconut is not "nut", eggplant is not "egg", nutritional is not "nut".
    const result = scanIngredientText('Coconut, eggplant, nutritional yeast.');
    expect(result.allergenTags).toEqual([]);
  });

  it('is case-insensitive and handles curly apostrophes', () => {
    expect(scanIngredientText('BREWER’S YEAST').allergenTags).toContain('en:gluten');
  });

  it('returns nothing for empty or missing text', () => {
    expect(scanIngredientText(null)).toEqual({ allergenTags: [], traceTags: [] });
    expect(scanIngredientText('   ')).toEqual({ allergenTags: [], traceTags: [] });
  });
});
