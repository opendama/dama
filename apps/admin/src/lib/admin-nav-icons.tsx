import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeftRight,
  Building2,
  CalendarDays,
  ChartColumn,
  CreditCard,
  Flag,
  Globe2,
  IdCard,
  Image,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Receipt,
  Shield,
  Trophy,
  Upload,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

/**
 * Code-only nav icons keyed by console href path (Trim pattern).
 * Labels/hrefs stay DB-driven; unknown paths render with no invent default glyph.
 * Tournaments = Trophy (cups). Admin has no Leaderboard rail item.
 */
const ADMIN_NAV_ICONS: Readonly<Record<string, LucideIcon>> = {
  dashboard: LayoutDashboard,
  "feature-flags": Flag,
  progression: Zap,
  tournaments: Trophy,
  payments: CreditCard,
  "payments/overview": ChartColumn,
  "payments/currency": Wallet,
  "payments/geo": Globe2,
  "payments/kyc": IdCard,
  "payments/host-trust": Shield,
  "payments/payouts": ArrowLeftRight,
  "payments/receipts": Receipt,
  "payments/transactions": ArrowLeftRight,
  "payments/telegram-ops": Building2,
  "media-pool": Upload,
  avatars: Image,
  banks: Landmark,
  users: Users,
  telemetry: Activity,
  activity: ChartColumn,
  rbac: Shield,
  ads: Megaphone,
  events: CalendarDays,
};

export function adminNavIconForHref(href: string | undefined | null): LucideIcon | null {
  const withoutQuery = (href || "").split("?")[0] ?? "";
  const path = withoutQuery.replace(/^\/+|\/+$/g, "") || "";
  if (!path) return null;
  if (ADMIN_NAV_ICONS[path]) return ADMIN_NAV_ICONS[path];
  const seg = path.split("/")[0] || "";
  return ADMIN_NAV_ICONS[seg] ?? null;
}
