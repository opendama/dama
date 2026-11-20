"use client";

import { OnlineStatusDot } from "@/components/play-rail/OnlineStatusDot";
import { DamaUserAvatar } from "@/components/ui/DamaUserAvatar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type StackAvatarPerson = {
  id: string;
  username: string;
  avatarThumbUrl?: string | null;
  avatarFullUrl?: string | null;
  online?: boolean;
  playing?: boolean;
};

type Props = {
  people: StackAvatarPerson[];
  /** Max faces before overflow chip. */
  max?: number;
  size?: "sm" | "md";
  /**
   * `circle` = classic overlap stack (viewers).
   * `rounded` = All Players row face (`rounded-md`) for Watch seats.
   */
  faceShape?: "circle" | "rounded";
  /** Total count when larger than people.length (e.g. anonymous spectators). */
  totalCount?: number;
  overflowPrefix: string;
  className?: string;
  /** Wrap each face (e.g. hover card). */
  renderFace?: (person: StackAvatarPerson, face: ReactNode) => ReactNode;
};

const sizeClass = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-9 w-9 text-xs",
} as const;

/** Half-face pull: ~50% of diameter (sm=2rem → -1rem, md=2.25rem → -1.125rem). */
const overlapMargin = {
  sm: "-1rem",
  md: "-1.125rem",
} as const;

/**
 * Overlapping circular avatars (~half overlap). Leftmost is front (highest z).
 * Matches professional avatar-stack practice used on live games / viewers.
 */
export function AvatarStack({
  people,
  max = 3,
  size = "sm",
  faceShape = "circle",
  totalCount,
  overflowPrefix,
  className,
  renderFace,
}: Props) {
  const visible = people.slice(0, max);
  const total = totalCount ?? people.length;
  const overflow = Math.max(0, total - visible.length);
  const pull = overlapMargin[size];
  const shapeClass = faceShape === "rounded" ? "rounded-md" : "rounded-full";

  return (
    <ul
      // isolate: face hover:z-* stays inside the stack so it cannot paint over rail sticky tabs.
      className={cn("flex items-center overflow-visible isolate", className)}
      aria-hidden={visible.length === 0}
    >
      {visible.map((p, i) => {
        const face = (
          <span
            className={cn(
              // overflow-visible so bottom-right online/playing dots are not clipped.
              "relative inline-flex shrink-0 overflow-visible border-2 border-[var(--dama-card)] shadow-sm ring-0",
              shapeClass,
              sizeClass[size],
            )}
          >
            <DamaUserAvatar
              src={p.avatarThumbUrl || p.avatarFullUrl}
              className={cn("h-full w-full", shapeClass)}
            />
            {p.online != null || p.playing != null ? (
              <OnlineStatusDot
                online={p.online}
                playing={p.playing}
                size={size === "md" ? "md" : "sm"}
              />
            ) : null}
          </span>
        );
        return (
          <li
            key={p.id}
            className="relative list-none transition-[z-index] hover:z-50 focus-within:z-50"
            style={{ zIndex: visible.length - i, marginLeft: i === 0 ? 0 : pull }}
          >
            {renderFace ? renderFace(p, face) : face}
          </li>
        );
      })}
      {overflow > 0 ? (
        <li
          className="relative list-none"
          style={{
            // Above stacked faces so +N is never covered by half-overlap.
            zIndex: visible.length + 1,
            marginLeft: visible.length ? pull : 0,
          }}
        >
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center border-2 border-[var(--dama-card)] bg-[var(--dama-brand)] font-semibold text-white shadow-sm",
              shapeClass,
              sizeClass[size],
            )}
          >
            {overflowPrefix}
            {overflow}
          </span>
        </li>
      ) : null}
    </ul>
  );
}
