import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { getAdminUsers } from "@/services";
import type { AdminUser } from "@/types";

export default async function AdminUsersPage() {
  // Reaching this page at all already requires admin:users, so role editing is enabled —
  // updateAdminRole re-checks server-side regardless.
  const [session, users] = await Promise.all([requireCapabilityOrRedirect("admin:users"), getAdminUsers()]);

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="People with access to this dashboard."
        actions={
          <Link
            href="/admin/roles"
            className="h-9 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase leading-9"
          >
            Roles &amp; Permissions
          </Link>
        }
      />

      <DataTable<AdminUser>
        columns={[
          {
            header: "Name",
            cell: (row) => (
              <div>
                <p>
                  {row.name}
                  {row.id === session?.sub ? <span className="ml-2 text-xs text-luxe-gray-dark">(you)</span> : null}
                </p>
                <p className="text-xs text-luxe-gray-dark">{row.email}</p>
              </div>
            ),
          },
          {
            header: "Role",
            cell: (row) => <RoleSelect userId={row.id} defaultRole={row.role} />,
          },
        ]}
        rows={users}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
