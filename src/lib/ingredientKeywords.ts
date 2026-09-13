/**
 * Deterministic ingredient-text scanner.
 *
 * The AI reads a label and emits allergen tags, but nothing guarantees it
 * emitted *every* tag. This scans the ingredient text itself and derives tags
 * from plain keywords, so "wheat flour" is caught even if the model forgot to
 * say "en:gluten". Its output is only ever unioned into the model's tags (see
 * toOffProduct in aiExtraction.ts), so it can make a verdict stricter, never
 * looser.
 *
 * Matching rules:
 *  - case-insensitive, whole-word: "wheat" does not match "buckwheat",
 *    "nut" does not match "coconut", "egg" does not match "eggplant";
 *  - "<term>-free" / "<term> free" never counts ("wheat-free", "nut free");
 *  - per-tag exclusion phrases for real false positives ("coconut milk" is not
 *    dairy, "gluten-free oats" are fine), applied only when scanning for that
 *    tag — "peanut butter" is excluded from milk but still counts as peanuts;
 *  - anything inside a "may contain…" / "made in a facility…" sentence counts
 *    as a trace (Caution) rather than a direct ingredient (Not Safe).
 */

type Severity = 'contains' | 'may-contain';

interface KeywordRule {
  tag: string;
  terms: string[];
  /**
   * Severity when a term appears as a direct ingredient. Defaults to
   * 'contains'. Oats use 'may-contain': oats themselves aren't gluten, but
   * non-certified oats are routinely cross-contaminated.
   */
  severity?: Severity;
  /** Phrases blanked out before scanning for this tag only. */
  exclude?: string[];
}

export const INGREDIENT_KEYWORDS: KeywordRule[] = [
  {
    tag: 'en:gluten',
    terms: [
      'wheat', 'barley', 'rye', 'malt', 'malted', 'spelt', 'triticale', 'semolina',
      'durum', 'farro', 'bulgur', 'couscous', 'seitan', "brewer's yeast", 'einkorn',
      'emmer', 'kamut', 'graham', 'gluten',
    ],
  },
  {
    tag: 'en:gluten',
    terms: ['oat', 'oats', 'oatmeal', 'oat flour'],
    severity: 'may-contain',
    exclude: ['gluten-free oats', 'gluten free oats', 'gluten-free oat', 'gluten free oat'],
  },
  {
    tag: 'en:milk',
    terms: [
      'milk', 'whey', 'casein', 'caseinate', 'butter', 'buttermilk', 'cream', 'cheese',
      'lactose', 'ghee', 'yogurt', 'yoghurt', 'curd', 'curds',
    ],
    exclude: [
      'coconut milk', 'almond milk', 'oat milk', 'soy milk', 'soya milk', 'rice milk',
      'cashew milk', 'hemp milk', 'coconut cream', 'cocoa butter', 'cacao butter',
      'peanut butter', 'nut butter', 'almond butter', 'cashew butter', 'shea butter',
      'apple butter', 'cream of tartar', 'bean curd',
    ],
  },
  { tag: 'en:eggs', terms: ['egg', 'eggs', 'albumen', 'albumin', 'mayonnaise', 'meringue'] },
  { tag: 'en:peanuts', terms: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'arachis'] },
  {
    tag: 'en:soybeans',
    terms: ['soy', 'soya', 'soybean', 'soybeans', 'edamame', 'tofu', 'miso', 'tempeh'],
  },
  { tag: 'en:sesame-seeds', terms: ['sesame', 'tahini'] },
  {
    tag: 'en:nuts',
    terms: [
      'almond', 'almonds', 'cashew', 'cashews', 'walnut', 'walnuts', 'pecan', 'pecans',
      'pistachio', 'pistachios', 'hazelnut', 'hazelnuts', 'filbert', 'macadamia',
      'brazil nut', 'brazil nuts', 'pine nut', 'pine nuts', 'praline', 'marzipan',
      'tree nut', 'tree nuts', 'nut', 'nuts',
    ],
  },
  {
    tag: 'en:fish',
    terms: [
      'fish', 'anchovy', 'anchovies', 'salmon', 'tuna', 'cod', 'sardine', 'sardines',
      'tilapia', 'mackerel', 'haddock', 'pollock', 'trout',
    ],
  },
  {
    tag: 'en:crustaceans',
    terms: ['shrimp', 'prawn', 'prawns', 'crab', 'lobster', 'crayfish', 'krill', 'crustacean', 'crustaceans'],
  },
  {
    tag: 'en:molluscs',
    terms: [
      'clam', 'clams', 'mussel', 'mussels', 'oyster', 'oysters', 'scallop', 'scallops',
      'squid', 'octopus', 'mollusc', 'molluscs', 'mollusk', 'mollusks',
    ],
  },
];

