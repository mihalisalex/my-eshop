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
        <span
          key={color.name}
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
