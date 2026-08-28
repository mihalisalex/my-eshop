"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

/**
 * Catches errors thrown by the root layout itself (outside error.tsx's reach).
 * Must render its own <html>/<body> since it replaces the entire root.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error("Unhandled root layout error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="el">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1.5rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Κάτι πήγε στραβά</h1>
          <p style={{ color: "#555", maxWidth: "24rem" }}>
            Παρουσιάστηκε απροσδόκητο σφάλμα κατά τη φόρτωση της σελίδας. Δοκιμάστε ξανά.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ height: "3rem", padding: "0 2rem", background: "#111", color: "#fff", fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", border: "none", cursor: "pointer" }}
          >
            Δοκιμάστε ξανά
          </button>
        </div>
      </body>
    </html>
  );
}
