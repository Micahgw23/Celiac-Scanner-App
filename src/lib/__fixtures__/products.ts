import type { OffProduct } from '@/types/product';

/** Modeled on the real Cheerios payload (barcode 0016000275287). */
export const cheerios: OffProduct = {
  code: '0016000275287',
  product_name: 'Cheerios',
  brands: 'General Mills',
  image_front_small_url: 'https://example.com/cheerios.jpg',
  allergens_tags: ['en:gluten', 'en:Corn'], // real data has inconsistent casing
  traces_tags: [],
  labels_tags: [],
  ingredients_analysis_tags: [],
  ingredients_text: 'Whole Grain Oats, Corn Starch, Sugar, ...',
};

/** Modeled on the real Fage Total 0% yogurt payload (barcode 0689544083016). */
export const fageYogurt: OffProduct = {
  code: '0689544083016',
  product_name: 'Total 0% Milkfat Yogurt',
  brands: 'Fage',
  image_front_small_url: 'https://example.com/fage.jpg',
  allergens_tags: ['en:milk'],
  traces_tags: [],
  labels_tags: ['en:certified-gluten-free'],
  ingredients_analysis_tags: [],
  ingredients_text: 'Cultured Pasteurized Nonfat Milk.',
};

/**
 * Modeled on the real Go Raw Organic Sprouted Pumpkin Seeds payload
 * (barcode 0810032300463) — the conflicting-signal case: labeled
 * certified-gluten-free AND carries a gluten traces warning at the same time.
 */
export const goRawPumpkinSeeds: OffProduct = {
  code: '0810032300463',
  product_name: 'Organic Sprouted Pumpkin Seeds',
  brands: 'Go Raw',
  image_front_small_url: 'https://example.com/goraw.jpg',
  allergens_tags: [],
  traces_tags: ['en:gluten'],
  labels_tags: ['en:certified-gluten-free'],
  ingredients_analysis_tags: [],
  ingredients_text: 'Organic Sprouted Pumpkin Seeds, Sea Salt.',
};

export const plainSafeProduct: OffProduct = {
  code: '0000000000001',
  product_name: 'Plain Rice Cakes',
  brands: 'Generic',
  image_front_small_url: null,
  allergens_tags: [],
  traces_tags: [],
  labels_tags: [],
  ingredients_analysis_tags: [],
  ingredients_text: 'Whole Grain Brown Rice.',
};

/** Found in the DB, but with no usable ingredient/allergen data at all. */
export const emptyDataProduct: OffProduct = {
  code: '0000000000002',
  product_name: 'Mystery Product',
  brands: null,
  image_front_small_url: null,
  allergens_tags: [],
  traces_tags: [],
  labels_tags: [],
  ingredients_analysis_tags: [],
  ingredients_text: null,
};

export const nonVeganProduct: OffProduct = {
  code: '0000000000003',
  product_name: 'Beef Jerky',
  brands: 'Generic',
  image_front_small_url: null,
  allergens_tags: [],
  traces_tags: [],
  labels_tags: [],
  ingredients_analysis_tags: ['en:non-vegetarian', 'en:non-vegan'],
  ingredients_text: 'Beef, Salt, Spices.',
};
