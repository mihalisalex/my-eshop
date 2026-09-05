import { Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getAdminSession } from "@/lib/admin-session";
import { capabilitiesByGroup, roleHasCapability } from "@/constants/permissions";
import { ADMIN_ROLES } from "@/types/admin";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

/**
 * Rendered from the same `constants/permissions.ts` definitions the server guards read, so
 * this page can't drift from what's actually enforced. It previously displayed a hardcoded
 * matrix that nothing implemented — it told the owner editors were restricted while they
 * in fact had full admin powers.
 */
export default async function AdminRolesPage() {
  const session = await getAdminSession();
  const groups = capabilitiesByGroup();

  return (
    <div>
      <AdminPageHeader
        title="Roles & Permissions"
        description={
          session
            ? `Enforced on the server for every action. You are signed in as ${session.name} (${session.role}).`
            : "Enforced on the server for every action."
        }
      />

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.title} className="border border-border bg-luxe-white">
            <div className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b border-border bg-luxe-gray-light/40 px-4 py-2.5">
              <span className="text-xs font-medium tracking-[0.05em] uppercase">{group.title}</span>
              {ADMIN_ROLES.map((role) => (
                <span key={role} className="text-center text-xs font-medium tracking-[0.05em] uppercase">
                  {role}
                </span>
              ))}
            </div>
            {group.capabilities.map((capability) => (
              <div
                key={capability.key}
                className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <div>
                  <span>{capability.label}</span>
                  {capability.note ? (
                    <p className="mt-0.5 text-xs text-luxe-gray-dark">{capability.note}</p>
                  ) : null}
                </div>
                {ADMIN_ROLES.map((role) => (
                  <span key={role} className="flex justify-center">
                    {roleHasCapability(role, capability.key) ? (
                      <Check className="size-4 text-green-700" strokeWidth={1.5} aria-label={`${role}: allowed`} />
                    ) : (
                      <X className="size-4 text-luxe-gray-dark/40" strokeWidth={1.5} aria-label={`${role}: not allowed`} />
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-luxe-gray-dark">
        Roles are assigned on the Users page. Custom roles aren&apos;t supported yet — adding one means adding it to{" "}
        <code>ROLE_CAPABILITIES</code> in <code>constants/permissions.ts</code>, which both this table and every server
        guard read from.
      </p>
    </div>
  );
}
