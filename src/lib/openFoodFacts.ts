import type { OffApiResponse } from '@/types/product';

const FIELDS = [
  'code',
  'status',
  'product_name',
  'brands',
  'image_front_small_url',
  'allergens_tags',
  'traces_tags',
  'labels_tags',
  'ingredients_analysis_tags',
  'ingredients_text',
].join(',');

export class OffRequestError extends Error {}

/**
 * Looks up a product by barcode on Open Food Facts.
 *
 * Important: a "not found" product is NOT an HTTP error — the API returns
 * 200 with `{ status: 0 }` and no `product` field. Callers must check
 * `response.status` themselves rather than relying on a thrown error to mean
 * "not found". A thrown OffRequestError means the *request itself* failed
 * (network/server error) and should be shown differently from "not found" —
 * e.g. grocery-store cell signal is unreliable and the two look very
 * different to a user trying to decide whether to eat something.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OffApiResponse> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new OffRequestError('Could not reach Open Food Facts. Check your connection and try again.');
  }

  if (!res.ok) {
    throw new OffRequestError(`Open Food Facts request failed (${res.status}).`);
  }

  return (await res.json()) as OffApiResponse;
}
