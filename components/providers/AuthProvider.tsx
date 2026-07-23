"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCommerceProvider } from "@/lib/commerce";
import { CommerceError } from "@/lib/commerce/types";
import type { AuthCredentials, AuthSignUpInput, ChangePasswordInput, Customer } from "@/lib/commerce/types";
import { useToast } from "@/components/providers/ToastProvider";
import { useCart } from "@/components/providers/CartProvider";
import { useWishlist } from "@/components/providers/WishlistProvider";
import { clearStoredReferralCode, getStoredReferralCode } from "@/lib/referral";

interface AuthContextValue {
  customer: Customer | null;
  isLoading: boolean;
  signIn: (credentials: AuthCredentials) => Promise<boolean>;
  signUp: (input: AuthSignUpInput) => Promise<boolean>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  resetPassword: (token: string, password: string) => Promise<boolean>;
  changePassword: (input: ChangePasswordInput) => Promise<boolean>;
  refreshCustomer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof CommerceError ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const commerce = useMemo(() => getCommerceProvider(), []);
  const { toast } = useToast();
  const cart = useCart();
  const wishlist = useWishlist();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    commerce.auth.getSession().then((session) => {
      if (cancelled) return;
      setCustomer(session?.customer ?? null);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [commerce]);

  // Best-effort: a guest cart/wishlist failing to link shouldn't block a successful
  // sign-in/sign-up — the customer is still signed in either way, just possibly with a
  // fresh empty cart/wishlist instead of their guest one.
  const linkGuestState = useCallback(async () => {
    await Promise.allSettled([cart.linkToCustomer(), wishlist.linkToCustomer()]);
  }, [cart, wishlist]);

  const signIn = useCallback(
    async (credentials: AuthCredentials) => {
      try {
        const session = await commerce.auth.signIn(credentials);
        setCustomer(session.customer);
        await linkGuestState();
        commerce.analytics.track({ name: "sign_in" });
        return true;
      } catch (error) {
        toast({ title: "Couldn't sign in", description: errorMessage(error, "Please try again."), tone: "error" });
        return false;
      }
    },
    [commerce, toast, linkGuestState]
  );

  const signUp = useCallback(
    async (input: AuthSignUpInput) => {
      try {
        const referralCode = getStoredReferralCode();
        const session = await commerce.auth.signUp(referralCode ? { ...input, referralCode } : input);
        setCustomer(session.customer);
        await linkGuestState();
        commerce.analytics.track({ name: "sign_up" });
        if (referralCode) clearStoredReferralCode();
        return true;
      } catch (error) {
        toast({ title: "Couldn't create account", description: errorMessage(error, "Please try again."), tone: "error" });
        return false;
      }
    },
    [commerce, toast, linkGuestState]
  );

  const signOut = useCallback(async () => {
    await commerce.auth.signOut();
    setCustomer(null);
  }, [commerce]);

  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        await commerce.auth.requestPasswordReset(email);
        return true;
      } catch (error) {
        toast({ title: "Couldn't send that link", description: errorMessage(error, "Please try again."), tone: "error" });
        return false;
      }
    },
    [commerce, toast]
  );

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      try {
        const session = await commerce.auth.resetPassword(token, password);
        setCustomer(session.customer);
        await linkGuestState();
        return true;
      } catch (error) {
        toast({ title: "Couldn't reset password", description: errorMessage(error, "That link may have expired."), tone: "error" });
        return false;
      }
    },
    [commerce, toast, linkGuestState]
  );

  const changePassword = useCallback(
    async (input: ChangePasswordInput) => {
      if (!customer) return false;
      try {
        await commerce.auth.changePassword(customer.id, input);
        toast({ title: "Password updated", tone: "success" });
        return true;
      } catch (error) {
        toast({ title: "Couldn't update password", description: errorMessage(error, "Please try again."), tone: "error" });
        return false;
      }
    },
    [customer, commerce, toast]
  );

  const refreshCustomer = useCallback(async () => {
    if (!customer) return;
    const fresh = await commerce.customer.getCustomer(customer.id);
    setCustomer(fresh);
  }, [customer, commerce]);

  const value: AuthContextValue = {
    customer,
    isLoading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    resetPassword,
    changePassword,
    refreshCustomer,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
