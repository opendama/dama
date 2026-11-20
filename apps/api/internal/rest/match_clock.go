package rest

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

// matchClockSweepCursor rotates which live games the AFK sweeper touches each tick
// so flag-fall is not limited to the newest 200 forever.
var matchClockSweepCursor uint64

// clockFlagFlight serializes finishClockFlag per game (sweeper + WS + REST + move path).
var clockFlagFlight sync.Map // gameID -> *sync.Mutex

func clockFlagMutex(gameID string) *sync.Mutex {
	muI, _ := clockFlagFlight.LoadOrStore(gameID, &sync.Mutex{})
	return muI.(*sync.Mutex)
}

func clockFlagClaimKey(gameID string) string {
	return "dama:clock_flag:" + gameID
}

// stampMatchClockFromSettings arms dual clocks from platform_settings.match_clock (DB-only).
// preferredTCSeconds: invite/challenge/VS-AI preset; 0 → match_clock.initial_seconds when enabled.
func stampMatchClockFromSettings(settings *store.SettingsStore, state *engine.State, preferredTCSeconds int) {
	if settings == nil || state == nil {
		return
	}
	cfg := settings.MatchClock()
	presets := make([]int, 0, len(cfg.Presets))
	for _, p := range cfg.Presets {
		presets = append(presets, p.Seconds)
	}
	engine.ArmMatchClockFromDB(
		state,
		cfg.Source,
		cfg.Enabled,
		cfg.InitialSeconds,
		cfg.IncrementSeconds,
		preferredTCSeconds,
		presets,
	)
}

// syncMatchClock debits the active seat and persists remaining so reconnect/restart
// never rewinds to a stale Redis snapshot. Returns a finished payload when flagged.
// A paused clock is not debited. When the admin pause deadline has passed, the same
// ResumeGameCore path clears the freeze (sweeper and state reads).
func (a *API) syncMatchClock(ctx context.Context, id string, state *engine.State) (map[string]any, bool, error) {
	if state == nil || engine.GameOutcome(state) != nil {
		return nil, false, nil
	}
	now := time.Now().UnixMilli()
	if state.Paused {
		// Official pause never auto-resumes (expires must stay 0; guard if mis-set).
		if strings.TrimSpace(state.PauseKind) == engine.PauseKindOfficial {
			return nil, false, nil
		}
		if state.PauseExpiresAtUnixMs > 0 && now >= state.PauseExpiresAtUnixMs {
			if _, err := a.ResumeGameCore(context.WithValue(ctx, autoResumePauseKey{}, true), id, state.PausedByUserID); err != nil {
				return nil, false, err
			}
		}
		return nil, false, nil
	}
	if !state.ClockActive {
		return nil, false, nil
	}
	flagged, advanced := engine.DebitActiveClock(state, now)
	if flagged {
		payload, err := a.finishClockFlag(ctx, id, state)
		return payload, true, err
	}
	if advanced {
		// Concurrent official/player pause must win over this debit persist.
		_ = a.applyStorePauseOnto(id, state)
		if err := a.Store.Update(id, state); err != nil {
			return nil, false, fmt.Errorf("unable to save clock")
		}
	}
	return nil, false, nil
}

// ClaimClockFlagCore validates flag-fall for the side to move and ends the game.
// Any seated player (or the human in VS-AI) may claim; server recomputes remaining.
func (a *API) ClaimClockFlagCore(ctx context.Context, id, userID string) (map[string]any, error) {
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	if err := a.requireOTPVerified(ctx, userID); err != nil {
		return nil, err
	}
	// Prefer Redis so official pause on another replica blocks flag claims / clock debit.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok {
		return nil, fmt.Errorf("game not found")
	}
	if outcome := engine.GameOutcome(rec.State); outcome != nil {
		return a.gamePayload(id, rec.State), nil
	}
	if !rec.State.ClockActive {
		return nil, fmt.Errorf("match clock inactive")
	}
	// Claimant must be a seat (or practice P1).
	seated := false
	if rec.State.Player1ID != nil && *rec.State.Player1ID == userID {
		seated = true
	}
	if rec.State.Player2ID != nil && *rec.State.Player2ID == userID {
		seated = true
	}
	if !seated && rec.State.Mode == "ai" && (rec.State.Player1ID == nil || *rec.State.Player1ID == "") {
		uid := userID
		rec.State.Player1ID = &uid
		seated = true
	}
	if !seated {
		return nil, fmt.Errorf("not a seat in this game")
	}
	// Expired pause auto-resumes before a flag claim (parity with ApplyMoveCore / GET).
	if rec.State.Paused {
		if finished, flagged, err := a.syncMatchClock(ctx, id, rec.State); flagged {
			return finished, err
		} else if err != nil {
			return nil, err
		}
		rec, ok = a.Store.GetAuthoritative(id)
		if !ok || rec.State == nil {
			return nil, fmt.Errorf("game not found")
		}
		if rec.State.Paused {
			return nil, pausedRejectErr(rec.State)
		}
	}

	now := time.Now().UnixMilli()
	flagged, _ := engine.DebitActiveClock(rec.State, now)
	if !flagged {
		return nil, fmt.Errorf("clock still running")
	}
	return a.finishClockFlag(ctx, id, rec.State)
}

