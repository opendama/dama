package rest

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"

	"github.com/go-chi/chi/v5"
)

// autoResumePauseKey marks a sweeper/sync resume that skips seat and OTP checks.
// The pause itself was already authorized; expiry is server-authoritative.
type autoResumePauseKey struct{}

func pauseRemainingMs(state *engine.State, nowMs int64) int64 {
	if state == nil || !state.Paused || state.PauseExpiresAtUnixMs <= nowMs {
		return 0
	}
	return state.PauseExpiresAtUnixMs - nowMs
}

// pausedRejectErr distinguishes official vs player pause for REST/WS mapping.
func pausedRejectErr(state *engine.State) error {
	if state != nil && state.Paused &&
		strings.TrimSpace(state.PauseKind) == engine.PauseKindOfficial {
		return fmt.Errorf("officially paused")
	}
	return fmt.Errorf("game is paused")
}

// writePlayPausedErr maps pause reject sentinels to DB play_chrome + error_key.
// Returns true when the response was written.
func (a *API) writePlayPausedErr(w http.ResponseWriter, r *http.Request, err error) bool {
	if err == nil {
		return false
	}
	// OTP: prefer otp_chrome + error_key (middleware parity; Core may also gate).
	if errors.Is(err, errOTPUnauthorized) {
		writeOTPChromeError(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return true
	}
	if errors.Is(err, errOTPVerificationUnavailable) {
		writeOTPChromeError(w, a.Settings, http.StatusServiceUnavailable, "err_verification_unavailable")
		return true
	}
	if errors.Is(err, errOTPVerificationRequired) {
		writeOTPChromeError(w, a.Settings, http.StatusForbidden, "err_verification_required")
		return true
	}
	msg := err.Error()
	key := ""
	status := http.StatusConflict
	switch msg {
	case "officially paused":
		key = "err_officially_paused"
	case "game is paused":
		key = "err_game_paused"
	case "pause disabled":
		key = "err_pause_disabled"
	case "not a seat in this game":
		key = "not_a_seat"
		status = http.StatusBadRequest
	case "game already finished":
		key = "game_finished"
		status = http.StatusBadRequest
	case "authentication required":
		key = "unauthorized"
		status = http.StatusUnauthorized
	default:
		return false
	}
	chromeMsg := ""
	if a.Settings != nil {
		chromeMsg = strings.TrimSpace(a.Settings.PlayChromeField(r.Context(), key))
	}
	// Fail closed: never invent English; clients map error_key when chrome is empty.
	writeJSON(w, status, map[string]string{
		"error": chromeMsg, "error_key": key,
	})
	return true
}

// clearPauseFields drops pause markers on a finished or resumed board.
func clearPauseFields(state *engine.State) {
	if state == nil {
		return
	}
	state.Paused = false
	state.PausedAtUnixMs = 0
	state.PauseExpiresAtUnixMs = 0
	state.PausedByUserID = ""
	state.PauseKind = ""
	state.PauseReasonKey = ""
	state.PauseReasonLabel = ""
	state.PauseNote = ""
	state.PauseActorRole = ""
	state.PauseActorDisplayName = ""
}

// applyStorePauseOnto copies a concurrent pause onto an in-flight move clone
// so Store.Update cannot wipe an already-persisted pause (VS-AI reply race).
// Uses Redis-authoritative state when available and copies the frozen clock so
// the in-flight clone cannot persist further debit under an active pause.
func (a *API) applyStorePauseOnto(id string, dst *engine.State) bool {
	if a == nil || a.Store == nil || dst == nil {
		return false
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil || !rec.State.Paused {
		return false
	}
	src := rec.State
	dst.Paused = true
	dst.PausedAtUnixMs = src.PausedAtUnixMs
	dst.PauseExpiresAtUnixMs = src.PauseExpiresAtUnixMs
	dst.PausedByUserID = src.PausedByUserID
	dst.PauseKind = src.PauseKind
	dst.PauseReasonKey = src.PauseReasonKey
	dst.PauseReasonLabel = src.PauseReasonLabel
	dst.PauseNote = src.PauseNote
	dst.PauseActorRole = src.PauseActorRole
	dst.PauseActorDisplayName = src.PauseActorDisplayName
	dst.ClockActive = src.ClockActive
	dst.ClockP1RemainingMs = src.ClockP1RemainingMs
	dst.ClockP2RemainingMs = src.ClockP2RemainingMs
	dst.ClockLastTickUnixMs = src.ClockLastTickUnixMs
	return true
}

// commitPauseFieldsOntoLatest rebases pause metadata onto the latest board so a
// concurrent move Persist cannot be rolled back by a stale pause/resume Update.
// When freezing (desired.Paused), clocks are re-debited on the fresh board at nowMs.
// When clearing, ClockLastTickUnixMs is set to nowMs so pause time is not charged.
// clearOfficialOK is true only for official resume (ops may clear any pause kind).
func (a *API) commitPauseFieldsOntoLatest(
	id string, desired pauseFieldsSnapshot, nowMs int64, clearOfficialOK bool,
) (*engine.State, error) {
	if a == nil || a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	st := rec.State
	if engine.GameOutcome(st) != nil {
		return nil, fmt.Errorf("game already finished")
	}
	freshKind := strings.TrimSpace(st.PauseKind)
	desiredKind := strings.TrimSpace(desired.PauseKind)
	// Do not let a player pause overwrite an active official pause that landed first.
	if desired.Paused &&
		desiredKind != engine.PauseKindOfficial &&
		st.Paused && freshKind == engine.PauseKindOfficial {
		return nil, fmt.Errorf("officially paused")
	}
	// Seat resume must never clear an official pause that landed after the caller's check.
	if !desired.Paused && st.Paused && freshKind == engine.PauseKindOfficial && !clearOfficialOK {
		return nil, fmt.Errorf("officially paused")
	}
	// Same-kind pause already present: return current board (idempotent).
	if desired.Paused && st.Paused && freshKind == desiredKind {
		return st, nil
	}
	// Already clear while resume requested: no-op (do not rewrite clock tick).
	if !desired.Paused && !st.Paused {
		return st, nil
	}
	if desired.Paused {
		// Debit before arming Paused; DebitActiveClock is a no-op while frozen.
		if st.ClockActive && !st.Paused {
			flagged, _ := engine.DebitActiveClock(st, nowMs)
			if flagged {
				return st, errPauseClockFlagged
			}
		}
		restorePauseFields(st, desired)
	} else {
		restorePauseFields(st, desired)
		st.ClockLastTickUnixMs = nowMs
	}
	if err := a.Store.Update(id, st); err != nil {
		return nil, err
	}
	return st, nil
}

// errPauseClockFlagged signals commitPauseFieldsOntoLatest hit a flag while freezing.
var errPauseClockFlagged = fmt.Errorf("pause_clock_flagged")

func isAutoResume(ctx context.Context) bool {
	if ctx == nil {
		return false
	}
	v, _ := ctx.Value(autoResumePauseKey{}).(bool)
	return v
}

// PauseGame is REST POST /api/v1/games/{id}/pause.
func (a *API) PauseGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	payload, err := a.PauseGameCore(r.Context(), id, auth.UserIDFromContext(r.Context()))
	if err != nil {
		if a.writePlayPausedErr(w, r, err) {
			return
		}
		// Fail closed: never ship sentinel English; clients use toast_* chrome.
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "", "error_key": ""})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// ResumeGame is REST POST /api/v1/games/{id}/resume.
func (a *API) ResumeGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	payload, err := a.ResumeGameCore(r.Context(), id, auth.UserIDFromContext(r.Context()))
	if err != nil {
		if a.writePlayPausedErr(w, r, err) {
			return
		}
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "", "error_key": ""})
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// PauseGameCore freezes the match clock and blocks later moves.
// Already-paused games return the current payload without debiting again or extending the deadline.
func (a *API) PauseGameCore(ctx context.Context, id, userID string) (map[string]any, error) {
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	// Return OTP sentinels (not mapped chrome text) so writePlayPausedErr can emit error_key.
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	if a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	// Redis-first so a pause written on another replica is not missed or double-debited.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	if err := seatMayPause(rec.State, userID); err != nil {
		return nil, err
	}
	if rec.State.Paused {
		if rec.State.PauseKind == engine.PauseKindOfficial {
			return nil, fmt.Errorf("officially paused")
		}
		now := time.Now().UnixMilli()
		if rec.State.PauseExpiresAtUnixMs > 0 && now >= rec.State.PauseExpiresAtUnixMs {
			return a.ResumeGameCore(context.WithValue(ctx, autoResumePauseKey{}, true), id, rec.State.PausedByUserID)
		}
		bindPracticeSeat(rec.State, userID)
		return a.gamePayload(id, rec.State), nil
	}
	if engine.GameOutcome(rec.State) != nil {
		return nil, fmt.Errorf("game already finished")
	}
	durationSec, err := a.pauseDurationSeconds()
	if err != nil {
		return nil, err
	}
	bindPracticeSeat(rec.State, userID)

	now := time.Now().UnixMilli()
	actorName := a.usernameOrEmpty(ctx, userID)
	desired := pauseFieldsSnapshot{
		Paused:                true,
		PausedAtUnixMs:        now,
		PauseExpiresAtUnixMs:  now + int64(durationSec)*1000,
		PausedByUserID:        userID,
		PauseKind:             engine.PauseKindPlayer,
		PauseActorRole:        engine.PauseActorPlayer,
		PauseActorDisplayName: actorName,
	}
	st, err := a.commitPauseFieldsOntoLatest(id, desired, now, false)
	if err != nil {
		if err == errPauseClockFlagged {
			return a.finishClockFlag(ctx, id, st)
		}
		if strings.Contains(err.Error(), "officially paused") {
			return nil, err
		}
		if strings.Contains(err.Error(), "already finished") {
			return nil, err
		}
		return nil, fmt.Errorf("unable to pause game")
	}
	payload := a.gamePayload(id, st)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, a.pauseWSEnvelope(
			"match.paused", "player", payload,
			engine.PauseActorPlayer, actorName, "", "", "",
		))
	}
	return payload, nil
}

