"use client";

import { brandMarkSrc, resolveAvatarTone } from "@/lib/brand-avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  /** Extra classes on the inner img (object-cover for photos; contain for mark). */
  imgClassName?: string;
  /** Board seat piece color: picks mark contrast independent of app theme. */
  pieceSide?: "light" | "dark" | null;
  /** Soft surface behind transparent mark when no photo (theme token only). */
  showMarkPlate?: boolean;
};

/**
 * User face: photo when present; otherwise the exact Dama logo
 * (burgundy on light, white on dark). No invented initials or redesigned marks.
 */
export function DamaUserAvatar({
  src,
  alt = "",
  className,
  imgClassName,
  pieceSide = null,
  showMarkPlate = true,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const thumb = (src || "").trim();
  const showPhoto = Boolean(thumb) && failedSrc !== thumb;
  const tone = resolveAvatarTone({
    resolvedTheme: mounted ? resolvedTheme : "light",
    pieceSide,
  });
  const mark = brandMarkSrc(tone);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        showMarkPlate && !showPhoto ? "bg-[var(--dama-surface)]" : null,
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={alt}
          referrerPolicy="no-referrer"
          className={cn("h-full w-full object-cover", imgClassName)}
          onError={() => setFailedSrc(thumb)}
        />
      ) : (
        // Exact brand PNG - fill the face with modest inset so circular clips stay clean.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mark} alt={alt} className={cn("h-[84%] w-[84%] object-contain", imgClassName)} />
      )}
    </span>
  );
}
