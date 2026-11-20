export type BoardCell = { p: number; k: boolean } | null;

export type LegalMove = {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
  promotes: boolean;
};

export type GamePayload = {
  id: string;
  variant: string;
  size: number;
  board: BoardCell[][];
  turn: number;
  mode: string;
  must_continue: [number, number] | null;
  move_count: number;
  halfmove_clock: number;
  draw: boolean;
  draw_reason: string | null;
  legal_moves: LegalMove[];
  outcome: number | null;
  ai_player: number | null;
  ai_search_depth: number;
  paused?: boolean;
  paused_at_unix_ms?: number;
  pause_expires_at_unix_ms?: number;
  paused_by_user_id?: string | null;
  pause_remaining_ms?: number;
  pause_kind?: string;
  pause_reason_key?: string;
  pause_reason_label?: string;
  pause_note?: string;
  pause_actor_role?: string;
  pause_actor_display_name?: string;
};
