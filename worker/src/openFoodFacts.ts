/**
 * The `lookup_product` tool the model calls to ground its answers in real data
 * instead of recall. Mirrors the app's src/lib/openFoodFacts.ts field list so
 * both paths produce the same shape.
 */

const FIELDS = [
  'code',
  'product_name',
  'brands',
  'allergens_tags',
  'traces_tags',
  'ingredients_text',
].join(',');

export interface LookupResult {
  found: boolean;
  barcode?: string;
  productName?: string | null;
  brand?: string | null;
  allergensTags?: string[];
  tracesTags?: string[];
  ingredientsText?: string | null;
}

interface OffSearchResponse {
  products?: {
    code?: string;
    product_name?: string | null;
    brands?: string | null;
    allergens_tags?: string[] | null;
    traces_tags?: string[] | null;
    ingredients_text?: string | null;
  }[];
}

/**
 * Searches Open Food Facts by name/brand. Returns the best match, or
 * `{ found: false }` so the model can say it couldn't verify rather than
 * inventing an answer.
 */
export async function lookupProduct(query: string): Promise<LookupResult> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=3&fields=${FIELDS}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FoodScannerApp/1.0 (dietary safety assistant)' },
    });
    if (!res.ok) return { found: false };

    const body = (await res.json()) as OffSearchResponse;
    // Prefer the first result that actually carries allergen or ingredient
    // data — a bare name match tells the user nothing about safety.
    const product =
      body.products?.find(
        (p) => (p.allergens_tags?.length ?? 0) > 0 || (p.ingredients_text ?? '').length > 0,
      ) ?? body.products?.[0];

    if (!product) return { found: false };

    return {
      found: true,
      barcode: product.code,
      productName: product.product_name ?? null,
      brand: product.brands ?? null,
      allergensTags: product.allergens_tags ?? [],
      tracesTags: product.traces_tags ?? [],
      ingredientsText: product.ingredients_text ?? null,
    };
  } catch {
    return { found: false };
  }
}
