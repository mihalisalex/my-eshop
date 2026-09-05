import { cn } from "@/lib/utils";
import type { ColorVariant } from "@/types";

interface ColorSwatchesProps {
  colors: ColorVariant[];
  size?: "sm" | "md";
  className?: string;
}

export function ColorSwatches({ colors, size = "sm", className }: ColorSwatchesProps) {
  if (colors.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {colors.map((color) => (
        /**
         * `role="img"` is required, not decoration.
         *
         * ARIA prohibits `aria-label` on a generic element, so a bare <span> carrying one is
         * ignored outright by assistive technology — the swatch announced as nothing, and the
         * only thing conveying colour on a product card was invisible to a screen reader.
         * Flagged as a serious `aria-prohibited-attr` violation by the axe scan.
         *
         * A role that accepts a name fixes it, and `img` is the honest description: this is a
         * block of colour standing in for the word.
         */
        <span
          key={color.name}
          role="img"
          title={color.name}
          aria-label={color.name}
          className={cn(
            "inline-block rounded-full border border-border",
            size === "sm" ? "size-3" : "size-4"
          )}
          style={{ backgroundColor: color.hex }}
        />
      ))}
    </div>
  );
}
