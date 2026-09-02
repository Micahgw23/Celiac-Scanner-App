import { sanitizeTags, toOffProduct, verdictForExtractedProduct } from '@/lib/aiExtraction';
import type { ExtractedProduct } from '@/types/ai';

function extracted(overrides: Partial<ExtractedProduct> = {}): ExtractedProduct {
  return {
    productName: 'Test Product',
    brand: 'Test Brand',
    allergensTags: [],
    tracesTags: [],
    ingredientsText: 'Water, Salt.',
    source: 'database',
    ...overrides,
  };
}

describe('sanitizeTags', () => {
  it('keeps known Open Food Facts allergen tags', () => {
    expect(sanitizeTags(['en:gluten', 'en:milk'])).toEqual(['en:gluten', 'en:milk']);
  });

  it('normalizes casing and whitespace the way real OFF data varies', () => {
    expect(sanitizeTags([' EN:Gluten '])).toEqual(['en:gluten']);
  });

  it('discards tags the model invented that are not in the taxonomy', () => {
    expect(sanitizeTags(['en:definitely-safe', 'en:totally-fine'])).toEqual([]);
  });

  it('keeps the real tags while discarding invented ones in the same list', () => {
    expect(sanitizeTags(['en:gluten', 'en:definitely-safe'])).toEqual(['en:gluten']);
  });

  it('dedupes and tolerates null/undefined/non-strings', () => {
    expect(sanitizeTags(['en:milk', 'en:milk'])).toEqual(['en:milk']);
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags([42 as unknown as string])).toEqual([]);
  });
});

describe('toOffProduct', () => {
  it('maps the extraction onto the OffProduct shape used by the barcode path', () => {
    const product = toOffProduct(
      extracted({ allergensTags: ['en:gluten'], tracesTags: ['en:milk'], barcode: '123' }),
    );
    expect(product.code).toBe('123');
    expect(product.product_name).toBe('Test Product');
    expect(product.allergens_tags).toEqual(['en:gluten']);
    expect(product.traces_tags).toEqual(['en:milk']);
  });

  it('never carries labels_tags through, so a marketing claim cannot affect a verdict', () => {
    expect(toOffProduct(extracted()).labels_tags).toEqual([]);
  });
});

describe('verdictForExtractedProduct', () => {
  it('flags Unsafe from a database-sourced allergen match', () => {
    const result = verdictForExtractedProduct(
      extracted({ allergensTags: ['en:gluten'] }),
      ['celiac'],
    );
    expect(result.status).toBe('unsafe');
    expect(result.triggeredTags).toContain('en:gluten');
  });

  it('flags Caution from traces only', () => {
    const result = verdictForExtractedProduct(extracted({ tracesTags: ['en:gluten'] }), ['celiac']);
    expect(result.status).toBe('caution');
  });

  it('allows Safe when the data came from a real database lookup', () => {
    const result = verdictForExtractedProduct(extracted({ source: 'database' }), ['celiac']);
    expect(result.status).toBe('safe');
  });

  it('downgrades Safe to Unknown when the data is unverified model recall', () => {
    // Nothing checked that the model listed every allergen, so an unverified
    // "safe" must not be shown as safe.
    const result = verdictForExtractedProduct(extracted({ source: 'model-knowledge' }), ['celiac']);
    expect(result.status).toBe('unknown');
  });

  it('does NOT downgrade Unsafe from model recall — a warning still stands', () => {
    const result = verdictForExtractedProduct(
      extracted({ source: 'model-knowledge', allergensTags: ['en:gluten'] }),
      ['celiac'],
    );
    expect(result.status).toBe('unsafe');
  });

  it('does NOT downgrade Caution from model recall', () => {
    const result = verdictForExtractedProduct(
      extracted({ source: 'model-knowledge', tracesTags: ['en:gluten'] }),
      ['celiac'],
    );
    expect(result.status).toBe('caution');
  });

  it('regression: an invented "safe" tag cannot override a real gluten traces warning', () => {
    const result = verdictForExtractedProduct(
      extracted({
        allergensTags: ['en:definitely-safe', 'en:certified-gluten-free'],
        tracesTags: ['en:gluten'],
      }),
      ['celiac'],
    );
    expect(result.status).toBe('caution');
    expect(result.status).not.toBe('safe');
  });

  it('regression: a model omitting all data yields Unknown, never Safe', () => {
    const result = verdictForExtractedProduct(
      extracted({ ingredientsText: null, source: 'database' }),
      ['celiac'],
    );
    expect(result.status).toBe('unknown');
  });

  it('is profile-sensitive: milk is unsafe only once dairy-free is selected', () => {
    const milk = extracted({ allergensTags: ['en:milk'] });
    expect(verdictForExtractedProduct(milk, ['celiac']).status).toBe('safe');
    expect(verdictForExtractedProduct(milk, ['celiac', 'dairy-free']).status).toBe('unsafe');
  });
});
