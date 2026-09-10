import sharp from "sharp";

/**
 * Putting a product photograph on the shop's baseline.
 *
 * Shared deliberately between `scripts/align-product-images.ts` (the bulk pass over the
 * existing catalogue) and the admin's "Align images" action. If the two ever diverge, a
 * photograph uploaded tomorrow stops matching the 300 aligned today, and nobody notices until
 * the grid looks wrong again — so the measuring, the targets and the transform all live here
 * and neither caller owns a copy.
 *
 * No `server-only` marker: the scripts run this under plain `tsx`, outside the app.
 */

/** The grey this shop's own product photography is matted on. */
export const BACKDROP = { r: 241, g: 241, b: 241 } as const;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The photograph's own backdrop, read from its corners rather than assumed.
 *
 * The shop's images are matted on #F1F1F1, but supplier photography is not: Verde's is
 * #E8E8E8, nine levels darker. Nine levels is invisible on its own and glaring as a seam once
 * you pad one grey out with another, and it also sits right at the edge of the ink threshold
 * below — measure a #E8E8E8 photograph against a hardcoded #F1F1F1 and every background pixel
 * lands 9 away from it, one short of counting as subject. That works by luck, and stops
 * working for the first supplier whose grey is a little lighter.
 *
 * The median of the four corners, so a stray watermark or a shadow reaching one corner cannot
 * carry the answer on its own.
 */
export function detectBackdrop(raw: Buffer, width: number, height: number, channels: number): Rgb {
  const patch = Math.max(4, Math.round(Math.min(width, height) * 0.02));
  const corners: Rgb[] = [];
  for (const [ox, oy] of [
    [0, 0],
    [width - patch, 0],
    [0, height - patch],
    [width - patch, height - patch],
  ]) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = oy; y < oy + patch; y++) {
      for (let x = ox; x < ox + patch; x++) {
        const i = (y * width + x) * channels;
        r += raw[i];
        g += raw[i + 1];
        b += raw[i + 2];
        n++;
      }
    }
    corners.push({ r: r / n, g: g / n, b: b / n });
  }
  const median = (pick: (c: Rgb) => number) => {
    const values = corners.map(pick).sort((a, b) => a - b);
    return Math.round((values[1] + values[2]) / 2);
  };
  return { r: median((c) => c.r), g: median((c) => c.g), b: median((c) => c.b) };
}

/** Distance from the backdrop at which a pixel counts as subject rather than field. */
const INK = 10;

export interface Shape {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Where the product actually rests — the sole line, not the bottom of its reflection. */
  sole: number;
  reflection: boolean;
  /** Mirror correlation at the best candidate sole row, for diagnostics. */
  score: number;
  /** How much dimmer the band below the sole is than the band above it. */
  fade: number;
  /** Subject runs into a frame edge, so it is a crop and there is no margin to move it into. */
  touchesEdge: boolean;
  /** The photograph's own matte colour, read from its corners — not assumed to be the shop's. */
  backdrop: Rgb;
  /** Shot side-on, resting on its sole — the only view where a shared baseline means anything. */
  sideProfile: boolean;
  /** How much of the subject's width its lowest rows occupy. Flat sole high, curved toe low. */
  flatness: number;
}

export interface AlignTarget {
  /** Fraction of the frame height left empty beneath the product. */
  bottomGap: number;
  label: string;
}

/**
 * Boots are tall, so they need almost the whole frame; everything else is short and sits on a
 * higher baseline or it looks like it is falling out of the picture. Two numbers rather than
 * one because a knee-high boot and a slide genuinely do not belong at the same height.
 */
