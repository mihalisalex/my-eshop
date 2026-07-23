import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  siteName: string;
  className?: string;
}

export function Logo({ siteName, className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${siteName} — Home`}
      className={cn(
        "font-heading text-2xl font-semibold tracking-[0.15em] uppercase",
        className
      )}
    >
      {siteName}
    </Link>
  );
}