// ResumeGameCore clears a pause and restarts the clock tick at now so pause time is not charged.
// A game that is not paused returns the current payload.
// Sweeper auto-resume calls this with autoResumePauseKey set.
func (a *API) ResumeGameCore(ctx context.Context, id, userID string) (map[string]any, error) {
	auto := isAutoResume(ctx)
	if !auto {
		if userID == "" {
			return nil, fmt.Errorf("authentication required")
		}
		if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
			return nil, err
		}
	}
	if a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	if !auto {
		if err := seatMayPause(rec.State, userID); err != nil {
			return nil, err
		}
	}
	if !rec.State.Paused {
		return a.gamePayload(id, rec.State), nil
	}
	// Official pause is manual-resume only (never sweeper/auto, never seat resume).
	if strings.TrimSpace(rec.State.PauseKind) == engine.PauseKindOfficial {
		if auto {
			return a.gamePayload(id, rec.State), nil
		}
		return nil, fmt.Errorf("officially paused")
	}
	if !auto {
		bindPracticeSeat(rec.State, userID)
	}
	prevRole := strings.TrimSpace(rec.State.PauseActorRole)
	prevName := strings.TrimSpace(rec.State.PauseActorDisplayName)
	prevKind := strings.TrimSpace(rec.State.PauseKind)
	actorRole := prevRole
	actorName := prevName
	if !auto {
		actorRole = engine.PauseActorPlayer
		actorName = a.usernameOrEmpty(ctx, userID)
	}
	now := time.Now().UnixMilli()
	st, err := a.commitPauseFieldsOntoLatest(id, pauseFieldsSnapshot{}, now, false)
	if err != nil {
		if strings.Contains(err.Error(), "already finished") ||
			strings.Contains(err.Error(), "officially paused") {
			return nil, err
		}
		return nil, fmt.Errorf("unable to resume game")
	}
	payload := a.gamePayload(id, st)
	if a.Hub != nil {
		src := "player"
		if auto {
			src = "auto"
		}
		env := a.pauseWSEnvelope("match.resumed", src, payload, actorRole, actorName, "", "", "")
		if prevKind != "" {
			env["pause_kind"] = prevKind
		}
		a.Hub.BroadcastGame(id, env)
	}
	return payload, nil
}

func (a *API) pauseDurationSeconds() (int, error) {
	if a == nil || a.Settings == nil {
		return 0, fmt.Errorf("pause disabled")
	}
	clock := a.Settings.MatchClock()
	if !clock.PauseEnabled || clock.PauseDurationSeconds <= 0 {
		return 0, fmt.Errorf("pause disabled")
	}
	return clock.PauseDurationSeconds, nil
}

// seatMayPause allows either seated player, or the human in an unbound VS-AI practice game.
func seatMayPause(state *engine.State, userID string) error {
	if state == nil {
		return fmt.Errorf("game not found")
	}
	if state.Player1ID != nil && *state.Player1ID == userID {
		return nil
	}
	if state.Player2ID != nil && *state.Player2ID == userID {
		return nil
	}
	if state.Mode == "ai" && (state.Player1ID == nil || *state.Player1ID == "") {
		return nil
	}
	return fmt.Errorf("not a seat in this game")
}

func bindPracticeSeat(state *engine.State, userID string) {
	if state == nil || userID == "" {
		return
	}
	if state.Mode != "ai" || (state.Player1ID != nil && *state.Player1ID != "") {
		return
	}
	uid := userID
	state.Player1ID = &uid
}
