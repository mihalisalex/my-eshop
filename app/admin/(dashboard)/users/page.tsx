import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { RoleSelect } from "@/components/admin/RoleSelect";
import {
  ChangeOwnPasswordForm,
  CreateAdminUserForm,
  DeleteAdminUserButton,
} from "@/components/admin/AdminUserForms";
import { requireCapabilityOrRedirect } from "@/lib/admin-session";
import { getAdminUsers } from "@/services";
import type { AdminUser } from "@/types";

export default async function AdminUsersPage() {
  // Reaching this page at all already requires admin:users, and every action re-checks
  // server-side regardless — hiding a control has never been the protection.
  const [session, users] = await Promise.all([requireCapabilityOrRedirect("admin:users"), getAdminUsers()]);

  const adminCount = users.filter((user) => user.role === "admin").length;

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

      {adminCount <= 1 ? (
        <p className="mb-6 border border-destructive bg-destructive/5 p-4 text-sm">
          <strong>There is only one admin account.</strong> If that password is lost there is no way back into
          the dashboard without direct database access. Add a second admin below.
        </p>
      ) : null}

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
          {
            header: "",
            className: "text-right",
            cell: (row) => (
              <DeleteAdminUserButton userId={row.id} name={row.name} isSelf={row.id === session?.sub} />
            ),
          },
        ]}
        rows={users}
        getRowKey={(row) => row.id}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CreateAdminUserForm />
        <ChangeOwnPasswordForm />
      </div>
    </div>
  );
}
