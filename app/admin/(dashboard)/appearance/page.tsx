import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

const COLORS = [
  { name: "White", var: "var(--color-luxe-white)", hex: "#FFFFFF" },
  { name: "Black", var: "var(--color-luxe-black)", hex: "#111111" },
  { name: "Light Gray", var: "var(--color-luxe-gray-light)", hex: "#F5F5F5" },
  { name: "Dark Gray", var: "var(--color-luxe-gray-dark)", hex: "#555555" },
];

export default function AdminAppearancePage() {
  return (
    <div>
      <AdminPageHeader
        title="Appearance"
        description="The design system tokens that drive the storefront. Read-only for now — a full theme editor can wire these back to globals.css later."
      />

      <div className="space-y-8">
        <section className="border border-border bg-luxe-white p-6">
          <h3 className="mb-4 text-sm font-medium tracking-[0.05em] uppercase">Color Palette</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {COLORS.map((color) => (
              <div key={color.name}>
                <div
                  className="h-20 w-full border border-border"
                  style={{ backgroundColor: color.var }}
                />
                <p className="mt-2 text-sm">{color.name}</p>
                <p className="text-xs text-luxe-gray-dark">{color.hex}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-border bg-luxe-white p-6">
          <h3 className="mb-4 text-sm font-medium tracking-[0.05em] uppercase">Typography</h3>
          <div className="space-y-4">
            <div>
              <p className="font-heading text-4xl">Playfair Display — Headings</p>
              <p className="text-xs text-luxe-gray-dark">font-heading · used for h1–h4, editorial moments</p>
            </div>
            <div>
              <p className="text-base">Inter — Body copy sits here at 16px for comfortable reading.</p>
              <p className="text-xs text-luxe-gray-dark">font-sans · used for everything else</p>
            </div>
            <div>
              <p className="text-eyebrow">Eyebrow / Overline Label</p>
              <p className="text-xs text-luxe-gray-dark">.text-eyebrow · uppercase, wide tracking</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
