import type { AuthCredentials, AuthenticationService, AuthSession, AuthSignUpInput, ChangePasswordInput } from "@/lib/commerce/types";
import { fetchJson } from "./http";

/** `AuthSession.token` is a placeholder ("httponly") — the real session lives in an httpOnly cookie the browser sends automatically; nothing in components/ reads `.token`. */
export function createRemoteAuthenticationService(): AuthenticationService {
  return {
    async signIn(credentials: AuthCredentials): Promise<AuthSession> {
      return fetchJson<AuthSession>("/api/auth/sign-in", { method: "POST", body: JSON.stringify(credentials) });
    },

    async signUp(input: AuthSignUpInput): Promise<AuthSession> {
      return fetchJson<AuthSession>("/api/auth/sign-up", { method: "POST", body: JSON.stringify(input) });
    },

    async signOut(): Promise<void> {
      await fetchJson<{ ok: true }>("/api/auth/sign-out", { method: "POST" });
    },

    async getSession(): Promise<AuthSession | null> {
      const data = await fetchJson<{ session: null } | AuthSession>("/api/auth/session");
      return "session" in data ? null : data;
    },

    async requestPasswordReset(email: string): Promise<void> {
      await fetchJson<{ ok: true }>("/api/auth/request-password-reset", { method: "POST", body: JSON.stringify({ email }) });
    },

    async resetPassword(token: string, password: string): Promise<AuthSession> {
      return fetchJson<AuthSession>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
    },

    async changePassword(_customerId: string, input: ChangePasswordInput): Promise<void> {
      await fetchJson<{ ok: true }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(input) });
    },
  };
}
