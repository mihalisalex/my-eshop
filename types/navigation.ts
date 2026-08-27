import type { Link } from "./common";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  /**
   * Hides this item from the DESKTOP header while keeping it in the mobile menu.
   *
   * The header and the mobile menu render the same `primary` array, so without a flag the
   * only way to shorten one is to shorten both. Editorial links (Journal, About) earn their
   * place in a phone menu — where the list is the navigation — but crowd a desktop header
   * whose job is to get people into the catalogue.
   *
   * Desktop users still reach them: both live in the footer's "Η εταιρεία" column, which is
   * the condition for hiding something here. Do not set this on an item that has no other
   * desktop route to it.
   */
  mobileOnly?: boolean;
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
