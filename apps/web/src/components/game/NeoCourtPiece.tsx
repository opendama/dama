"use client";

import type { PalacePieceRole } from "@/lib/palace-piece";
import { cn } from "@/lib/utils";
import { useId } from "react";

type Props = {
  role: PalacePieceRole;
  player: 1 | 2;
  className?: string;
  base?: string;
  shade?: string;
  outline?: string;
};

type NeoKind = "pawn" | "king" | "queen";

/**
 * Chess.com Neo physical-object language (exact piece masks):
 * body + contour shade + thick outline + collar highlight.
 *
 * Board seats share silhouettes (man→pawn, king→king); only fill color differs.
 * Picker may still preview son / daughter / queen variants.
 */
export function NeoCourtPiece({
  role,
  player,
  className,
  base,
  shade,
  outline = "#2B2B2B",
}: Props) {
  const uid = useId().replace(/:/g, "");
  const isLight = player === 1;
  // Dark-side default (White & half): CSS `--dama-piece-dark-fill` is a 50/50 gradient.
  const fill =
    base ??
    (isLight
      ? "var(--dama-piece-light, #F0F0F0)"
      : "var(--dama-piece-dark-fill, var(--dama-piece-dark, #4A4A4A))");
  const shadeFill =
    shade ??
    (isLight
      ? "color-mix(in srgb, var(--dama-piece-light, #F0F0F0) 42%, #8A8A8A)"
      : "color-mix(in srgb, var(--dama-piece-dark, #4A4A4A) 55%, #0A0A0A)");
  const highlightFill = isLight
    ? "color-mix(in srgb, var(--dama-piece-light, #F0F0F0) 70%, #ffffff)"
    : "color-mix(in srgb, var(--dama-piece-dark, #4A4A4A) 55%, #9A9A9A)";

  const kind = neoKind(role);
  const scale = role === "daughter" ? 0.92 : 1;
  const crownShadeId = `son-crown-shade-${uid}`;

  return (
    <span
      className={cn("relative block h-full w-full overflow-visible", className)}
      role="img"
      aria-hidden
    >
      <span
        className="absolute inset-0"
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "center bottom",
        }}
      >
        <MaskLayer src={`/pieces/neo/${kind}-body.png`} color={fill} />
        <MaskLayer src={`/pieces/neo/${kind}-shade.png`} color={shadeFill} />
        <MaskLayer src={`/pieces/neo/${kind}-highlight.png`} color={highlightFill} />
        <MaskLayer src={`/pieces/neo/${kind}-outline.png`} color={outline} />
      </span>

      {/* Son: compact 3-peak heir crown in Neo outline language */}
      {role === "son" ? (
        // biome-ignore lint/a11y/noSvgWithoutTitle: decorative crown overlay; parent piece is labeled
        <svg
          viewBox="0 0 45 45"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <clipPath id={crownShadeId}>
              <rect x="22.5" y="0" width="22.5" height="14" />
            </clipPath>
          </defs>
          <path
            d="M14.2 11.2 L16.6 4.8 L19.0 10.4 L22.5 2.6 L26.0 10.4 L28.4 4.8 L30.8 11.2 Z"
            fill={fill}
          />
          <g clipPath={`url(#${crownShadeId})`}>
            <path
              d="M14.2 11.2 L16.6 4.8 L19.0 10.4 L22.5 2.6 L26.0 10.4 L28.4 4.8 L30.8 11.2 Z"
              fill={shadeFill}
            />
          </g>
          <path
            d="M14.2 11.2 L16.6 4.8 L19.0 10.4 L22.5 2.6 L26.0 10.4 L28.4 4.8 L30.8 11.2 Z"
            fill="none"
            stroke={outline}
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function neoKind(role: PalacePieceRole): NeoKind {
  switch (role) {
    case "servant":
    case "son":
      return "pawn";
    case "daughter":
    case "queen":
      return "queen";
    case "king":
      return "king";
  }
}

function MaskLayer({ src, color }: { src: string; color: string }) {
  // `background` (not backgroundColor) so 50/50 dark-fill gradients paint correctly.
  return (
    <span
      className="absolute inset-0"
      style={{
        background: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
