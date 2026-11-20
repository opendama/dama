export type BoardCell = { p: number; k: boolean } | null;

export type LegalMove = {
  from: [number, number];
  to: [number, number];
  captures: [number, number][];
  promotes: boolean;
};

export type MoveHistoryEntry = {
  from: [number, number];
  to: [number, number];
  captures?: [number, number][];
  promotes?: boolean;
  player?: number;
  board_after?: BoardCell[][];
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
  move_history?: MoveHistoryEntry[];
  outcome: number | null;
  ai_player: number | null;
  ai_search_depth: number;
  player1_id?: string | null;
  player2_id?: string | null;
  /** Per-game TC seconds (invite preset or platform initial); observing strip label. */
  time_control_seconds?: number;
  rated?: boolean;
  /** Set when ForcedOutcome applied (e.g. "clock_flag"). */
  end_reason?: string;
  /** Authoritative dual clock (server). Clients interpolate between syncs. */
  clock_active?: boolean;
  clock_increment_seconds?: number;
  clock_p1_remaining_ms?: number;
  clock_p2_remaining_ms?: number;
  clock_server_now_ms?: number;
  clock_last_tick_unix_ms?: number;
  /** Server froze the clock and blocked moves. */
  paused?: boolean;
  paused_at_unix_ms?: number;
  pause_expires_at_unix_ms?: number;
  paused_by_user_id?: string;
  pause_remaining_ms?: number;
  /** "player" (seat, timed) or "official" (organizer/admin, manual resume). */
  pause_kind?: "player" | "official" | string;
  pause_reason_key?: string;
  pause_reason_label?: string;
  pause_note?: string;
  /** admin | organizer | player */
  pause_actor_role?: "admin" | "organizer" | "player" | string;
  pause_actor_display_name?: string;
};

export type StartGameInput = {
  mode: "ai" | "pvp";
  ai_search_depth?: number;
  /** Required for mode=ai - must match platform match_clock.presets (Challenge parity). */
  time_control_seconds?: number;
};

export type BoardRulesConfig = {
  size: number;
  pieces_per_side: number;
  setup_rows: number;
  variant: string;
};

/** CSS token snapshot for the WebGL board (hydrated from --dama-* vars). */
export type BoardPalette = {
  light: string;
  dark: string;
  frame: string;
  pieceLight: string;
  pieceDark: string;
  highlight: string;
  king?: string;
};

/** Raw Go WebSocket game/spectate envelope (not GraphQL). */
export type GameWsMessage = {
  /** Pause reject keys from WS (`err_game_paused` / `err_officially_paused`). */
  error_key?: string;
  type?: string;
  room?: string;
  game_id?: string;
  game?: GamePayload;
  error?: string;
  flags?: { vs_ai_enabled?: boolean };
  [k: string]: unknown;
};
