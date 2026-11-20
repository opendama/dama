package rest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

const officialPauseNoteMaxRunes = 280

type officialPauseReason struct {
	Key   string `json:"key"`
	Label string `json:"label"`
}

// OfficialPauseGame is REST POST /api/v1/games/{id}/official-pause.
func (a *API) OfficialPauseGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		ReasonKey string `json:"reason_key"`
		Note      string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	payload, err := a.OfficialPauseGameCore(
		r.Context(), id, auth.UserIDFromContext(r.Context()),
		strings.TrimSpace(body.ReasonKey), strings.TrimSpace(body.Note),
	)
	if err != nil {
		a.writeOfficialPauseHTTPErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// OfficialResumeGame is REST POST /api/v1/games/{id}/official-resume.
func (a *API) OfficialResumeGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Note string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	payload, err := a.OfficialResumeGameCore(
		r.Context(), id, auth.UserIDFromContext(r.Context()),
		strings.TrimSpace(body.Note),
	)
	if err != nil {
		a.writeOfficialPauseHTTPErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// OfficialPauseMetaGame is REST POST /api/v1/games/{id}/official-pause-meta.
func (a *API) OfficialPauseMetaGame(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		ReasonKey string  `json:"reason_key"`
		Note      *string `json:"note"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	var notePtr *string
	if body.Note != nil {
		n := strings.TrimSpace(*body.Note)
		notePtr = &n
	}
	payload, err := a.OfficialPauseMetaGameCore(
		r.Context(), id, auth.UserIDFromContext(r.Context()),
		strings.TrimSpace(body.ReasonKey), notePtr,
	)
	if err != nil {
		a.writeOfficialPauseHTTPErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// ListOfficialPauseEvents is REST GET /api/v1/games/{id}/official-pause-events.
// Works for live Redis boards and finished/evicted boards (DB audit trail).
func (a *API) ListOfficialPauseEvents(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_forbidden"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	var state *engine.State
	if a.Store != nil {
		if rec, ok := a.Store.GetAuthoritative(id); ok && rec.State != nil {
			state = rec.State
		}
	}
	if state != nil {
		if err := a.requireOfficialPauseViewer(r.Context(), userID, id, state); err != nil {
			status, msg, key := a.mapOfficialPauseErr(r.Context(), err)
			writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
			return
		}
	} else if !a.userMayViewOfficialPauseHistory(r.Context(), userID, id) {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_forbidden"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	if a.OfficialPause == nil {
		writeJSON(w, http.StatusOK, map[string]any{"events": []any{}})
		return
	}
	events, err := a.OfficialPause.ListByGame(r.Context(), id, 50)
	if err != nil {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_list_failed"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events})
}

// userMayViewOfficialPauseHistory allows operators or former seats (match_history).
func (a *API) userMayViewOfficialPauseHistory(ctx context.Context, userID, gameID string) bool {
	if _, err := a.resolveOfficialPauseAuthz(ctx, userID, gameID); err == nil {
		return true
	}
	if a.Matches == nil {
		return false
	}
	mh, err := a.Matches.ByGameID(ctx, gameID)
	if err != nil || mh == nil {
		return false
	}
	uid := strings.TrimSpace(userID)
	return uid != "" && (strings.TrimSpace(mh.Player1ID) == uid || strings.TrimSpace(mh.Player2ID) == uid)
}

type officialPauseAuthz struct {
	Role         string
	EventID      string
	TournamentID string
	DisplayName  string
}

// OfficialPauseGameCore freezes a board as an official (no auto-resume).
func (a *API) OfficialPauseGameCore(
	ctx context.Context, id, userID, reasonKey, note string,
) (map[string]any, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	// Return OTP sentinels so writeOfficialPauseHTTPErr can emit error_key (player pause parity).
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	if utf8.RuneCountInString(note) > officialPauseNoteMaxRunes {
		return nil, errOfficialPause("err_note_too_long")
	}
	reasonKey = strings.TrimSpace(reasonKey)
	if reasonKey == "" {
		return nil, errOfficialPause("err_reason_required")
	}
	reasonLabel, ok := a.officialPauseReasonLabel(reasonKey)
	if !ok {
		return nil, errOfficialPause("err_reason_invalid")
	}
	if a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	if engine.GameOutcome(rec.State) != nil {
		return nil, errOfficialPause("err_game_finished")
	}
	authz, err := a.resolveOfficialPauseAuthz(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if rec.State.Paused && rec.State.PauseKind == engine.PauseKindOfficial {
		// Idempotent: heal missing audit after compensate failure, then return payload.
		if err := a.healOfficialPauseAuditIfMissing(ctx, id, userID, authz, rec.State, "pause", note); err != nil {
			return nil, err
		}
		return a.gamePayload(id, rec.State), nil
	}

	now := time.Now().UnixMilli()
	if a.OfficialPause == nil {
		return nil, errOfficialPause("err_audit_failed")
	}
	prev := snapshotPauseFields(rec.State)
	desired := pauseFieldsSnapshot{
		Paused:                true,
		PausedAtUnixMs:        now,
		PauseExpiresAtUnixMs:  0, // manual official resume only
		PausedByUserID:        userID,
		PauseKind:             engine.PauseKindOfficial,
		PauseReasonKey:        reasonKey,
		PauseReasonLabel:      reasonLabel,
		PauseNote:             note,
		PauseActorRole:        authz.Role,
		PauseActorDisplayName: authz.DisplayName,
	}
	st, err := a.commitPauseFieldsOntoLatest(id, desired, now, false)
	if err != nil {
		if err == errPauseClockFlagged {
			return a.finishClockFlag(ctx, id, st)
		}
		if strings.Contains(err.Error(), "already finished") {
			return nil, errOfficialPause("err_game_finished")
		}
		return nil, errOfficialPause("err_update_failed")
	}
	if err := a.recordOfficialPauseEvent(ctx, store.OfficialPauseEvent{
		GameID:           id,
		Action:           "pause",
		ActorUserID:      userID,
		ActorRole:        authz.Role,
		ActorDisplayName: authz.DisplayName,
		ReasonKey:        reasonKey,
		ReasonLabel:      reasonLabel,
		Note:             note,
		EventID:          strPtrOrNil(authz.EventID),
		TournamentID:     strPtrOrNil(authz.TournamentID),
	}); err != nil {
		log.Printf("official pause audit failed game=%s action=pause: %v", id, err)
		tick := int64(0)
		if st != nil {
			tick = st.ClockLastTickUnixMs
		}
		if uerr := a.restorePauseSnapshotOntoLatest(id, prev, tick); uerr != nil {
			log.Printf("official pause compensate failed game=%s action=pause: %v", id, uerr)
		}
		return nil, errOfficialPause("err_audit_failed")
	}
	a.notifyOfficialPauseSeats(ctx, id, st, true, authz.DisplayName, reasonLabel, st.PausedAtUnixMs)
	payload := a.gamePayload(id, st)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, a.pauseWSEnvelope("match.paused", "official", payload, authz.Role, authz.DisplayName, reasonKey, reasonLabel, note))
	}
	return payload, nil
}

// OfficialPauseMetaGameCore updates reason/note on an active official pause (ops clarification).
// note == nil keeps the existing pause note (omit in JSON); non-nil replaces (empty clears).
func (a *API) OfficialPauseMetaGameCore(
	ctx context.Context, id, userID, reasonKey string, note *string,
) (map[string]any, error) {
	userID = strings.TrimSpace(userID)
	reasonKey = strings.TrimSpace(reasonKey)
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	if reasonKey == "" {
		return nil, errOfficialPause("err_reason_required")
	}
	reasonLabel, ok := a.officialPauseReasonLabel(reasonKey)
	if !ok {
		return nil, errOfficialPause("err_reason_invalid")
	}
	noteVal := ""
	if note != nil {
		noteVal = strings.TrimSpace(*note)
		if utf8.RuneCountInString(noteVal) > officialPauseNoteMaxRunes {
			return nil, errOfficialPause("err_note_too_long")
		}
	}
	if a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	authz, err := a.resolveOfficialPauseAuthz(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if !rec.State.Paused || rec.State.PauseKind != engine.PauseKindOfficial {
		return nil, errOfficialPause("err_meta_not_paused")
	}
	if a.OfficialPause == nil {
		return nil, errOfficialPause("err_audit_failed")
	}
	prev := snapshotPauseFields(rec.State)
	desired := prev
	desired.PauseReasonKey = reasonKey
	desired.PauseReasonLabel = reasonLabel
	if note != nil {
		desired.PauseNote = noteVal
	}
	desired.PauseActorRole = authz.Role
	desired.PauseActorDisplayName = authz.DisplayName
	auditNote := strings.TrimSpace(desired.PauseNote)
	st, err := a.commitOfficialMetaOntoLatest(id, desired)
	if err != nil {
		return nil, err
	}
	if err := a.recordOfficialPauseEvent(ctx, store.OfficialPauseEvent{
		GameID:           id,
		Action:           "meta",
		ActorUserID:      userID,
		ActorRole:        authz.Role,
		ActorDisplayName: authz.DisplayName,
		ReasonKey:        reasonKey,
		ReasonLabel:      reasonLabel,
		Note:             auditNote,
		EventID:          strPtrOrNil(authz.EventID),
		TournamentID:     strPtrOrNil(authz.TournamentID),
	}); err != nil {
		log.Printf("official pause audit failed game=%s action=meta: %v", id, err)
		if _, uerr := a.commitOfficialMetaOntoLatest(id, prev); uerr != nil {
			log.Printf("official pause compensate failed game=%s action=meta: %v", id, uerr)
		}
		return nil, errOfficialPause("err_audit_failed")
	}
	payload := a.gamePayload(id, st)
	if a.Hub != nil {
		a.Hub.BroadcastGame(id, a.pauseWSEnvelope("match.pause_meta", "official", payload, authz.Role, authz.DisplayName, reasonKey, reasonLabel, auditNote))
	}
	return payload, nil
}

// OfficialResumeGameCore clears an official pause (players cannot).
func (a *API) OfficialResumeGameCore(
	ctx context.Context, id, userID, note string,
) (map[string]any, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, fmt.Errorf("authentication required")
	}
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	if utf8.RuneCountInString(note) > officialPauseNoteMaxRunes {
		return nil, errOfficialPause("err_note_too_long")
	}
	if a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	authz, err := a.resolveOfficialPauseAuthz(ctx, userID, id)
	if err != nil {
		return nil, err
	}
	if !rec.State.Paused {
		if err := a.healOfficialPauseAuditIfMissing(ctx, id, userID, authz, rec.State, "resume", note); err != nil {
			return nil, err
		}
		return a.gamePayload(id, rec.State), nil
	}
	// Official may clear player pause or official pause (ops recovery). Audit either way.

	if a.OfficialPause == nil {
		return nil, errOfficialPause("err_audit_failed")
	}
	now := time.Now().UnixMilli()
	prevKind := strings.TrimSpace(rec.State.PauseKind)
	prev := snapshotPauseFields(rec.State)
	prevClockTick := rec.State.ClockLastTickUnixMs
	st, err := a.commitPauseFieldsOntoLatest(id, pauseFieldsSnapshot{}, now, true)
	if err != nil {
		if strings.Contains(err.Error(), "already finished") {
			return nil, errOfficialPause("err_game_finished")
		}
		return nil, errOfficialPause("err_update_failed")
	}
	if err := a.recordOfficialPauseEvent(ctx, store.OfficialPauseEvent{
		GameID:           id,
		Action:           "resume",
		ActorUserID:      userID,
		ActorRole:        authz.Role,
		ActorDisplayName: authz.DisplayName,
		Note:             note,
		EventID:          strPtrOrNil(authz.EventID),
		TournamentID:     strPtrOrNil(authz.TournamentID),
	}); err != nil {
		log.Printf("official pause audit failed game=%s action=resume: %v", id, err)
		if uerr := a.restorePauseSnapshotOntoLatest(id, prev, prevClockTick); uerr != nil {
			log.Printf("official pause compensate failed game=%s action=resume: %v", id, uerr)
		}
		return nil, errOfficialPause("err_audit_failed")
	}
	a.notifyOfficialPauseSeats(ctx, id, st, false, authz.DisplayName, "", prev.PausedAtUnixMs)
	payload := a.gamePayload(id, st)
	if a.Hub != nil {
		env := a.pauseWSEnvelope("match.resumed", "official", payload, authz.Role, authz.DisplayName, "", "", note)
		if prevKind != "" {
			env["pause_kind"] = prevKind
		}
		a.Hub.BroadcastGame(id, env)
	}
	return payload, nil
}

// commitOfficialMetaOntoLatest overlays reason/note/actor onto the latest board
// without re-debiting clocks (meta must not move the freeze).
func (a *API) commitOfficialMetaOntoLatest(id string, desired pauseFieldsSnapshot) (*engine.State, error) {
	if a == nil || a.Store == nil {
		return nil, fmt.Errorf("game not found")
	}
	// First look: reject when not officially paused.
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	if !rec.State.Paused || strings.TrimSpace(rec.State.PauseKind) != engine.PauseKindOfficial {
		return nil, errOfficialPause("err_meta_not_paused")
	}
	// Re-read immediately before persist so a concurrent move is not rolled back.
	fresh, ok := a.Store.GetAuthoritative(id)
	if !ok || fresh.State == nil {
		return nil, fmt.Errorf("game not found")
	}
	st := fresh.State
	if !st.Paused || strings.TrimSpace(st.PauseKind) != engine.PauseKindOfficial {
		return nil, errOfficialPause("err_meta_not_paused")
	}
	restorePauseFields(st, desired)
	if err := a.Store.Update(id, st); err != nil {
		return nil, errOfficialPause("err_update_failed")
	}
	return st, nil
}

// restorePauseSnapshotOntoLatest re-applies a pause snapshot after a failed audit write.
func (a *API) restorePauseSnapshotOntoLatest(id string, snap pauseFieldsSnapshot, clockTick int64) error {
	if a == nil || a.Store == nil {
		return fmt.Errorf("game not found")
	}
	rec, ok := a.Store.GetAuthoritative(id)
	if !ok || rec.State == nil {
		return fmt.Errorf("game not found")
	}
	restorePauseFields(rec.State, snap)
	rec.State.ClockLastTickUnixMs = clockTick
	return a.Store.Update(id, rec.State)
}

func (a *API) pauseWSEnvelope(
	event, source string, game map[string]any,
	actorRole, actorName, reasonKey, reasonLabel, note string,
) map[string]any {
	out := map[string]any{
		"type":   "game_state",
		"game":   game,
		"event":  event,
		"source": source,
	}
	if strings.TrimSpace(actorRole) != "" {
		out["actor_role"] = strings.TrimSpace(actorRole)
	}
	if strings.TrimSpace(actorName) != "" {
		out["actor_display_name"] = strings.TrimSpace(actorName)
	}
	if strings.TrimSpace(reasonKey) != "" {
		out["reason_key"] = strings.TrimSpace(reasonKey)
	}
	if strings.TrimSpace(reasonLabel) != "" {
		out["reason_label"] = strings.TrimSpace(reasonLabel)
	}
	if strings.TrimSpace(note) != "" {
		out["note"] = strings.TrimSpace(note)
	}
	return out
}

// notifyOfficialPauseSeats writes durable in-app notifs for both seats (DB templates).
// sessionMs is the pause session stamp (PausedAtUnixMs) so heal/idempotent retries
// dedupe instead of spamming a new row every second.
func (a *API) notifyOfficialPauseSeats(
	ctx context.Context, gameID string, state *engine.State, paused bool, actorName, reasonLabel string, sessionMs int64,
) {
	if a == nil || a.DB == nil || !a.DB.Ready() || state == nil {
		return
	}
	actorName = strings.TrimSpace(actorName)
	reasonLabel = strings.TrimSpace(reasonLabel)
	kind := notifications.KindPlayerOfficialResume
	dedupePrefix := "official_resume:"
	var args []string
	if paused {
		kind = notifications.KindPlayerOfficialPause
		dedupePrefix = "official_pause:"
		args = []string{actorName, reasonLabel}
	} else {
		args = []string{actorName}
	}
	sessionKey := strconv.FormatInt(sessionMs, 10)
	if sessionMs <= 0 {
		sessionKey = "0"
	}
	for _, seat := range []*string{state.Player1ID, state.Player2ID} {
		if seat == nil {
			continue
		}
		uid := strings.TrimSpace(*seat)
		if uid == "" {
			continue
		}
		notifications.EmitPlayer(
			ctx, a.DB.Pool, uid, kind,
			dedupePrefix+gameID+":"+uid+":"+sessionKey,
			gameID,
			args...,
		)
	}
}

func (a *API) resolveOfficialPauseAuthz(ctx context.Context, userID, gameID string) (officialPauseAuthz, error) {
	out := officialPauseAuthz{}
	display := a.usernameOrEmpty(ctx, userID)
	out.DisplayName = display

	// Console admin with dedicated permission.
	if a.RBAC != nil && a.Users != nil {
		u, err := a.Users.GetByID(ctx, userID)
		if err == nil && u != nil {
			ok, perr := a.RBAC.RoleHasPermission(ctx, u.Role, "games.official_pause")
			if perr == nil && ok {
				out.Role = engine.PauseActorAdmin
				if a.Tournaments != nil {
					if tm, err := a.Tournaments.GetBracketMatchByGameID(ctx, gameID); err == nil && tm != nil {
						out.TournamentID = tm.TournamentID
					}
				}
				if a.HostedEvents != nil {
					if hm, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID); err == nil && hm != nil {
						out.EventID = hm.EventID
					}
				}
				return out, nil
			}
		}
	}

	// Hosted-event organizer for boards linked to their event.
	if a.HostedEvents != nil {
		m, err := a.HostedEvents.GetBracketMatchByGameID(ctx, gameID)
		if err == nil && m != nil {
			ev, err := a.HostedEvents.Get(ctx, m.EventID)
			if err == nil && ev != nil && strings.TrimSpace(ev.OrganizerID) == userID {
				out.Role = engine.PauseActorOrg
				out.EventID = ev.ID
				return out, nil
			}
		}
	}

	return out, errOfficialPause("err_forbidden")
}

func (a *API) requireOfficialPauseViewer(ctx context.Context, userID, gameID string, state *engine.State) error {
	if seatMayPause(state, userID) == nil {
		return nil
	}
	if _, err := a.resolveOfficialPauseAuthz(ctx, userID, gameID); err == nil {
		return nil
	}
	return errOfficialPause("err_forbidden")
}

func (a *API) usernameOrEmpty(ctx context.Context, userID string) string {
	if a == nil || a.Users == nil || strings.TrimSpace(userID) == "" {
		return ""
	}
	u, err := a.Users.GetByID(ctx, userID)
	if err != nil || u == nil {
		return ""
	}
	return strings.TrimSpace(u.Username)
}

func (a *API) officialPauseReasonLabel(key string) (string, bool) {
	key = strings.TrimSpace(key)
	if key == "" || a == nil || a.Settings == nil {
		return "", false
	}
	raw, err := a.Settings.OfficialPauseChromeJSON(context.Background())
	if err != nil || len(raw) == 0 {
		return "", false
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return "", false
	}
	arr, _ := doc["reasons"].([]any)
	for _, item := range arr {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		k := strings.TrimSpace(asChromeString(m["key"]))
		label := strings.TrimSpace(asChromeString(m["label"]))
		if k == key && label != "" {
			return label, true
		}
	}
	return "", false
}

func (a *API) recordOfficialPauseEvent(ctx context.Context, ev store.OfficialPauseEvent) error {
	if a == nil || a.OfficialPause == nil {
		return fmt.Errorf("official pause audit store unavailable")
	}
	_, err := a.OfficialPause.Insert(ctx, ev)
	return err
}

// writeOfficialPauseHTTPErr maps OTP sentinels + official_pause keys (player pause parity).
func (a *API) writeOfficialPauseHTTPErr(w http.ResponseWriter, r *http.Request, err error) {
	if err == nil {
		return
	}
	if errors.Is(err, errOTPUnauthorized) {
		writeOTPChromeError(w, a.Settings, http.StatusUnauthorized, "err_unauthorized")
		return
	}
	if errors.Is(err, errOTPVerificationUnavailable) {
		writeOTPChromeError(w, a.Settings, http.StatusServiceUnavailable, "err_verification_unavailable")
		return
	}
	if errors.Is(err, errOTPVerificationRequired) {
		writeOTPChromeError(w, a.Settings, http.StatusForbidden, "err_verification_required")
		return
	}
	status, msg, key := a.mapOfficialPauseErr(r.Context(), err)
	writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
}

func (a *API) mapOfficialPauseErr(ctx context.Context, err error) (int, string, string) {
	key := "err_forbidden"
	if err == nil {
		return http.StatusBadRequest, a.officialPauseChromeString(ctx, key), key
	}
	// Prefer typed OTP sentinels (never match localized otp_chrome English).
	if errors.Is(err, errOTPUnauthorized) ||
		errors.Is(err, errOTPVerificationUnavailable) ||
		errors.Is(err, errOTPVerificationRequired) {
		chrome := a.officialPauseChromeString(ctx, "err_otp")
		return http.StatusForbidden, chrome, "err_otp"
	}
	msg := strings.TrimSpace(err.Error())
	switch {
	case strings.HasPrefix(msg, "official_pause:"):
		key = strings.TrimPrefix(msg, "official_pause:")
	case msg == "authentication required":
		key = "err_forbidden"
	case msg == "game not found":
		key = "err_not_live"
	case msg == "pause disabled":
		key = "err_forbidden"
	}
	chrome := a.officialPauseChromeString(ctx, key)
	status := http.StatusBadRequest
	if key == "err_forbidden" {
		status = http.StatusForbidden
	}
	return status, chrome, key
}

func errOfficialPause(key string) error {
	return fmt.Errorf("official_pause:%s", strings.TrimSpace(key))
}

// latestOfficialPauseResumeAction skips meta rows and returns the newest pause|resume action.
func latestOfficialPauseResumeAction(evs []store.OfficialPauseEvent) string {
	for _, ev := range evs {
		a := strings.ToLower(strings.TrimSpace(ev.Action))
		if a == "pause" || a == "resume" {
			return a
		}
	}
	return ""
}

// healOfficialPauseAuditIfMissing writes audit (+ notify/WS) when Redis already matches the
// target state but the latest pause|resume audit is missing (compensate failed). Meta rows
// must not trigger a false heal. Resume with no prior pause audit must not invent a resume.
func (a *API) healOfficialPauseAuditIfMissing(
	ctx context.Context, id, userID string, authz officialPauseAuthz, st *engine.State, action, note string,
) error {
	action = strings.TrimSpace(strings.ToLower(action))
	if a == nil || a.OfficialPause == nil || st == nil || (action != "pause" && action != "resume") {
		return errOfficialPause("err_audit_failed")
	}
	evs, err := a.OfficialPause.ListByGame(ctx, id, 50)
	if err != nil {
		// Fail closed: Redis may match, but missing audit must surface so ops can retry heal.
		log.Printf("official pause audit heal list failed game=%s action=%s: %v", id, action, err)
		return errOfficialPause("err_audit_failed")
	}
	latest := latestOfficialPauseResumeAction(evs)
	if latest == action {
		return nil
	}
	// pause: heal only when there is no open pause audit (empty or last closed with resume).
	// resume: heal only when a pause audit is open (never invent resume on empty history).
	if action == "pause" && latest != "" && latest != "resume" {
		return nil
	}
	if action == "resume" && latest != "pause" {
		return nil
	}
	reasonKey := ""
	reasonLabel := ""
	actorRole := strings.TrimSpace(authz.Role)
	actorName := strings.TrimSpace(authz.DisplayName)
	auditNote := strings.TrimSpace(note)
	if action == "pause" {
		reasonKey = strings.TrimSpace(st.PauseReasonKey)
		reasonLabel = strings.TrimSpace(st.PauseReasonLabel)
		if auditNote == "" {
			auditNote = strings.TrimSpace(st.PauseNote)
		}
		if r := strings.TrimSpace(st.PauseActorRole); r != "" {
			actorRole = r
		}
		if n := strings.TrimSpace(st.PauseActorDisplayName); n != "" {
			actorName = n
		}
	}
	if err := a.recordOfficialPauseEvent(ctx, store.OfficialPauseEvent{
		GameID:           id,
		Action:           action,
		ActorUserID:      userID,
		ActorRole:        actorRole,
		ActorDisplayName: actorName,
		ReasonKey:        reasonKey,
		ReasonLabel:      reasonLabel,
		Note:             auditNote,
		EventID:          strPtrOrNil(authz.EventID),
		TournamentID:     strPtrOrNil(authz.TournamentID),
	}); err != nil {
		log.Printf("official pause audit heal failed game=%s action=%s: %v", id, action, err)
		return errOfficialPause("err_audit_failed")
	}
	sessionMs := st.PausedAtUnixMs
	if action == "resume" {
		// Board already cleared; bind resume notify to the open pause audit stamp.
		sessionMs = 0
		for _, ev := range evs {
			if strings.TrimSpace(strings.ToLower(ev.Action)) == "pause" && !ev.CreatedAt.IsZero() {
				sessionMs = ev.CreatedAt.UnixMilli()
				break
			}
		}
	}
	if action == "pause" {
		a.notifyOfficialPauseSeats(ctx, id, st, true, actorName, reasonLabel, sessionMs)
		payload := a.gamePayload(id, st)
		if a.Hub != nil {
			a.Hub.BroadcastGame(id, a.pauseWSEnvelope("match.paused", "official", payload, actorRole, actorName, reasonKey, reasonLabel, auditNote))
		}
	} else {
		a.notifyOfficialPauseSeats(ctx, id, st, false, actorName, "", sessionMs)
		payload := a.gamePayload(id, st)
		if a.Hub != nil {
			a.Hub.BroadcastGame(id, a.pauseWSEnvelope("match.resumed", "official", payload, actorRole, actorName, "", "", auditNote))
		}
	}
	return nil
}

type pauseFieldsSnapshot struct {
	Paused                bool
	PausedAtUnixMs        int64
	PauseExpiresAtUnixMs  int64
	PausedByUserID        string
	PauseKind             string
	PauseReasonKey        string
	PauseReasonLabel      string
	PauseNote             string
	PauseActorRole        string
	PauseActorDisplayName string
}

func snapshotPauseFields(st *engine.State) pauseFieldsSnapshot {
	if st == nil {
		return pauseFieldsSnapshot{}
	}
	return pauseFieldsSnapshot{
		Paused:                st.Paused,
		PausedAtUnixMs:        st.PausedAtUnixMs,
		PauseExpiresAtUnixMs:  st.PauseExpiresAtUnixMs,
		PausedByUserID:        st.PausedByUserID,
		PauseKind:             st.PauseKind,
		PauseReasonKey:        st.PauseReasonKey,
		PauseReasonLabel:      st.PauseReasonLabel,
		PauseNote:             st.PauseNote,
		PauseActorRole:        st.PauseActorRole,
		PauseActorDisplayName: st.PauseActorDisplayName,
	}
}

func restorePauseFields(st *engine.State, snap pauseFieldsSnapshot) {
	if st == nil {
		return
	}
	st.Paused = snap.Paused
	st.PausedAtUnixMs = snap.PausedAtUnixMs
	st.PauseExpiresAtUnixMs = snap.PauseExpiresAtUnixMs
	st.PausedByUserID = snap.PausedByUserID
	st.PauseKind = snap.PauseKind
	st.PauseReasonKey = snap.PauseReasonKey
	st.PauseReasonLabel = snap.PauseReasonLabel
	st.PauseNote = snap.PauseNote
	st.PauseActorRole = snap.PauseActorRole
	st.PauseActorDisplayName = snap.PauseActorDisplayName
}

func (a *API) officialPauseChromeString(ctx context.Context, key string) string {
	if a == nil || a.Settings == nil {
		return ""
	}
	raw, err := a.Settings.OfficialPauseChromeJSON(ctx)
	if err != nil || len(raw) == 0 {
		return ""
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ""
	}
	return strings.TrimSpace(asChromeString(doc[key]))
}

func strPtrOrNil(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
