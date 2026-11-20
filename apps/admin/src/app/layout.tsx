import { Providers } from "@/components/providers";
import {
  isAppShellChromeReady,
  loadAppShellChrome,
  parseRobotsIndex,
} from "@/lib/app-shell-chrome";
import { siteOrigin } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

type ConsoleNavMeta = {
  brand_title?: string;
  title_template?: string;
  meta_description?: string;
};

async function loadConsoleNavMeta(): Promise<ConsoleNavMeta | null> {
  const base = (process.env.NEXT_PUBLIC_REST_URL || "").trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/platform/console-nav`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ConsoleNavMeta;
  } catch {
    return null;
  }
}

export async function generateViewport(): Promise<Viewport> {
  const shell = await loadAppShellChrome();
  if (!isAppShellChromeReady(shell)) {
    return {
      colorScheme: "dark light",
      width: "device-width",
      initialScale: 1,
    };
  }
  return {
    themeColor: [
      {
        media: "(prefers-color-scheme: light)",
        color: shell.manifest_background_color_light.trim(),
      },
      {
        media: "(prefers-color-scheme: dark)",
        color: shell.manifest_background_color_dark.trim(),
      },
    ],
    colorScheme: "dark light",
    width: "device-width",
    initialScale: 1,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const [nav, shell] = await Promise.all([loadConsoleNavMeta(), loadAppShellChrome()]);
  const brandTitle = (nav?.brand_title || "").trim();
  const titleTemplate = (nav?.title_template || "").trim();
  const description = (nav?.meta_description || "").trim();
  if (!brandTitle || !titleTemplate || !description || !isAppShellChromeReady(shell)) {
    return { title: "", description: "" };
  }

  const origin = siteOrigin();
  const ogPath = shell.og_image_path.trim();
  const favLight = shell.favicon_light_path.trim();
  const favDark = shell.favicon_dark_path.trim();
  const apple = shell.apple_touch_icon_path.trim();
  const ogAbsolute = origin && ogPath.startsWith("/") ? `${origin}${ogPath}` : ogPath;
  const robots = parseRobotsIndex(shell.admin_robots.trim());
  const markAlt = shell.brand_mark_alt.trim();

  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: {
      default: brandTitle,
      template: titleTemplate,
    },
    description,
    applicationName: brandTitle,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        {
          url: favLight,
          type: "image/png",
          media: "(prefers-color-scheme: light)",
        },
        {
          url: favDark,
          type: "image/png",
          media: "(prefers-color-scheme: dark)",
        },
      ],
      apple: [{ url: apple, sizes: "180x180", type: "image/png" }],
      shortcut: ["/favicon.ico"],
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: brandTitle,
      title: brandTitle,
      description,
      ...(ogAbsolute
        ? {
            images: [
              {
                url: ogAbsolute,
                width: 1200,
                height: 1200,
                alt: markAlt || brandTitle,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: shell.twitter_card.trim() as "summary_large_image",
      title: brandTitle,
      description,
      ...(ogAbsolute ? { images: [ogAbsolute] } : {}),
    },
    robots: {
      ...robots,
      googleBot: {
        index: robots.index,
        follow: robots.follow,
      },
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body className="min-h-screen bg-[var(--dama-bg)] font-sans text-[var(--dama-text)] antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          enableColorScheme
          storageKey="dama-admin-theme"
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
