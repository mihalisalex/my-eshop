import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { RoleSelect } from "@/components/admin/RoleSelect";
import { getAdminUsers } from "@/services";
import type { AdminUser } from "@/types";

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="People with access to this dashboard."
        actions={
          <>
            <Link
              href="/admin/roles"
              className="h-9 border border-border px-4 text-xs font-medium tracking-[0.05em] uppercase leading-9"
            >
              Roles &amp; Permissions
            </Link>
            <button
              type="button"
              className="h-9 bg-luxe-black px-4 text-xs font-medium tracking-[0.05em] text-luxe-white uppercase"
            >
              Invite User
            </button>
          </>
        }
      />

      <DataTable<AdminUser>
        columns={[
          {
            header: "Name",
            cell: (row) => (
              <div>
                <p>{row.name}</p>
                <p className="text-xs text-luxe-gray-dark">{row.email}</p>
              </div>
            ),
          },
          { header: "Role", cell: (row) => <RoleSelect defaultRole={row.role} /> },
        ]}
        rows={users}
        getRowKey={(row) => row.id}
      />
    </div>
  );
}