export function targetFor(
  categorySlug: string,
  shape?: Pick<Shape, "top" | "sole" | "height">
): AlignTarget | null {
  if (categorySlug.endsWith("boots")) {
    /**
     * Which kind of boot, decided from the photograph rather than from the category.
     *
     * `gynaikeia-boots` holds both knee-high Μπότες and ankle Μποτάκια, and they do not belong
     * at the same height — a 10% gap suits a boot that fills the frame and leaves an ankle boot
     * floating. Splitting the category would have meant moving twenty live products and
     * changing their URLs to fix an alignment number, which is a great deal of storefront
     * churn for a small cause.
     *
     * Measured instead. Across the catalogue every product the merchant named Μπότα occupies
     * 0.81–0.85 of the frame and every Μποτάκι or Αρβυλάκι occupies 0.27–0.58 — an empty gap
     * between them wide enough that 0.7 is not a judgement call. The measurement and the
     * merchant's own vocabulary agree on every single row, which is the strongest evidence
     * available that it is measuring the thing the name means.
     */
    const filled = shape ? (shape.sole - shape.top) / shape.height : 1;
    return filled >= 0.7
      ? { bottomGap: 0.10, label: "tall boot" }
      : { bottomGap: 0.25, label: "ankle boot" };
  }
  const footwear = ["sandals", "heels", "oxfords"];
  if (footwear.includes(categorySlug) || categorySlug.endsWith("sneakers") || categorySlug.endsWith("loafers")) {
    return { bottomGap: 0.30, label: "shoe" };
  }
  return null;
}

/**
 * Measures where the subject sits, and whether a mirrored copy hangs beneath it.
 *
 * The reflection test scores each candidate sole row by how well the band above it matches the
 * band below it flipped, and requires the lower band to be dimmer — a real reflection fades,
 * while a shoe photographed from directly above is mirror-symmetric about its own waist at
 * full brightness. That distinction is the entire difficulty: without it, every top-down
 * loafer reads as reflected.
 *
 * Tuned for recall. See the note in `scripts/align-product-images.ts` for why the two possible
 * mistakes are not equally expensive.
 */
