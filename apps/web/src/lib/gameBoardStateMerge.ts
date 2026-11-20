import { withResolvedOutcome } from "@/lib/gameOutcome";
import type { GamePayload, MoveHistoryEntry } from "@/types/game";

function plyCount(state: GamePayload | null | undefined): number {
  if (!state) return 0;
  return state.move_count ?? state.move_history?.length ?? 0;
}

function mergeMoveHistorySnapshots(
  previous: MoveHistoryEntry[] | undefined,
  incoming: MoveHistoryEntry[] | undefined,
): MoveHistoryEntry[] | undefined {
  if (!incoming?.length) return incoming;
  const prior = previous ?? [];
  return incoming.map((entry, index) => {
    if (entry.board_after?.length) return entry;
    const localSnapshot = prior[index]?.board_after;
    if (!localSnapshot?.length) return entry;
    return { ...entry, board_after: localSnapshot };
  });
}

/** Authoritative pause fields from WS/GET (official pause is often same-ply). */
function mergePauseFieldsFromIncoming(
  previous: GamePayload,
  incoming: GamePayload,
): Pick<
  GamePayload,
  | "paused"
  | "paused_at_unix_ms"
  | "pause_expires_at_unix_ms"
  | "paused_by_user_id"
  | "pause_remaining_ms"
  | "pause_kind"
  | "pause_reason_key"
  | "pause_reason_label"
  | "pause_note"
  | "pause_actor_role"
  | "pause_actor_display_name"
> {
  return {
    paused: incoming.paused,
    paused_at_unix_ms: incoming.paused_at_unix_ms,
    pause_expires_at_unix_ms: incoming.pause_expires_at_unix_ms,
    paused_by_user_id: incoming.paused_by_user_id,
    pause_remaining_ms: incoming.pause_remaining_ms,
    pause_kind: incoming.pause_kind,
    pause_reason_key: incoming.pause_reason_key,
    pause_reason_label: incoming.pause_reason_label,
    pause_note: incoming.pause_note,
    pause_actor_role: incoming.pause_actor_role,
    pause_actor_display_name: incoming.pause_actor_display_name,
  };
}

