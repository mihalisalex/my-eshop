export interface AddressSuggestion {
  label: string;
  address1: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

/**
 * A tiny mock of a Places/Loqate-style autocomplete dataset. A real integration swaps
 * this module for a fetch to Google Places, Mapbox, or Loqate — the input component
 * only depends on `suggestAddresses(query)`, not on where the data comes from.
 */
const MOCK_ADDRESSES: AddressSuggestion[] = [
  { label: "12 Rue de Rivoli, 75004 Paris, France", address1: "12 Rue de Rivoli", city: "Paris", region: "Île-de-France", postalCode: "75004", countryCode: "FR" },
  { label: "45 Rue du Faubourg Saint-Honoré, 75008 Paris, France", address1: "45 Rue du Faubourg Saint-Honoré", city: "Paris", region: "Île-de-France", postalCode: "75008", countryCode: "FR" },
  { label: "221B Baker Street, London NW1 6XE, United Kingdom", address1: "221B Baker Street", city: "London", region: "England", postalCode: "NW1 6XE", countryCode: "GB" },
  { label: "10 Downing Street, London SW1A 2AA, United Kingdom", address1: "10 Downing Street", city: "London", region: "England", postalCode: "SW1A 2AA", countryCode: "GB" },
  { label: "5 Avenue Montaigne, 75008 Paris, France", address1: "5 Avenue Montaigne", city: "Paris", region: "Île-de-France", postalCode: "75008", countryCode: "FR" },
  { label: "1 Piazza del Duomo, 20122 Milan, Italy", address1: "1 Piazza del Duomo", city: "Milan", region: "Lombardy", postalCode: "20122", countryCode: "IT" },
  { label: "30 Via Monte Napoleone, 20121 Milan, Italy", address1: "30 Via Monte Napoleone", city: "Milan", region: "Lombardy", postalCode: "20121", countryCode: "IT" },
  { label: "Kurfürstendamm 100, 10709 Berlin, Germany", address1: "Kurfürstendamm 100", city: "Berlin", region: "Berlin", postalCode: "10709", countryCode: "DE" },
  { label: "Paseo de Gracia 92, 08008 Barcelona, Spain", address1: "Paseo de Gracia 92", city: "Barcelona", region: "Catalonia", postalCode: "08008", countryCode: "ES" },
  { label: "Herengracht 100, 1015 BS Amsterdam, Netherlands", address1: "Herengracht 100", city: "Amsterdam", region: "North Holland", postalCode: "1015 BS", countryCode: "NL" },
  { label: "350 Fifth Avenue, New York, NY 10118, United States", address1: "350 Fifth Avenue", city: "New York", region: "NY", postalCode: "10118", countryCode: "US" },
  { label: "1 Rodeo Drive, Beverly Hills, CA 90210, United States", address1: "1 Rodeo Drive", city: "Beverly Hills", region: "CA", postalCode: "90210", countryCode: "US" },
  { label: "Karl Johans gate 1, 0154 Oslo, Norway", address1: "Karl Johans gate 1", city: "Oslo", region: "Oslo", postalCode: "0154", countryCode: "NO" },
  { label: "Ermou 10, 10563 Athens, Greece", address1: "Ermou 10", city: "Athens", region: "Attica", postalCode: "10563", countryCode: "GR" },
  { label: "Rue Neuve 20, 1000 Brussels, Belgium", address1: "Rue Neuve 20", city: "Brussels", region: "Brussels", postalCode: "1000", countryCode: "BE" },
];

export function suggestAddresses(query: string, limit = 5): AddressSuggestion[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 3) return [];
  return MOCK_ADDRESSES.filter((entry) => entry.label.toLowerCase().includes(normalized)).slice(0, limit);
}