export async function analyseShape(input: Buffer): Promise<Shape> {
  // Flattened against the shop's own grey, which only has an effect on an image with alpha —
  // and a transparent cut-out has no backdrop of its own, so the shop's is the right answer
  // for it. Anything opaque keeps its own corners, which is what gets measured next.
  const image = sharp(input).flatten({ background: BACKDROP });
  const meta = await image.metadata();
  const width = meta.width!;
  const height = meta.height!;
  const raw = await image.raw().toBuffer();
  const backdrop = detectBackdrop(raw, width, height, 3);

  const distance = new Float32Array(width * height);
  const rowHits = new Int32Array(height);
  const colHits = new Int32Array(width);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const d = Math.max(
        Math.abs(raw[i] - backdrop.r),
        Math.abs(raw[i + 1] - backdrop.g),
        Math.abs(raw[i + 2] - backdrop.b)
      );
      distance[y * width + x] = d;
      if (d > INK) {
        rowHits[y]++;
        colHits[x]++;
      }
    }
  }

  const span = (counts: Int32Array, n: number): [number, number] => {
    let start = -1;
    let end = -1;
    for (let i = 0; i < n; i++) {
      if (counts[i] > 2) {
        if (start < 0) start = i;
        end = i;
      }
    }
    return [start, end];
  };
  const [top, bottom] = span(rowHits, height);
  const [left, right] = span(colHits, width);

  let best = { y: bottom, score: 0, fade: 1 };
  if (top >= 0 && bottom > top) {
    const reach = Math.min(90, Math.floor((bottom - top) / 3));
    // Relative, not absolute. A chunky sneaker paints thousands of pixels per row and a
    // strappy sandal paints a few dozen; fixed floors silently rejected every candidate row on
    // the sparse subjects, so those came back "no mirror found" and were the ones this pass
    // then moved wrongly. Scale the floors to how much ink the subject actually carries.
    let subjectHits = 0;
    for (let y = top; y <= bottom; y++) subjectHits += rowHits[y];
    const meanRow = subjectHits / Math.max(1, bottom - top + 1);
    const minAboveHits = Math.max(40, reach * meanRow * 0.15);
    const minBelowHits = Math.max(15, reach * meanRow * 0.04);
    for (let candidate = Math.max(top + reach, top + 30); candidate <= bottom - 12; candidate++) {
      let dot = 0;
      let aboveEnergy = 0;
      let belowEnergy = 0;
      let aboveHits = 0;
      let belowHits = 0;
      for (let k = 1; k <= reach; k++) {
        const above = candidate - k;
        const below = candidate + k;
        if (above < top || below > bottom) break;
        for (let x = left; x <= right; x++) {
          const a = distance[above * width + x];
          const b = distance[below * width + x];
          dot += a * b;
          aboveEnergy += a * a;
          belowEnergy += b * b;
          if (a > INK) aboveHits++;
          if (b > INK) belowHits++;
        }
      }
      if (aboveHits < minAboveHits || belowHits < minBelowHits) continue;
      if (aboveEnergy <= 0 || belowEnergy <= 0) continue;
      const fade = Math.sqrt(belowEnergy / aboveEnergy);
      const cos = dot / Math.sqrt(aboveEnergy * belowEnergy);
      if (cos < 0.72) continue;
      // Both signals in one number, because ranking on either alone picks the wrong row. A
      // shoe photographed from above correlates with itself almost perfectly (cos ~0.98) at
      // full brightness (fade ~0.9); a real mirror correlates a little less but is markedly
      // dimmer. Maximising cos alone hands the verdict to the self-symmetric row every time.
      const score = cos * (1 - fade);
      if (score > best.score) best = { y: candidate, score, fade };
    }
  }

  const reflection = best.score >= 0.3 && best.y < bottom - 20;
  const touchesEdge = top <= 1 || bottom >= height - 2 || left <= 1 || right >= width - 2;

  /**
   * Only side-on photographs get aligned, because only they have a sole line to align.
   *
   * A shoe shot in profile rests on a long flat edge, so its lowest rows are nearly as wide as
   * the shoe itself. The same shoe shot from above meets its lowest row at the curve of the
   * toe — a few pixels wide — and there is no baseline in the picture to speak of. Photograph
   * the pair at an angle and you get something in between, which is also not alignable, so the
   * threshold sits high enough to exclude it.
   */
  const rowWidth = (y: number) => {
    let first = -1;
    let last = -1;
    for (let x = left; x <= right; x++) {
      if (distance[y * width + x] > INK) {
        if (first < 0) first = x;
        last = x;
      }
    }
    return first < 0 ? 0 : last - first + 1;
  };
  const widths: number[] = [];
  let widest = 1;
  for (let y = top; y <= bottom; y++) {
    const w = rowWidth(y);
    widths[y] = w;
    if (w > widest) widest = w;
  }

  /**
   * The sole is the widest row, and that is true whether or not the photograph carries a
   * reflection.
   *
   * A shoe in profile is longest where it meets the floor, and a mirrored copy below narrows
   * away from that same line — so the contact line is the widest row in both cases. Deriving
   * the baseline this way instead of from the reflection classifier is what makes the pass
   * safe: a missed reflection no longer aligns the mirror's bottom edge to the target and
   * floats the shoe. The classifier still runs, but only to decide what to skip, and being
   * wrong about that now costs nothing worse than an image left alone.
   *
   * Taken as the topmost row reaching the maximum width, and deliberately not the lowest row
   * near it: a reflection is widest immediately below the contact line too, so any downward
   * tolerance walks straight into the mirror and lands the baseline under the shoe. Anchoring
   * on the same feature in every photograph is what makes them line up — whether that feature
   * sits at the very top of the sole band or a few pixels into it does not matter, so long as
   * it is the same few pixels every time.
   */
  let sole = bottom;
  for (let y = top; y <= bottom; y++) {
    if ((widths[y] ?? 0) >= widest * 0.98) { sole = y; break; }
  }

  let soleWidth = 0;
  const band = Math.max(3, Math.round(height * 0.015));
  for (let y = Math.max(top, sole - band); y <= sole; y++) soleWidth = Math.max(soleWidth, widths[y] ?? 0);
  const flatness = soleWidth / widest;
  /**
   * Where the widest row sits within the subject, which is what separates a side-on shot from
   * an overhead one.
   *
   * Photograph anything in profile and it is widest where it touches the floor, so the widest
   * row is the last one. Photograph a shoe from above and it is widest across its middle, with
   * the toe and heel curving away from it in both directions. This replaced an earlier test on
   * the subject's width-to-height ratio, which worked for shoes and quietly excluded every
   * knee-high boot in the shop — a boot in profile is taller than it is wide, and was being
   * read as "not side-on" for it.
   */
  const soleRatio = (sole - top) / Math.max(1, bottom - top);
  /**
   * Either signal on its own is enough, and it takes both to be sure of a rejection.
   *
   * A sole laying 80% of the shoe's width flat on the floor is a profile shot and nothing
   * else — no overhead photograph in this catalogue comes close, the flattest managing 0.57.
   * Below that the picture is ambiguous (a chunky trainer's sole curves up at the toe and heel,
   * so a dead-on profile can lay only half its width down) and the position of the widest row
   * decides it instead.
   *
   * Needing both would have excluded the men's ankle boots, whose reflections are faint enough
   * to slip under the mirror threshold but still pull `bottom` down far enough to spoil
   * `soleRatio` — 0.98 flat and 0.78 by ratio, which is a profile shot by any reading.
   */
  const sideProfile =
    // Whatever the flatness says, a widest row in the upper half of the subject is not a sole.
    // One boot detail shot measured 0.98 flat with its widest row at 0.06 — the top of the
    // frame — and would have been dragged the length of the picture to put it on the floor.
    soleRatio >= 0.4 && (flatness >= 0.8 || (flatness >= 0.5 && soleRatio >= 0.85));

  return {
    width, height, top, bottom, left, right,
    sole, backdrop,
    reflection, score: best.score, fade: best.fade, touchesEdge, sideProfile, flatness,
  };
}

