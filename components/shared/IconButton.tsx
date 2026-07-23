import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("inline-flex items-center justify-center transition-opacity hover:opacity-60", className)}
      {...props}
    >
      {children}
    </button>
  );
}
