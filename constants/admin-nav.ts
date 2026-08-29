import type { LucideIcon } from "lucide-react";
import type { Capability } from "@/constants/permissions";
import {
  LayoutDashboard,
  Package,
  Layers,
  Tags,
  Percent,
  LayoutTemplate,
  Image as ImageIcon,
  GalleryHorizontal,
  Menu as MenuIcon,
  Newspaper,
  ShoppingBag,
  Users,
  Mail,
  Search,
  Settings,
  Truck,
  Palette,
  UserCog,
  Boxes,
  PackageOpen,
  Gift,
  BarChart3,
  ShieldCheck,
  History,
  Send,
  MessageSquare,
  Sparkles,
  Users2,
  Upload,
  CreditCard,
  Wallet,
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hides the link when the signed-in role lacks it. UX only — the page/action guards
   * are the real gate; a hidden link is still reachable by typing the URL. */
  capability?: Capability;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard }],
  },
  {
    title: "Catalog",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Import Products", href: "/admin/products/import", icon: Upload },
      { label: "Inventory", href: "/admin/inventory", icon: Boxes },
      { label: "Collections", href: "/admin/collections", icon: Layers },
      { label: "Categories", href: "/admin/categories", icon: Tags },
      { label: "Discounts", href: "/admin/discounts", icon: Percent, capability: "catalog:discounts" },
      { label: "Gift Cards", href: "/admin/gift-cards", icon: Gift, capability: "catalog:discounts" },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Homepage Sections", href: "/admin/homepage", icon: LayoutTemplate, capability: "content:publish" },
      { label: "Hero Management", href: "/admin/homepage/hero", icon: ImageIcon, capability: "content:publish" },
      { label: "Media Library", href: "/admin/media", icon: GalleryHorizontal },
      { label: "Navigation Menu", href: "/admin/navigation", icon: MenuIcon, capability: "content:navigation" },
      { label: "Blog Posts", href: "/admin/blog", icon: Newspaper },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, capability: "payments:view" },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Returns", href: "/admin/returns", icon: PackageOpen, capability: "orders:returns" },
      { label: "Newsletter", href: "/admin/newsletter", icon: Mail },
      { label: "Contact Messages", href: "/admin/messages", icon: MessageSquare },
      { label: "Ask a Stylist", href: "/admin/concierge", icon: Sparkles },
      { label: "Referrals", href: "/admin/referrals", icon: Users2 },
    ],
  },
  {
    title: "Insights",
    items: [
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Emails", href: "/admin/emails", icon: Send },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Payment Settings", href: "/admin/settings/payments", icon: Wallet, capability: "payments:configure" },
      { label: "Shipping", href: "/admin/settings/shipping", icon: Truck, capability: "admin:settings" },
      { label: "SEO Settings", href: "/admin/seo", icon: Search, capability: "admin:settings" },
      { label: "Site Settings", href: "/admin/settings", icon: Settings, capability: "admin:settings" },
      // No capability: a read-only list of design tokens, with no data or actions to protect.
      { label: "Appearance", href: "/admin/appearance", icon: Palette },
      { label: "Users", href: "/admin/users", icon: UserCog, capability: "admin:users" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
      { label: "Activity Log", href: "/admin/activity", icon: History },
    ],
  },
];
