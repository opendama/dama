export type HomeSurfaceChrome = {
  live_section_title?: string;
  live_section_blurb?: string;
  players_label?: string;
  prize_label?: string;
  entry_label?: string;
  free_label?: string;
  enroll_cta?: string;
  join_cta?: string;
  top_up_cta?: string;
  empty_live?: string;
  /** Missing card cell placeholder (never reuse empty_live list copy). */
  empty_value?: string;
  home_chrome_unavailable?: string;
  carousel_aria?: string;
  prize_pool_now_label?: string;
  prize_pool_if_full_label?: string;
  prize_pool_guaranteed_label?: string;
  prize_pool_frozen_blurb?: string;
  prize_pool_entry_fees_note?: string;
  meta_separator?: string;
  amount_currency_separator?: string;
};

const HOME_SURFACE_CHROME_KEYS: (keyof HomeSurfaceChrome)[] = [
  "live_section_title",
  "live_section_blurb",
  "players_label",
  "prize_label",
  "entry_label",
  "free_label",
  "enroll_cta",
  "join_cta",
  "top_up_cta",
  "empty_live",
  "empty_value",
  "home_chrome_unavailable",
  "carousel_aria",
  "prize_pool_now_label",
  "prize_pool_if_full_label",
  "prize_pool_guaranteed_label",
  "prize_pool_frozen_blurb",
  "prize_pool_entry_fees_note",
  "meta_separator",
  "amount_currency_separator",
];

function chromeFieldReady(key: string, v: unknown): boolean {
  if (typeof v !== "string" || v.length === 0) return false;
  if (key.endsWith("_separator") || key.endsWith("_joiner") || key.endsWith("_space")) {
    return true;
  }
  return v.trim().length > 0;
}

/** Fail closed: every home surface chrome string must be present from the database. */
export function isHomeSurfaceChromeReady(
  chrome: HomeSurfaceChrome | null | undefined,
): chrome is Required<HomeSurfaceChrome> {
  if (!chrome) return false;
  return HOME_SURFACE_CHROME_KEYS.every((k) => chromeFieldReady(k, chrome[k]));
}