func (a *API) finishClockFlag(ctx context.Context, id string, state *engine.State) (map[string]any, error) {
	if state == nil {
		return nil, fmt.Errorf("game not found")
	}

	mu := clockFlagMutex(id)
	mu.Lock()
	defer mu.Unlock()

	// Multi-instance single-flight: only one replica applies ForcedOutcome / finalize.
	claimedRedis := false
	if a.Redis != nil && a.Redis.Ready() {
		ok, err := a.Redis.RDB.SetNX(ctx, clockFlagClaimKey(id), "1", 2*time.Minute).Result()
		if err == nil && !ok {
			for i := 0; i < 15; i++ {
				if rec, found := a.Store.GetAuthoritative(id); found && rec.State != nil && engine.GameOutcome(rec.State) != nil {
					return a.gamePayload(id, rec.State), nil
				}
				time.Sleep(20 * time.Millisecond)
			}
			if rec, found := a.Store.GetAuthoritative(id); found && rec.State != nil {
				return a.gamePayload(id, rec.State), nil
			}
			return a.gamePayload(id, state), nil
		}
		if err == nil && ok {
			claimedRedis = true
		}
	}
	success := false
	defer func() {
		if claimedRedis && !success && a.Redis != nil && a.Redis.Ready() {
			_ = a.Redis.RDB.Del(context.Background(), clockFlagClaimKey(id)).Err()
		}
	}()

	// Re-read after lock so concurrent claim/sweeper/official pause on another replica wins.
	if rec, ok := a.Store.GetAuthoritative(id); ok && rec.State != nil {
		state = rec.State
	}
	if outcome := engine.GameOutcome(state); outcome != nil {
		success = true
		return a.gamePayload(id, state), nil
	}
	// Do not wipe an official/player pause that landed between claim and finalize.
	if state.Paused {
		return nil, pausedRejectErr(state)
	}

	winner := engine.FlaggedSeatWinner(state)
	if winner != engine.PlayerOne && winner != engine.PlayerTwo {
		return nil, fmt.Errorf("invalid flag winner")
	}

	next := *state
	next.ClockActive = false
	clearPauseFields(&next)
	finalizeOutcome := winner
	if engine.InsufficientMaterialDrawOnTime(state, winner) {
		reason := "insufficient_material"
		next.Draw = true
		next.DrawReason = &reason
		next.EndReason = "clock_draw"
		next.ForcedOutcome = nil
		finalizeOutcome = engine.Draw
	} else {
		next.ForcedOutcome = &winner
		next.EndReason = "clock_flag"
	}

	// Concurrent official/player pause after re-read must win over flag persist.
	if a.applyStorePauseOnto(id, &next) {
		return nil, pausedRejectErr(&next)
	}

	if err := a.Store.Update(id, &next); err != nil {
		return nil, fmt.Errorf("unable to save flag")
	}
	success = true
	payload := a.gamePayload(id, &next)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, map[string]any{"type": "game_state", "game": payload})
	}
	a.scheduleMatchFinalize(id, &next, finalizeOutcome)
	return payload, nil
}

