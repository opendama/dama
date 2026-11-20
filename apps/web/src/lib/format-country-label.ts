/**
 * Display label for a resolved country: "{name} ({ISO2})".
 * Prefer API/Nominatim country_name; else Intl English region name; else ISO-2.
 */
export function formatCountryLabel(countryCode: string, countryName?: string | null): string {
  const cc = (countryCode || "").trim().toUpperCase();
  if (cc.length !== 2) return "";
  let name = (countryName || "").trim();
  if (!name && typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    try {
      name = new Intl.DisplayNames(["en"], { type: "region" }).of(cc) || "";
    } catch {
      name = "";
    }
  }
  // Do not use String.includes(cc) - "Ethiopia" contains "ET".
  if (name && name.toUpperCase() !== cc && !/\([A-Z]{2}\)\s*$/.test(name)) {
    return `${name} (${cc})`;
  }
  if (name) return name;
  return cc;
}
