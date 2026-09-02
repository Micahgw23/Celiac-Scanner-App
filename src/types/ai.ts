/**
 * Where a product's ingredient data came from. This matters for how much the
 * user should trust it: 'database' means the AI looked it up in Open Food Facts,
 * 'model-knowledge' means the AI answered from its own training and nothing
 * verified it — the UI must say so.
 */
export type ExtractionSource = 'database' | 'model-knowledge';

/**
 * One product the AI identified in its answer, as returned by the Worker.
 * Deliberately mirrors the OFF field names so `toOffProduct()` is a thin,
 * auditable mapping rather than a translation layer.
 *
 * Note this carries NO verdict — the verdict is computed on-device by
 * `evaluateProduct()`. See src/lib/aiExtraction.ts.
 */
export interface ExtractedProduct {
  productName: string | null;
  brand: string | null;
  allergensTags: string[];
  tracesTags: string[];
  ingredientsText: string | null;
  source: ExtractionSource;
  /** Barcode, when the lookup tool found one. */
  barcode?: string | null;
}

/** Response body of the Worker's POST /ask. */
export interface AskResponse {
  answer: string;
  products: ExtractedProduct[];
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Only set on assistant turns that identified products. */
  products?: ExtractedProduct[];
}
