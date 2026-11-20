"use client";

import { NeoCourtPiece } from "@/components/game/NeoCourtPiece";
import { type PalacePieceRole, palacePieceRole, palaceRoleLabel } from "@/lib/palace-piece";
import { cn } from "@/lib/utils";

type Props = {
  player: 1 | 2;
  isKing: boolean;
  className?: string;
  /** Force a role (palette picker / servant preview). */
  role?: PalacePieceRole;
  base?: string;
  shade?: string;
};

/**
 * Neo-pattern court piece (Chess.com Neo language) for the active palace role.
 */
export function PalacePieceMark({ player, isKing, className, role: roleProp, base, shade }: Props) {
  const role = roleProp ?? palacePieceRole(player, isKing);
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-[1%] flex items-center justify-center",
        className,
      )}
      aria-hidden
      title={palaceRoleLabel(role)}
    >
      <NeoCourtPiece role={role} player={player} base={base} shade={shade} />
    </span>
  );
}

export { palaceRoleLabel };
