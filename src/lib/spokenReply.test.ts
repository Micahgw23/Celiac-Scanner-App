import { buildSpokenReply } from '@/lib/spokenReply';
import type { ExtractedProduct } from '@/types/ai';

function product(overrides: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    productName: 'Cheerios',
    brand: 'General Mills',
    allergensTags: [],
    tracesTags: [],
    ingredientsText: 'Whole grain oats, sugar.',
    source: 'database',
    ...overrides,
  };
}

describe('buildSpokenReply', () => {
  it('leads with the deterministic verdict, before the model prose', () => {
    const spoken = buildSpokenReply(
      'It contains wheat starch.',
      [product({ allergensTags: ['en:gluten'] })],
      ['celiac'],
    );
    expect(spoken.startsWith('Cheerios: Not safe.')).toBe(true);
    expect(spoken).toContain('It contains wheat starch.');
  });

  it('says the verdict the badge shows, even when the prose disagrees', () => {
    // The model claiming "totally fine" must not change what is spoken.
    const spoken = buildSpokenReply(
      'This is totally fine for you!',
      [product({ allergensTags: ['en:gluten'] })],
      ['celiac'],
    );
    expect(spoken).toContain('Not safe');
  });

  it('speaks Caution for a traces match', () => {
    const spoken = buildSpokenReply('', [product({ tracesTags: ['en:gluten'] })], ['celiac']);
    expect(spoken).toContain('Cheerios: Caution.');
  });

  it('strips markdown and emoji so they are not read aloud', () => {
    expect(buildSpokenReply('**Bold** and `code` ⚠️', [], [])).toBe('Bold and code');
  });

  it('speaks only the first sentence of a long answer', () => {
    const spoken = buildSpokenReply(
      'It contains wheat starch. That makes it unsuitable for celiacs. Recipes vary by country, so always check the label on the package you are holding.',
      [],
      ['celiac'],
    );
    expect(spoken).toBe('It contains wheat starch.');
    expect(spoken).not.toContain('Recipes vary');
  });

  it('keeps a one-sentence answer intact, with or without a final period', () => {
    expect(buildSpokenReply('No gluten ingredients are listed', [], [])).toBe(
      'No gluten ingredients are listed',
    );
    expect(buildSpokenReply('Contains barley malt!', [], [])).toBe('Contains barley malt!');
  });

  it('puts the verdict before the trimmed sentence', () => {
    const spoken = buildSpokenReply(
      'This contains wheat. Many other things are also true.',
      [product({ allergensTags: ['en:gluten'] })],
      ['celiac'],
    );
    expect(spoken).toBe('Cheerios: Not safe. This contains wheat.');
  });

  it('handles an answer with no products', () => {
    expect(buildSpokenReply('Malt usually contains gluten.', [], ['celiac'])).toBe(
      'Malt usually contains gluten.',
    );
    expect(buildSpokenReply('Hi', undefined, [])).toBe('Hi');
  });

  it('falls back to a generic name when the product is unnamed', () => {
    const spoken = buildSpokenReply('', [product({ productName: null, allergensTags: ['en:gluten'] })], [
      'celiac',
    ]);
    expect(spoken).toContain('That product: Not safe.');
  });
});
