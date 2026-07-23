/** Truly static app configuration — as opposed to `data/`, which is CMS-replaceable content. */
export const siteConfig = {
  defaultLocale: "en-US",
  supportedLocales: ["en-US"],
  defaultCurrency: "EUR",
  currencySymbols: {
    EUR: "€",
    USD: "$",
    GBP: "£",
  } as Record<string, string>,
};
