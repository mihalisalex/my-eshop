export interface SizeGuideRow {
  eu: string;
  uk: string;
  usMen: string;
  usWomen: string;
  footLengthCm: number;
}

/** A single EU-anchored conversion table — a real catalog would key this per last/style. */
export const SIZE_GUIDE_ROWS: SizeGuideRow[] = [
  { eu: "36", uk: "3.5", usMen: "4", usWomen: "6", footLengthCm: 22.5 },
  { eu: "37", uk: "4.5", usMen: "5", usWomen: "7", footLengthCm: 23.5 },
  { eu: "38", uk: "5.5", usMen: "6", usWomen: "8", footLengthCm: 24 },
  { eu: "39", uk: "6", usMen: "7", usWomen: "8.5", footLengthCm: 24.5 },
  { eu: "40", uk: "6.5", usMen: "7.5", usWomen: "9", footLengthCm: 25 },
  { eu: "41", uk: "7.5", usMen: "8.5", usWomen: "10", footLengthCm: 26 },
  { eu: "42", uk: "8", usMen: "9", usWomen: "10.5", footLengthCm: 26.5 },
  { eu: "43", uk: "9", usMen: "10", usWomen: "11.5", footLengthCm: 27.5 },
  { eu: "44", uk: "9.5", usMen: "10.5", usWomen: "12", footLengthCm: 28 },
  { eu: "45", uk: "10.5", usMen: "11.5", usWomen: "13", footLengthCm: 29 },
];

export const NUMERIC_SIZE_NOTE =
  "Sizes are EU. If you're between sizes, size up — see the product description for any fit note specific to that last.";
