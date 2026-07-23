"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "alexandris_recently_viewed";
const MAX_ITEMS = 8;

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Tracks viewed product ids in localStorage — this is inherently client/session state, not backend data. */
export function useRecentlyViewed(currentProductId?: string) {
  const [ids, setIds] = useState<string[]>([]);

  // localStorage isn't available during SSR, so hydrating (and recording the current
  // view) can only happen after mount — this effect's whole purpose is that sync.
  useEffect(() => {
    if (!currentProductId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIds(readStoredIds());
      return;
    }
    const existing = readStoredIds().filter((id) => id !== currentProductId);
    const next = [currentProductId, ...existing].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setIds(next);
  }, [currentProductId]);

  const clear = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setIds([]);
  }, []);

  return { ids, clear };
}
