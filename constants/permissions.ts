export interface PermissionCapability {
  label: string;
  admin: boolean;
  editor: boolean;
}

export interface PermissionGroup {
  title: string;
  capabilities: PermissionCapability[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Catalog",
    capabilities: [
      { label: "View products, collections, categories", admin: true, editor: true },
      { label: "Edit product details and variants", admin: true, editor: true },
      { label: "Manage discounts and gift cards", admin: true, editor: false },
    ],
  },
  {
    title: "Content",
    capabilities: [
      { label: "Edit homepage sections (draft)", admin: true, editor: true },
      { label: "Publish homepage sections", admin: true, editor: false },
      { label: "Manage blog posts", admin: true, editor: true },
      { label: "Manage navigation menu", admin: true, editor: false },
    ],
  },
  {
    title: "Customers & Orders",
    capabilities: [
      { label: "View orders and customers", admin: true, editor: true },
      { label: "Process returns", admin: true, editor: false },
    ],
  },
  {
    title: "Administration",
    capabilities: [
      { label: "Manage users and roles", admin: true, editor: false },
      { label: "Edit site settings and SEO", admin: true, editor: false },
      { label: "View activity log", admin: true, editor: true },
    ],
  },
];
