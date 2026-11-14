const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
};

const NON_COUNTRY_CODES = new Set(['WG', 'XX', 'ZZ']);

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - 65;

/**
 * Converts a two-letter ISO 3166-1 alpha-2 country code (e.g. `JP`, `US`)
 * into its Unicode flag emoji, returning `null` for custom non-country tags.
 */
export function getCountryFlagEmoji(countryCode?: string | null): string | null {
  if (!countryCode) {
    return null;
  }
  const normalized = countryCode.trim().toUpperCase();
  const iso = CODE_ALIASES[normalized] ?? normalized;
  if (!/^[A-Z]{2}$/.test(iso) || NON_COUNTRY_CODES.has(iso)) {
    return null;
  }

  return (
    String.fromCodePoint(iso.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET) +
    String.fromCodePoint(iso.charCodeAt(1) + REGIONAL_INDICATOR_OFFSET)
  );
}
