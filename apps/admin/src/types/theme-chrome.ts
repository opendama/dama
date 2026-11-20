export type ThemeChrome = {
  source?: string;
  theme_chrome_unavailable?: string;
  aria_label?: string;
  label_system?: string;
  label_light?: string;
  label_dark?: string;
  label_system_resolved_prefix?: string;
  aria_template?: string;
  title_template?: string;
  resolved_paren_open?: string;
  resolved_paren_close?: string;
};

const THEME_CHROME_KEYS: (keyof ThemeChrome)[] = [
  "source",
  "theme_chrome_unavailable",
  "aria_label",
  "label_system",
  "label_light",
  "label_dark",
  "label_system_resolved_prefix",
  "aria_template",
  "title_template",
  "resolved_paren_open",
  "resolved_paren_close",
];

export function isThemeChromeReady(
  chrome: ThemeChrome | null | undefined,
): chrome is Required<ThemeChrome> {
  if (!chrome) return false;
  return THEME_CHROME_KEYS.every((k) => {
    const v = chrome[k];
    return typeof v === "string" && v.trim().length > 0;
  });
}

export function themeChromeLabel(
  chrome: Required<ThemeChrome>,
  mode: "system" | "light" | "dark",
  resolvedTheme?: string | null,
): string {
  if (mode === "light") return chrome.label_light;
  if (mode === "dark") return chrome.label_dark;
  const resolved = (resolvedTheme || "").trim();
  if (!resolved) return chrome.label_system;
  return `${chrome.label_system_resolved_prefix}${chrome.resolved_paren_open}${resolved}${chrome.resolved_paren_close}`;
}

export function themeChromeFill(template: string, current: string, next: string): string {
  return template.replaceAll("{current}", current).replaceAll("{next}", next);
}
