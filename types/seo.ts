export interface BreadcrumbItem {
  name: string;
  href: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SiteSeoDefaults {
  titleTemplate: string;
  defaultTitle: string;
  defaultDescription: string;
  siteUrl: string;
  defaultOgImage: string;
  twitterHandle?: string;
  organization: {
    name: string;
    logo: string;
    sameAs: string[];
  };
}
