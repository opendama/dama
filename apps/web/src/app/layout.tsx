import { Providers } from "@/components/providers";
import {
  isAppShellChromeReady,
  loadAppShellChrome,
  parseRobotsIndex,
} from "@/lib/app-shell-chrome";
import { siteOrigin } from "@/lib/site-url";
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

type ClientNavMeta = {
  site_title_default?: string;
  site_title_template?: string;
  site_description?: string;
  brand_name?: string;
};

async function loadClientNavMeta(): Promise<ClientNavMeta | null> {
  const base = (process.env.NEXT_PUBLIC_REST_URL || "").trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}/platform/client-nav`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ClientNavMeta;
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
  const [nav, shell] = await Promise.all([loadClientNavMeta(), loadAppShellChrome()]);
  const titleDefault = (nav?.site_title_default || "").trim();
  const titleTemplate = (nav?.site_title_template || "").trim();
  const description = (nav?.site_description || "").trim();
  const brand = (nav?.brand_name || titleDefault || "").trim();
  if (!titleDefault || !titleTemplate || !description || !isAppShellChromeReady(shell)) {
    return { title: "", description: "" };
  }

  const origin = siteOrigin();
  const ogPath = shell.og_image_path.trim();
  const favLight = shell.favicon_light_path.trim();
  const favDark = shell.favicon_dark_path.trim();
  const apple = shell.apple_touch_icon_path.trim();
  const ogAbsolute = origin && ogPath.startsWith("/") ? `${origin}${ogPath}` : ogPath;
  const robots = parseRobotsIndex(shell.robots_index.trim());
  const markAlt = shell.brand_mark_alt.trim();

  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: {
      default: titleDefault,
      template: titleTemplate,
    },
    description,
    applicationName: shell.manifest_name.trim(),
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
      siteName: brand || titleDefault,
      title: titleDefault,
      description,
      ...(ogAbsolute
        ? {
            images: [
              {
                url: ogAbsolute,
                width: 1200,
                height: 1200,
                alt: markAlt || brand || titleDefault,
              },
            ],
          }
        : {}),
      ...(origin ? { url: origin } : {}),
    },
    twitter: {
      card: shell.twitter_card.trim() as "summary_large_image",
      title: titleDefault,
      description,
      ...(ogAbsolute ? { images: [ogAbsolute] } : {}),
    },
    robots,
    appleWebApp: {
      capable: true,
      title: shell.manifest_short_name.trim(),
      statusBarStyle: "black-translucent",
    },
  };
}

/** Pre-paint: migrate prefs → Forest + White & half, then apply CSS tokens. */
const boardPaletteBootScript = `(function(){try{var BK="dama-board-palette",PK="dama-piece-palette",MK="dama-palette-bw-v1",WG="dama-palette-white-green-v1",CW="dama-palette-classic-wb-v1",FW="dama-palette-forest-wb-v2",FH="dama-palette-forest-wh-v3";if(localStorage.getItem(MK)!=="1"){localStorage.setItem(BK,"black_white");localStorage.setItem(PK,"white_green");localStorage.setItem(MK,"1");}if(localStorage.getItem(WG)!=="1"){var cur=localStorage.getItem(PK);if(!cur||cur==="white_black"){localStorage.setItem(PK,"white_green");}localStorage.setItem(WG,"1");}if(localStorage.getItem(CW)!=="1"){localStorage.setItem(BK,"classic");localStorage.setItem(PK,"white_black");localStorage.setItem(CW,"1");}if(localStorage.getItem(FW)!=="1"){localStorage.setItem(BK,"forest");localStorage.setItem(PK,"white_black");localStorage.setItem(FW,"1");}if(localStorage.getItem(FH)!=="1"){localStorage.setItem(BK,"forest");localStorage.setItem(PK,"white_half");localStorage.setItem(FH,"1");}var B={black_white:["#F5F5F5","#2C2C2C","#1A1A1A","#6B7280"],burgundy:["#f7eef1","#9B1B3A","#4A0012","#C0264A"],classic:["#e8dcc8","#7c4a23","#5c4a32","#22c55e"],forest:["#eeeed2","#769656","#4a6741","#baca44"],slate:["#d8dce3","#4a5568","#2d3748","#A31D38"]};var P={white_half:["#FFFFFF","#141414",1],white_black:["#FFFFFF","#141414",0],white_green:["#FFFFFF","#22C55E",0],ivory_burgundy:["#FFF6E8","#7A001F",0],pearl_onyx:["#F4F4F5","#18181B",0],honey_walnut:["#F6C453","#3E2723",0],mist_ocean:["#BFDBFE","#1E3A5F",0],blush_espresso:["#FECACA","#3F2A1D",0]};var bid=localStorage.getItem(BK)||"forest";var pid=localStorage.getItem(PK)||"white_half";var b=B[bid]||B.forest;var p=P[pid]||P.white_half;var r=document.documentElement;r.style.setProperty("--dama-board-light",b[0]);r.style.setProperty("--dama-board-dark",b[1]);r.style.setProperty("--dama-board-frame",b[2]);r.style.setProperty("--dama-board-highlight",b[3]);r.style.setProperty("--dama-piece-light",p[0]);r.style.setProperty("--dama-piece-dark",p[1]);r.style.setProperty("--dama-piece-dark-split",p[2]?"1":"0");r.style.setProperty("--dama-piece-dark-fill",p[2]?("linear-gradient(135deg, "+p[0]+" 50%, "+p[1]+" 50%)"):p[1]);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body className="min-h-screen bg-[var(--dama-bg)] font-sans text-[var(--dama-text)] antialiased">
        <Script
          id="dama-board-palette-boot"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static trusted board-palette boot script
          dangerouslySetInnerHTML={{ __html: boardPaletteBootScript }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          enableColorScheme
          storageKey="dama-web-theme"
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
