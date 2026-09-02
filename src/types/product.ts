/**
 * Shape of the fields we request from the Open Food Facts v2 product API.
 * Keep this in sync with the `fields=` query built in `src/lib/openFoodFacts.ts`.
 * See https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
export interface OffProduct {
  code?: string;
  product_name?: string | null;
  brands?: string | null;
  image_front_small_url?: string | null;
  /** e.g. ["en:gluten", "en:milk"] — allergens the product actually contains. */
  allergens_tags?: string[] | null;
  /** e.g. ["en:gluten"] — "may contain traces of" warnings. */
  traces_tags?: string[] | null;
  /** e.g. ["en:certified-gluten-free"] — informational claims/certifications only. */
  labels_tags?: string[] | null;
  /** e.g. ["en:vegan", "en:non-vegetarian"] — OFF's own ingredient analysis. */
  ingredients_analysis_tags?: string[] | null;
  /** Raw ingredient text, used only to tell "no data" apart from "no matches". */
  ingredients_text?: string | null;
}

export interface OffApiResponse {
  code: string;
  /** 1 = product found, 0 = not found. Not an HTTP 404 — always check this field. */
  status: 0 | 1;
  status_verbose?: string;
  product?: OffProduct;
}
