/**
 * Generic client-device-storage helpers — used regardless of which commerce
 * provider is active (e.g. WishlistProvider's anonymous id, CartProvider's
 * persisted cart id). Relocated from providers/mock/storage.ts, which became
 * misleading once Cart/Checkout/Customer/Wishlist/Auth stopped being mock
 * (Real Backend Phase 2) — this is no longer mock-adapter-specific.
 */

export function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
