import type { DietId } from './diet';
import type { VerdictStatus } from './verdict';

/** A past scan, as stored under users/{uid}/scanHistory/{scanId} in Firestore. */
export interface ScanRecord {
  barcode: string;
  productName: string | null;
  brand: string | null;
  imageUrl: string | null;
  verdict: VerdictStatus;
  triggeredTags: string[];
  triggeredDiets: DietId[];
  /** Firestore Timestamp on read; set with serverTimestamp() on write. */
  scannedAt: unknown;
}