/** Phrases that open a "may contain" statement; the rest of that sentence is traces. */
const TRACE_OPENERS = [
  'may contain',
  'may also contain',
  'may contain traces of',
  'traces of',
  'made in a facility',
  'made on shared equipment',
  'made on equipment',
  'produced in a facility',
  'processed in a facility',
  'manufactured in a facility',
  'manufactured on shared equipment',
  'packaged in a facility',
  'made in a factory',
];

export interface IngredientScanResult {
  allergenTags: string[];
  traceTags: string[];
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Spaces in a term also match hyphens/newlines ("brazil-nut", "brazil\nnut"). */
function termPattern(term: string): RegExp {
  const body = escapeRegex(term).replace(/ /g, '[\\s-]+');
  return new RegExp(`\\b${body}\\b(?![\\s-]*free\\b)`, 'i');
}

const COMPILED = INGREDIENT_KEYWORDS.map((rule) => ({
  tag: rule.tag,
  severity: rule.severity ?? 'contains',
  patterns: rule.terms.map(termPattern),
  exclusions: (rule.exclude ?? []).map(
    (phrase) => new RegExp(`\\b${escapeRegex(phrase).replace(/ /g, '[\\s-]+')}\\b`, 'gi'),
  ),
}));

function normalize(text: string): string {
  return text.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
}

/**
 * Splits ingredient text into the part listing actual ingredients and the part
 * inside "may contain…" sentences. A trace sentence runs from its opener to the
 * next period, semicolon, or end of text.
 */
function splitTraceSentences(text: string): { direct: string; traces: string } {
  const opener = new RegExp(`\\b(?:${TRACE_OPENERS.map(escapeRegex).join('|')})\\b`, 'gi');
  let direct = '';
  let traces = '';
  let cursor = 0;
  for (const match of text.matchAll(opener)) {
    const start = match.index ?? 0;
    if (start < cursor) continue; // opener nested inside a sentence already taken
    const end = text.slice(start).search(/[.;]/);
    const stop = end === -1 ? text.length : start + end;
    direct += text.slice(cursor, start) + ' ';
    traces += text.slice(start, stop) + ' ';
    cursor = stop;
  }
  direct += text.slice(cursor);
  return { direct, traces };
}

export function scanIngredientText(text: string | null | undefined): IngredientScanResult {
  if (!text || !text.trim()) return { allergenTags: [], traceTags: [] };

  const { direct, traces } = splitTraceSentences(normalize(text));
  const allergenTags = new Set<string>();
  const traceTags = new Set<string>();

  for (const rule of COMPILED) {
    const clean = (region: string) =>
      rule.exclusions.reduce((acc, re) => acc.replace(re, ' '), region);
    const directText = clean(direct);
    const traceText = clean(traces);

    if (rule.patterns.some((re) => re.test(directText))) {
      (rule.severity === 'contains' ? allergenTags : traceTags).add(rule.tag);
    }
    if (rule.patterns.some((re) => re.test(traceText))) {
      traceTags.add(rule.tag);
    }
  }

  return { allergenTags: Array.from(allergenTags), traceTags: Array.from(traceTags) };
}
