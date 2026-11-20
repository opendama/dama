"use client";

import { Button } from "@/components/ui/button";
import { useThemeChromeQuery } from "@/hooks/query/useThemeChromeQuery";
import { isThemeChromeReady, themeChromeFill, themeChromeLabel } from "@/types/theme-chrome";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** Icon-only light/dark toggle (sun / moon). Accessible label from theme_chrome DB. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const chromeQuery = useThemeChromeQuery(true);
  const chrome = isThemeChromeReady(chromeQuery.data) ? chromeQuery.data : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || chromeQuery.isLoading) {
    return (
      <Button type="button" variant="outline" size="icon" className={className} disabled>
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  if (!chrome) {
    return null;
  }

  const isDark = resolvedTheme === "dark";
  const current = isDark ? "dark" : "light";
  const next = isDark ? "light" : "dark";
  const label = themeChromeLabel(chrome, current, resolvedTheme);
  const nextLabel = themeChromeLabel(chrome, next, resolvedTheme);
  const aria = themeChromeFill(chrome.aria_template, label, nextLabel);
  const title = themeChromeFill(chrome.title_template, label, nextLabel);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className}
      aria-label={aria || chrome.aria_label}
      title={title}
      onClick={() => setTheme(next)}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
