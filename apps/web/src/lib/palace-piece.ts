/**
 * Palace court piece roles - Chess.com Neo objects (same silhouette both seats;
 * only palette color differs). Rules stay man → king.
 *
 * Board mapping (Chess.com parity - mirrored shapes):
 *   Man  (both seats) → Servant (Neo pawn)
 *   King (both seats) → King (Neo king)
 *
 * Son / Daughter / Queen remain picker / chrome labels only - not asymmetric
 * board art (that made opposite seats look like different piece sets).
 *
 * Accents (`--dama-piece-king` / queen / heir) are derived from the active
 * piece palette so the burgundy mark stays readable on every color pair.
 */

export type PalacePieceRole = "servant" | "son" | "daughter" | "king" | "queen";

export function palacePieceRole(_player: 1 | 2, isKing: boolean): PalacePieceRole {
  return isKing ? "king" : "servant";
}

export const PALACE_SEAT_ROLES = {
  light: "Man",
  dark: "Man",
  lightCrowned: "King",
  darkCrowned: "King",
} as const;

export const PALACE_ROLE_ORDER: PalacePieceRole[] = ["servant", "son", "daughter", "king", "queen"];

export function palaceRoleLabel(role: PalacePieceRole): string {
  switch (role) {
    case "servant":
      return "Servant";
    case "son":
      return "Son";
    case "daughter":
      return "Daughter";
    case "king":
      return "King";
    case "queen":
      return "Queen";
  }
}

/** Mix hex toward another hex (0..1). Fail-closed: returns `hex` if parse fails. */
export function mixHex(hex: string, toward: string, t: number): string {
  const a = parseHex(hex);
  const b = parseHex(toward);
  if (!a || !b) return hex;
  const k = Math.min(1, Math.max(0, t));
  const mix = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `#${toByte(mix(a.r, b.r))}${toByte(mix(a.g, b.g))}${toByte(mix(a.b, b.b))}`;
}

function parseHex(raw: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((raw || "").trim());
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toByte(n: number): string {
  return Math.min(255, Math.max(0, n)).toString(16).padStart(2, "0");
}

/** Brand burgundy from official dama-mark. */
export const DAMA_BRAND_MARK = "#A31D38";

/**
 * Court metals from the active piece pair, anchored to brand burgundy
 * so every palette still reads as Dama.
 */
export function palaceAccentsFromPair(
  pieceLight: string,
  pieceDark: string,
): {
  king: string;
  queen: string;
  heir: string;
  mark: string;
} {
  const gold = "#C9A227";
  const rose = "#B76E79";
  return {
    mark: mixHex(DAMA_BRAND_MARK, pieceDark, 0.2),
    king: mixHex(mixHex(DAMA_BRAND_MARK, gold, 0.35), pieceDark, 0.15),
    queen: mixHex(mixHex(DAMA_BRAND_MARK, rose, 0.4), pieceLight, 0.12),
    heir: mixHex(mixHex(DAMA_BRAND_MARK, pieceLight, 0.35), gold, 0.2),
  };
}
