/**
 * The size runs this shop actually buys in.
 *
 * Footwear is not ordered a size at a time — it arrives as a run, a fixed spread of pairs
 * weighted towards the middle sizes because that is what sells. Typing eight rows by hand
 * for every new product, and getting the middle-size doubling right each time, is the most
 * error-prone part of adding stock.
 *
 * A size listed twice in a run means two pairs of it. So the quantity for each size is
 * simply how many times it appears — which is why these are written as the run itself
 * rather than as size/quantity pairs: the run is how the order arrives from the supplier,
 * and it is checkable against the box at a glance.
 */
export interface SizeRun {
  id: string;
  /** Shown on the button. */
  label: string;
  /** The run as the shop writes it, for the button's title and for verification. */
  notation: string;
  sizes: number[];
}

export const SIZE_RUNS: SizeRun[] = [
  {
    id: "A",
    label: "A · 8 pair men",
    notation: "40-41-41-42-42-43-43-44",
    sizes: [40, 41, 41, 42, 42, 43, 43, 44],
  },
  {
    id: "B",
    label: "B · 8 pair women",
    notation: "36-37-37-38-38-39-39-40",
    sizes: [36, 37, 37, 38, 38, 39, 39, 40],
  },
  {
    id: "C",
    label: "C · 12 pair women",
    // B, plus one more of each of 38, 39, 40 and a 41 — the deeper buy on the sizes that
    // move fastest.
    notation: "36-37-37-38-38-38-39-39-39-40-40-41",
    sizes: [36, 37, 37, 38, 38, 38, 39, 39, 39, 40, 40, 41],
  },
];

export interface RunSize {
  name: string;
  quantity: number;
}

/**
 * Collapses a run into one row per size, carrying how many pairs of it arrived.
 *
 * Ascending, because that is the order a shopper reads them in on the product page and the
 * order `ProductSize.position` is written from.
 */
export function expandSizeRun(run: SizeRun): RunSize[] {
  const counts = new Map<number, number>();
  for (const size of run.sizes) counts.set(size, (counts.get(size) ?? 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([size, quantity]) => ({ name: String(size), quantity }));
}