export interface AlignResult {
  buffer: Buffer;
  fromGap: number;
  toGap: number;
  /** Set when nothing was produced, saying why. */
  reason?: "already-aligned" | "no-room";
}

/**
 * Moves the subject onto the target baseline and centres it horizontally.
 *
 * A translation, not a rescale. Every photograph here is already 1000x1333 on the same flat
 * grey, so lifting the subject and setting it down elsewhere on a fresh field of that grey is
 * lossless for the product itself — resampling it to force a common width would change how
 * large each shoe appears, which is information the photographer chose and not ours to flatten.
 */
export async function alignToBaseline(input: Buffer, shape: Shape, target: AlignTarget): Promise<AlignResult> {
  const { width, height, top, bottom, left, right, sole } = shape;
  // Measured from the sole, moved as the whole picture. When a reflection is present it rides
  // along underneath rather than being what gets placed on the baseline.
  const fromGap = ((height - 1 - sole) / height) * 100;
  const toGap = target.bottomGap * 100;

  const desiredSole = Math.round(height - 1 - target.bottomGap * height);
  const dy = desiredSole - sole;
  const subjectWidth = right - left + 1;
  const desiredLeft = Math.round((width - subjectWidth) / 2);
  const dx = desiredLeft - left;

  /**
   * Close enough is aligned.
   *
   * The threshold was 4px, which is about 0.3% of the frame and below what anyone can see in a
   * grid — but far above the noise floor of the measurement itself, so re-measuring the same
   * photograph after any change to how the backdrop is read would nudge a dozen images across
   * it and re-upload every one for a correction nobody could point at. 1% of the frame is still
   * invisible and sits well clear of that.
   */
  const tolerance = Math.max(4, Math.round(height * 0.01));
  if (Math.abs(dy) < tolerance && Math.abs(dx) < tolerance) {
    return { buffer: input, fromGap, toGap, reason: "already-aligned" };
  }
  if (top + dy < 0 || bottom + dy > height - 1 || left + dx < 0 || right + dx > width - 1) {
    return { buffer: input, fromGap, toGap, reason: "no-room" };
  }

  // Padded with the photograph's own grey, not the shop's. Nine levels between #E8E8E8 and
  // #F1F1F1 is invisible until they meet, at which point it is a hard edge across the frame.
  const subject = await sharp(input)
    .flatten({ background: shape.backdrop })
    .extract({ left, top, width: subjectWidth, height: bottom - top + 1 })
    .toBuffer();

  const buffer = await sharp({
    create: { width, height, channels: 3, background: shape.backdrop },
  })
    .composite([{ input: subject, left: left + dx, top: top + dy }])
    .webp({ quality: 85 })
    .toBuffer();

  return { buffer, fromGap, toGap };
}
