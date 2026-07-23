"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "@/app/admin/actions";

const initialState: LoginState = {};

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-luxe-gray-light px-4">
      <div className="w-full max-w-sm bg-luxe-white p-10 shadow-sm">
        <Link href="/" className="font-heading block text-center text-xl tracking-[0.15em] uppercase">
          ALEXANDRIS
        </Link>
        <p className="mt-1 text-center text-xs tracking-[0.1em] text-luxe-gray-dark uppercase">Admin</p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium tracking-[0.05em] uppercase">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium tracking-[0.05em] uppercase">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-11 w-full border border-border bg-transparent px-3 text-sm outline-none focus:border-luxe-black"
            />
          </div>

          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}

          <button
            type="submit"
            disabled={isPending}
            className="flex h-11 w-full items-center justify-center bg-luxe-black text-xs font-medium tracking-[0.1em] text-luxe-white uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

      </div>
    </div>
  );
}