/** After local submit: keep pre-animation board; animate from move_history. */
export function mergeBoardStateAfterPlayerMove(
  previous: GamePayload | null | undefined,
  incoming: GamePayload,
): GamePayload {
  if (!previous) return withResolvedOutcome(incoming);

  const previousPly = plyCount(previous);
  const incomingPly = plyCount(incoming);
  if (incomingPly < previousPly) {
    // Keep newer local ply, but never drop a terminal outcome from the server.
    if (incoming.outcome != null || incoming.draw) {
      return withResolvedOutcome({
        ...previous,
        outcome: incoming.outcome ?? previous.outcome,
        draw: incoming.draw || previous.draw,
        draw_reason: incoming.draw_reason ?? previous.draw_reason,
        end_reason: incoming.end_reason ?? previous.end_reason,
        clock_active: incoming.clock_active ?? previous.clock_active,
        clock_p1_remaining_ms: incoming.clock_p1_remaining_ms ?? previous.clock_p1_remaining_ms,
        clock_p2_remaining_ms: incoming.clock_p2_remaining_ms ?? previous.clock_p2_remaining_ms,
        clock_server_now_ms: incoming.clock_server_now_ms ?? previous.clock_server_now_ms,
        ...mergePauseFieldsFromIncoming(previous, incoming),
      });
    }
    return withResolvedOutcome({
      ...previous,
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  if (incomingPly === previousPly && previousPly > 0) {
    return withResolvedOutcome({
      ...incoming,
      board: previous.board,
      move_history: mergeMoveHistorySnapshots(previous.move_history, incoming.move_history),
      // Prefer server terminal flags; keep optimistic wipe if server omitted briefly.
      outcome: incoming.outcome ?? previous.outcome,
      draw: incoming.draw || previous.draw,
      // Never drop clock_flag / clock_draw framing across same-ply merges.
      draw_reason: incoming.draw_reason ?? previous.draw_reason,
      end_reason: incoming.end_reason ?? previous.end_reason,
      // Explicit pause metadata (official pause is often same-ply).
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  if (incomingPly > previousPly) {
    return withResolvedOutcome({
      ...incoming,
      board: previous.board,
      move_history: mergeMoveHistorySnapshots(previous.move_history, incoming.move_history),
      end_reason: incoming.end_reason ?? previous.end_reason,
      draw_reason: incoming.draw_reason ?? previous.draw_reason,
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  return withResolvedOutcome(incoming);
}

/** Remote/WS merge: freeze board while history grows so opponent plies animate. */
export function mergeRemoteBoardState(
  previous: GamePayload | null | undefined,
  incoming: GamePayload,
): GamePayload {
  if (!previous) return withResolvedOutcome(incoming);

  const previousPly = plyCount(previous);
  const incomingPly = plyCount(incoming);
  if (incomingPly < previousPly) {
    if (incoming.outcome != null || incoming.draw) {
      return withResolvedOutcome({
        ...previous,
        outcome: incoming.outcome ?? previous.outcome,
        draw: incoming.draw || previous.draw,
        draw_reason: incoming.draw_reason ?? previous.draw_reason,
        end_reason: incoming.end_reason ?? previous.end_reason,
        clock_active: incoming.clock_active ?? previous.clock_active,
        clock_p1_remaining_ms: incoming.clock_p1_remaining_ms ?? previous.clock_p1_remaining_ms,
        clock_p2_remaining_ms: incoming.clock_p2_remaining_ms ?? previous.clock_p2_remaining_ms,
        clock_server_now_ms: incoming.clock_server_now_ms ?? previous.clock_server_now_ms,
        ...mergePauseFieldsFromIncoming(previous, incoming),
      });
    }
    // Keep newer local ply, but still adopt authoritative pause metadata (official is often same board).
    return withResolvedOutcome({
      ...previous,
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  const samePly = incomingPly === previousPly;
  const sameTurn = previous.turn === incoming.turn;
  const sameOutcome = previous.outcome === incoming.outcome;
  const sameDraw = Boolean(previous.draw) === Boolean(incoming.draw);

  if (samePly && sameTurn && sameOutcome && sameDraw) {
    return withResolvedOutcome({
      ...previous,
      legal_moves: incoming.legal_moves ?? previous.legal_moves,
      must_continue: incoming.must_continue ?? previous.must_continue,
      // Later WS tick may add end_reason after outcome; never drop on-time framing.
      end_reason: incoming.end_reason ?? previous.end_reason,
      draw_reason: incoming.draw_reason ?? previous.draw_reason,
      clock_active: incoming.clock_active ?? previous.clock_active,
      clock_p1_remaining_ms: incoming.clock_p1_remaining_ms ?? previous.clock_p1_remaining_ms,
      clock_p2_remaining_ms: incoming.clock_p2_remaining_ms ?? previous.clock_p2_remaining_ms,
      clock_server_now_ms: incoming.clock_server_now_ms ?? previous.clock_server_now_ms,
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  if (incomingPly > previousPly) {
    return withResolvedOutcome({
      ...incoming,
      board: previous.board,
      move_history: mergeMoveHistorySnapshots(previous.move_history, incoming.move_history),
      end_reason: incoming.end_reason ?? previous.end_reason,
      draw_reason: incoming.draw_reason ?? previous.draw_reason,
      ...mergePauseFieldsFromIncoming(previous, incoming),
    });
  }

  return withResolvedOutcome({
    ...incoming,
    end_reason: incoming.end_reason ?? previous.end_reason,
    draw_reason: incoming.draw_reason ?? previous.draw_reason,
    ...mergePauseFieldsFromIncoming(previous, incoming),
  });
}
