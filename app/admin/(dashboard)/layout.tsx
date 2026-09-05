import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { requireAdminSessionOrRedirect } from "@/lib/admin-session";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSessionOrRedirect();

  return (
    <div className="flex min-h-screen bg-luxe-gray-light">
      <AdminSidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* `role` was hardcoded to "admin" here, so an editor was shown "admin" in the topbar. */}
        <AdminTopbar session={{ name: session.name, email: session.email, role: session.role }} />
        <main id="main" className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
