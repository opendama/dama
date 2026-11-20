import type { ClientNavLink } from "@/types/platform";

const MANUAL_TRANSFER_ROUTE_KEYS = new Set(["transfer", "ads_transfer", "events_transfer"]);

export function isManualTransferNavLink(link: ClientNavLink): boolean {
  const key = (link.route_key || "").trim();
  if (MANUAL_TRANSFER_ROUTE_KEYS.has(key)) return true;
  const href = (link.href || "").trim().split("?")[0] || "";
  return (
    href === "/transfer" ||
    href.startsWith("/transfer/") ||
    href === "/ads/transfer" ||
    href.startsWith("/ads/transfer/") ||
    href === "/events/transfer" ||
    href.startsWith("/events/transfer/")
  );
}

/** Keep Manual Transfer nav only when payment route is manual_transfer (ET geo). */
export function filterManualTransferNavLinks(
  links: ClientNavLink[],
  isManualTransferRoute: boolean,
): ClientNavLink[] {
  if (isManualTransferRoute) return links;
  return links.filter((l) => !isManualTransferNavLink(l));
}
