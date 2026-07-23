import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
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
      { label: "Inventory", href: "/admin/inventory", icon: Boxes },
      { label: "Collections", href: "/admin/collections", icon: Layers },
      { label: "Categories", href: "/admin/categories", icon: Tags },
      { label: "Discounts", href: "/admin/discounts", icon: Percent },
      { label: "Gift Cards", href: "/admin/gift-cards", icon: Gift },
    ],
  },
  {
    title: "Content",
    items: [
      { label: "Homepage Sections", href: "/admin/homepage", icon: LayoutTemplate },
      { label: "Hero Management", href: "/admin/homepage/hero", icon: ImageIcon },
      { label: "Media Library", href: "/admin/media", icon: GalleryHorizontal },
      { label: "Navigation Menu", href: "/admin/navigation", icon: MenuIcon },
      { label: "Blog Posts", href: "/admin/blog", icon: Newspaper },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingBag },
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Returns", href: "/admin/returns", icon: PackageOpen },
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
      { label: "SEO Settings", href: "/admin/seo", icon: Search },
      { label: "Site Settings", href: "/admin/settings", icon: Settings },
      { label: "Appearance", href: "/admin/appearance", icon: Palette },
      { label: "Users", href: "/admin/users", icon: UserCog },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck },
      { label: "Activity Log", href: "/admin/activity", icon: History },
    ],
  },
];
