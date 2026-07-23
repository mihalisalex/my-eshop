"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "alexandris_recent_searches";
const MAX_ITEMS = 6;

function readStoredTerms(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Tracks recent search terms in localStorage — client/session state, not backend data. */
export function useRecentSearches() {
  const [terms, setTerms] = useState<string[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
    setTerms(readStoredTerms());
  }, []);

  const addTerm = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const next = [trimmed, ...readStoredTerms().filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setTerms(next);
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setTerms([]);
  }, []);

  return { terms, addTerm, clear };
}
