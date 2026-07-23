export interface SizeGuideRow {
  size: string;
  chestCm: number;
  waistCm: number;
  hipsCm: number;
}

/** A single generic conversion table — a real catalog would key this per product/category. */
export const SIZE_GUIDE_ROWS: SizeGuideRow[] = [
  { size: "XS", chestCm: 82, waistCm: 64, hipsCm: 90 },
  { size: "S", chestCm: 86, waistCm: 68, hipsCm: 94 },
  { size: "M", chestCm: 90, waistCm: 72, hipsCm: 98 },
  { size: "L", chestCm: 96, waistCm: 78, hipsCm: 104 },
  { size: "XL", chestCm: 102, waistCm: 84, hipsCm: 110 },
];

export const NUMERIC_SIZE_NOTE =
  "Numeric sizes (waist/collar measurements, EU shoe sizes) follow standard European sizing — see the product description for fit notes.";
