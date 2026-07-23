"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { logger } from "@/lib/logger";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Unhandled route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-luxe-white px-6 text-center">
      <Link href="/" className="font-heading text-lg tracking-[0.1em] uppercase">
        ALEXANDRIS
      </Link>
      <AlertTriangle className="size-10 text-luxe-gray-dark" strokeWidth={1} />
      <h1 className="font-heading text-2xl">Something went wrong</h1>
      <p className="max-w-sm text-sm text-luxe-gray-dark">
        An unexpected error occurred. You can try again, or head back to the homepage.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex h-12 items-center justify-center bg-luxe-black px-8 text-xs font-medium tracking-[0.08em] text-luxe-white uppercase"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="flex h-12 items-center justify-center border border-border px-8 text-xs font-medium tracking-[0.08em] uppercase"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
