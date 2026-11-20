package rest

import (
	"context"
	"fmt"
	"log"
	"strings"

	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/store"
	"dama/apps/api/internal/ws"
)

// bracketLiveClearAudit optionally records an official-resume audit when rematch/forfeit
// clears an active official pause (dispute trail). Fail-soft: board end must not block on audit.
type bracketLiveClearAudit struct {
	Ctx              context.Context
	Store            *store.OfficialPauseStore
	ActorUserID      string
	ActorRole        string
	ActorDisplayName string
	EventID          string
	TournamentID     string
	Note             string
}

func auditOfficialClearOnBracketEnd(st *engine.State, gameID string, audit *bracketLiveClearAudit) {
	if audit == nil || audit.Store == nil || st == nil {
		return
	}
	if !st.Paused || strings.TrimSpace(st.PauseKind) != engine.PauseKindOfficial {
		return
	}
	actorID := strings.TrimSpace(audit.ActorUserID)
	role := strings.TrimSpace(audit.ActorRole)
	if actorID == "" || (role != "admin" && role != "organizer") {
		return
	}
	ctx := audit.Ctx
	if ctx == nil {
		ctx = context.Background()
	}
	note := strings.TrimSpace(audit.Note)
	ev := store.OfficialPauseEvent{
		GameID:           strings.TrimSpace(gameID),
		Action:           "resume",
		ActorUserID:      actorID,
		ActorRole:        role,
		ActorDisplayName: strings.TrimSpace(audit.ActorDisplayName),
		Note:             note,
		EventID:          strPtrOrNil(audit.EventID),
		TournamentID:     strPtrOrNil(audit.TournamentID),
	}
	if _, err := audit.Store.Insert(ctx, ev); err != nil {
		log.Printf("official pause audit on bracket clear failed game=%s: %v", gameID, err)
	}
}

// forceFinishLiveBoardAfterBracketWin ends an unfinished Redis board after bracket
// forfeit/DQ already recorded the cup result. Clears official/player pause so seats
// do not stay stuck on a paused board. Does not scheduleMatchFinalize (bracket owns awards).
func forceFinishLiveBoardAfterBracketWin(
	games *gamestore.Store,
	hub *ws.Hub,
	gameID, winnerUserID, endReason string,
	audit *bracketLiveClearAudit,
) {
	if games == nil {
		return
	}
	gid := strings.TrimSpace(gameID)
	if gid == "" {
		return
	}
	rec, ok := games.GetAuthoritative(gid)
	if !ok || rec.State == nil || engine.GameOutcome(rec.State) != nil {
		return
	}
	winnerUID := strings.TrimSpace(winnerUserID)
	winner := 0
	if winnerUID != "" {
		if rec.State.Player1ID != nil && strings.TrimSpace(*rec.State.Player1ID) == winnerUID {
			winner = engine.PlayerOne
		} else if rec.State.Player2ID != nil && strings.TrimSpace(*rec.State.Player2ID) == winnerUID {
			winner = engine.PlayerTwo
		}
	}
	// Seat mismatch or missing winner: still clear pause so rematch/forfeit cannot orphan a freeze.
	if winner != engine.PlayerOne && winner != engine.PlayerTwo {
		_ = abandonLiveBoardForRematch(games, hub, gid, audit)
		return
	}
	auditOfficialClearOnBracketEnd(rec.State, gid, audit)
	next := *rec.State
	next.ForcedOutcome = &winner
	next.MustContinue = nil
	next.ClockActive = false
	if strings.TrimSpace(endReason) == "" {
		endReason = "forfeit"
	}
	next.EndReason = endReason
	clearPauseFields(&next)
	if err := games.Update(gid, &next); err != nil {
		return
	}
	if hub != nil {
		hub.BroadcastGame(gid, map[string]any{
			"type": "game_state",
			"game": buildGamePayload(gid, &next),
		})
	}
}

// abandonLiveBoardForRematch ends an unfinished Redis board before bracket rematch
// clears game_id. Draws the board (no awards) and clears pause so seats leave the overlay.
// Returns error when a live board exists but cannot be persisted (callers must not clear game_id).
func abandonLiveBoardForRematch(
	games *gamestore.Store,
	hub *ws.Hub,
	gameID string,
	audit *bracketLiveClearAudit,
) error {
	gid := strings.TrimSpace(gameID)
	if gid == "" {
		return nil
	}
	if games == nil {
		return fmt.Errorf("unable to end live board for rematch")
	}
	rec, ok := games.GetAuthoritative(gid)
	if !ok || rec.State == nil || engine.GameOutcome(rec.State) != nil {
		return nil
	}
	auditOfficialClearOnBracketEnd(rec.State, gid, audit)
	next := *rec.State
	next.MustContinue = nil
	next.ClockActive = false
	next.ForcedOutcome = nil
	next.Draw = true
	reason := "rematch"
	next.DrawReason = &reason
	next.EndReason = "rematch"
	clearPauseFields(&next)
	if err := games.Update(gid, &next); err != nil {
		return fmt.Errorf("unable to end live board for rematch")
	}
	if hub != nil {
		hub.BroadcastGame(gid, map[string]any{
			"type": "game_state",
			"game": buildGamePayload(gid, &next),
		})
	}
	return nil
}
