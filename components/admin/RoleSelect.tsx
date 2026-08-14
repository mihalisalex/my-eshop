"use client";

import { useState, useTransition } from "react";
import { updateAdminRole } from "@/app/admin/(dashboard)/users/actions";
import type { AdminRole } from "@/types";

/**
 * This was previously local `useState` with no server call — the dropdown looked like it
 * worked and silently reverted on reload. It now persists, and surfaces the server's
 * refusal (e.g. demoting the last remaining admin) instead of pretending it succeeded.
 */
export function RoleSelect({ userId, defaultRole, disabled }: { userId: string; defaultRole: AdminRole; disabled?: boolean }) {
  const [role, setRole] = useState<AdminRole>(defaultRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: AdminRole) {
    const previous = role;
    setRole(next);
    setError(null);
    startTransition(async () => {
      const result = await updateAdminRole(userId, next);
      if (result?.error) {
        setError(result.error);
        setRole(previous);
      }
    });
  }

  return (
    <div>
      <select
        value={role}
        disabled={disabled || isPending}
        onChange={(e) => handleChange(e.target.value as AdminRole)}
        aria-label="Role"
        className="h-8 border border-border bg-transparent px-2 text-xs capitalize outline-none focus:border-luxe-black disabled:opacity-50"
      >
        <option value="admin">Admin</option>
        <option value="editor">Editor</option>
      </select>
      {error ? <p className="mt-1 max-w-xs text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
