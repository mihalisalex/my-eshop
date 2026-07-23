"use client";

import { useState } from "react";
import type { AdminUser } from "@/types";

export function RoleSelect({ defaultRole }: { defaultRole: AdminUser["role"] }) {
  const [role, setRole] = useState(defaultRole);

  return (
    <select
      value={role}
      onChange={(e) => setRole(e.target.value as AdminUser["role"])}
      className="h-8 border border-border bg-transparent px-2 text-xs capitalize outline-none focus:border-luxe-black"
    >
      <option value="admin">Admin</option>
      <option value="editor">Editor</option>
    </select>
  );
}
