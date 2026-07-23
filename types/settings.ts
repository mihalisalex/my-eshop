export interface SocialLink {
  platform: "instagram" | "facebook" | "tiktok" | "pinterest" | "youtube" | "x";
  url: string;
}

export interface SiteSettings {
  siteName: string;
  tagline: string;
  logo: string;
  logoDark?: string;
  favicon: string;
  contactEmail: string;
  currency: string;
  locale: string;
  socialLinks: SocialLink[];
  announcementMessages: string[];
}