// ClaimClockFlag is REST POST /games/{id}/clock-flag.
func (a *API) ClaimClockFlag(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	payload, err := a.ClaimClockFlagCore(r.Context(), id, auth.UserIDFromContext(r.Context()))
	if err != nil {
		if a.writePlayPausedErr(w, r, err) {
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// StartMatchClockSweeper periodically syncs armed clocks (PvP + VS-AI via clock_active index)
// so AFK seats still flag-fall without a connected client claim (DB-driven match_clock only).
// Paused games are included so an expired pause auto-resumes on the same loop.
func (a *API) StartMatchClockSweeper() {
	if a == nil || a.Store == nil {
		return
	}
	go func() {
		t := time.NewTicker(2 * time.Second)
		defer t.Stop()
		for range t.C {
			a.sweepMatchClocks()
		}
	}()
}

func (a *API) sweepMatchClocks() {
	if a == nil || a.Store == nil {
		return
	}
	// Include VS-AI/practice armed clocks (Watch-rail live set excludes them).
	ids := a.Store.AllClockActiveIDsNewestFirst()
	n := len(ids)
	if n == 0 {
		return
	}
	const batch = 200
	start := int(atomic.AddUint64(&matchClockSweepCursor, 1)-1) % n
	ctx := context.Background()
	limit := batch
	if limit > n {
		limit = n
	}
	for i := 0; i < limit; i++ {
		id := ids[(start+i)%n]
		// Prefer Redis so an official pause on another replica is not wiped by debit+Update.
		rec, ok := a.Store.GetAuthoritative(id)
		if !ok || rec.State == nil {
			continue
		}
		if engine.GameOutcome(rec.State) != nil {
			continue
		}
		if !rec.State.ClockActive && !rec.State.Paused {
			continue
		}
		_, _, _ = a.syncMatchClock(ctx, id, rec.State)
	}
}

// E2EPeekClock returns stored clock/outcome without debit/sync (lab sweeper proof).
// Enabled solely when DAMA_ALLOW_E2E_AUTH=1 (never production).
func (a *API) E2EPeekClock(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DAMA_ALLOW_E2E_AUTH") != "1" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	id := chi.URLParam(r, "id")
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}
	rec, ok := a.Store.Get(id)
	if !ok || rec.State == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	// Intentionally no syncMatchClock - observes sweeper/claim side-effects only.
	writeJSON(w, http.StatusOK, a.gamePayload(id, rec.State))
}

// E2EBareKingsBoard clears the board to bare king vs bare king for lab clock_draw tests.
// Enabled solely when DAMA_ALLOW_E2E_AUTH=1 (never production).
func (a *API) E2EBareKingsBoard(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DAMA_ALLOW_E2E_AUTH") != "1" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	id := chi.URLParam(r, "id")
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}
	rec, ok := a.Store.Get(id)
	if !ok || rec.State == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	if engine.GameOutcome(rec.State) != nil {
		writeJSON(w, http.StatusOK, a.gamePayload(id, rec.State))
		return
	}
	var empty engine.Board
	rec.State.Board = empty
	rec.State.Board[0][1] = &engine.Piece{P: engine.PlayerOne, K: true}
	rec.State.Board[9][0] = &engine.Piece{P: engine.PlayerTwo, K: true}
	rec.State.MustContinue = nil
	if err := a.Store.Update(id, rec.State); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "unable to save board"})
		return
	}
	writeJSON(w, http.StatusOK, a.gamePayload(id, rec.State))
}

// E2EExpireActiveClock zeroes the side-to-move clock for lab flag-fall tests.
// Enabled solely when DAMA_ALLOW_E2E_AUTH=1 (never production).
func (a *API) E2EExpireActiveClock(w http.ResponseWriter, r *http.Request) {
	if os.Getenv("DAMA_ALLOW_E2E_AUTH") != "1" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	id := chi.URLParam(r, "id")
	userID := auth.UserIDFromContext(r.Context())
	if userID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "authentication required"})
		return
	}
	rec, ok := a.Store.Get(id)
	if !ok || rec.State == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "game not found"})
		return
	}
	if engine.GameOutcome(rec.State) != nil {
		writeJSON(w, http.StatusOK, a.gamePayload(id, rec.State))
		return
	}
	if !rec.State.ClockActive {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "match clock inactive"})
		return
	}
	now := time.Now().UnixMilli()
	switch rec.State.Turn {
	case engine.PlayerOne:
		rec.State.ClockP1RemainingMs = 0
	case engine.PlayerTwo:
		rec.State.ClockP2RemainingMs = 0
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid turn"})
		return
	}
	rec.State.ClockLastTickUnixMs = now
	if err := a.Store.Update(id, rec.State); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "unable to save clock"})
		return
	}
	writeJSON(w, http.StatusOK, a.gamePayload(id, rec.State))
}
