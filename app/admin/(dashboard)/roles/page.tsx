import { Check, X } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PERMISSION_GROUPS } from "@/constants/permissions";

export default function AdminRolesPage() {
  return (
    <div>
      <AdminPageHeader
        title="Roles & Permissions"
        description="This demo has two roles — Admin and Editor. Assign roles from the Users page."
      />

      <div className="space-y-8">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.title} className="border border-border bg-luxe-white">
            <div className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b border-border bg-luxe-gray-light/40 px-4 py-2.5">
              <span className="text-xs font-medium tracking-[0.05em] uppercase">{group.title}</span>
              <span className="text-center text-xs font-medium tracking-[0.05em] uppercase">Admin</span>
              <span className="text-center text-xs font-medium tracking-[0.05em] uppercase">Editor</span>
            </div>
            {group.capabilities.map((capability) => (
              <div
                key={capability.label}
                className="grid grid-cols-[1fr_80px_80px] items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <span>{capability.label}</span>
                <span className="flex justify-center">
                  {capability.admin ? (
                    <Check className="size-4 text-green-700" strokeWidth={1.5} />
                  ) : (
                    <X className="size-4 text-luxe-gray-dark/40" strokeWidth={1.5} />
                  )}
                </span>
                <span className="flex justify-center">
                  {capability.editor ? (
                    <Check className="size-4 text-green-700" strokeWidth={1.5} />
                  ) : (
                    <X className="size-4 text-luxe-gray-dark/40" strokeWidth={1.5} />
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
