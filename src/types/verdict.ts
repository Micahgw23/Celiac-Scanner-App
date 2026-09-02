import type { DietId } from './diet';

export type VerdictStatus = 'safe' | 'unsafe' | 'caution' | 'unknown';

export interface TriggeredMatch {
  /** Normalized OFF tag that caused this match, e.g. "en:gluten". */
  tag: string;
  /** Which of the user's diets this tag violates. */
  diet: DietId;
}

export interface VerdictResult {
  status: VerdictStatus;
  /** Tags (deduped) that triggered the verdict — empty for safe/unknown. */
  triggeredTags: string[];
  /** Diets (deduped) implicated in the verdict — empty for safe/unknown. */
  triggeredDiets: DietId[];
  /** Human-readable explanation shown on the result screen. */
  reason: string;
}
