import type { Link } from "./common";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  children?: NavItem[];
  featured?: {
    title: string;
    image: string;
    href: string;
  }[];
}

export interface FooterColumn {
  title: string;
  links: Link[];
}

export interface NavigationConfig {
  primary: NavItem[];
  utility: NavItem[];
  footer: FooterColumn[];
}
