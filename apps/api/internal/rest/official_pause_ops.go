package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/pagination"
)

type bulkOfficialPauseBody struct {
	EventID      string   `json:"event_id"`
	TournamentID string   `json:"tournament_id"`
	RoundIndex   *int     `json:"round_index"`
	GameIDs      []string `json:"game_ids"`
	ReasonKey    string   `json:"reason_key"`
	Note         string   `json:"note"`
}

type bulkOfficialResumeBody struct {
	GameIDs []string `json:"game_ids"`
	Note    string   `json:"note"`
}

type bulkOfficialPauseResult struct {
	GameID   string `json:"game_id"`
	ErrorKey string `json:"error_key,omitempty"`
}

func uniqueTrimmedGameIDs(raw []string) []string {
	seen := make(map[string]struct{}, len(raw))
	out := make([]string, 0, len(raw))
	for _, id := range raw {
		gid := strings.TrimSpace(id)
		if gid == "" {
			continue
		}
		if _, ok := seen[gid]; ok {
			continue
		}
		seen[gid] = struct{}{}
		out = append(out, gid)
	}
	return out
}

// BulkOfficialPauseRound is REST POST /api/v1/games/official-pause/bulk.
// Accepts either round scope (event_id|tournament_id + round_index) or explicit game_ids.
// Serial fan-out of OfficialPauseGameCore (one audit/notify/WS per board).
func (a *API) BulkOfficialPauseRound(w http.ResponseWriter, r *http.Request) {
	var body bulkOfficialPauseBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_invalid_body"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	payload, err := a.BulkOfficialPauseRoundCore(
		r.Context(), userID,
		strings.TrimSpace(body.EventID), strings.TrimSpace(body.TournamentID),
		body.RoundIndex, uniqueTrimmedGameIDs(body.GameIDs),
		strings.TrimSpace(body.ReasonKey), strings.TrimSpace(body.Note),
	)
	if err != nil {
		a.writeOfficialPauseHTTPErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// BulkOfficialResume is REST POST /api/v1/games/official-resume/bulk.
// Serial fan-out of OfficialResumeGameCore for selected board ids.
func (a *API) BulkOfficialResume(w http.ResponseWriter, r *http.Request) {
	var body bulkOfficialResumeBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_invalid_body"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	userID := auth.UserIDFromContext(r.Context())
	payload, err := a.BulkOfficialResumeCore(
		r.Context(), userID, uniqueTrimmedGameIDs(body.GameIDs), strings.TrimSpace(body.Note),
	)
	if err != nil {
		a.writeOfficialPauseHTTPErr(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

func (a *API) BulkOfficialPauseRoundCore(
	ctx context.Context, userID, eventID, tournamentID string, roundIndex *int, explicitGameIDs []string, reasonKey, note string,
) (map[string]any, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, errOfficialPause("err_forbidden")
	}
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	reasonKey = strings.TrimSpace(reasonKey)
	if reasonKey == "" {
		return nil, errOfficialPause("err_reason_required")
	}

	gameIDs := make([]string, 0)
	if len(explicitGameIDs) > 0 {
		// Selection bulk: authz is enforced per board inside OfficialPauseGameCore.
		gameIDs = append(gameIDs, explicitGameIDs...)
	} else {
		if roundIndex == nil || *roundIndex < 0 {
			return nil, errOfficialPause("err_bulk_round_invalid")
		}
		switch {
		case eventID != "" && tournamentID == "":
			if a.HostedEvents == nil {
				return nil, errOfficialPause("err_forbidden")
			}
			ev, err := a.HostedEvents.Get(ctx, eventID)
			if err != nil || ev == nil || strings.TrimSpace(ev.OrganizerID) != userID {
				// Admins with RBAC may also bulk-pause an event they do not organize.
				if !a.userHasOfficialPausePerm(ctx, userID) {
					return nil, errOfficialPause("err_forbidden")
				}
			}
			bracket, err := a.HostedEvents.ListBracket(ctx, eventID)
			if err != nil {
				return nil, errOfficialPause("err_list_failed")
			}
			for _, m := range bracket {
				if m.IsBye || m.FinishedAt != nil {
					continue
				}
				if m.RoundIndex != *roundIndex {
					continue
				}
				if m.GameID == nil || strings.TrimSpace(*m.GameID) == "" {
					continue
				}
				gameIDs = append(gameIDs, strings.TrimSpace(*m.GameID))
			}
		case tournamentID != "" && eventID == "":
			if !a.userHasOfficialPausePerm(ctx, userID) {
				return nil, errOfficialPause("err_forbidden")
			}
			if a.Tournaments == nil {
				return nil, errOfficialPause("err_forbidden")
			}
			bracket, err := a.Tournaments.ListBracket(ctx, tournamentID)
			if err != nil {
				return nil, errOfficialPause("err_list_failed")
			}
			for _, m := range bracket {
				if m.IsBye || m.FinishedAt != nil {
					continue
				}
				if m.RoundIndex != *roundIndex {
					continue
				}
				if m.GameID == nil || strings.TrimSpace(*m.GameID) == "" {
					continue
				}
				gameIDs = append(gameIDs, strings.TrimSpace(*m.GameID))
			}
		default:
			return nil, errOfficialPause("err_forbidden")
		}
	}

	if len(gameIDs) == 0 {
		return nil, errOfficialPause("err_bulk_empty")
	}
	if a.Store == nil {
		return nil, errOfficialPause("err_not_live")
	}

	paused := make([]string, 0)
	skipped := make([]string, 0)
	failed := make([]bulkOfficialPauseResult, 0)
	for _, gid := range gameIDs {
		rec, ok := a.Store.GetAuthoritative(gid)
		alreadyOfficial := ok && rec.State != nil && rec.State.Paused &&
			strings.TrimSpace(rec.State.PauseKind) == engine.PauseKindOfficial
		// Always run core: idempotent path heals missing audit; already-official stays skipped.
		_, err := a.OfficialPauseGameCore(ctx, gid, userID, reasonKey, note)
		if err != nil {
			key := "err_forbidden"
			msg := strings.TrimSpace(err.Error())
			if strings.HasPrefix(msg, "official_pause:") {
				key = strings.TrimPrefix(msg, "official_pause:")
			}
			failed = append(failed, bulkOfficialPauseResult{GameID: gid, ErrorKey: key})
			continue
		}
		if alreadyOfficial {
			skipped = append(skipped, gid)
			continue
		}
		paused = append(paused, gid)
	}

	return map[string]any{
		"paused":        paused,
		"skipped":       skipped,
		"failed":        failed,
		"ok":            len(paused),
		"skipped_count": len(skipped),
		"failed_count":  len(failed),
	}, nil
}

func (a *API) BulkOfficialResumeCore(
	ctx context.Context, userID string, gameIDs []string, note string,
) (map[string]any, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, errOfficialPause("err_forbidden")
	}
	if err := EnsureOTPVerified(ctx, a.Flags, a.Redis, userID); err != nil {
		return nil, err
	}
	if len(gameIDs) == 0 {
		return nil, errOfficialPause("err_bulk_empty")
	}
	if a.Store == nil {
		return nil, errOfficialPause("err_not_live")
	}

	resumed := make([]string, 0)
	skipped := make([]string, 0)
	failed := make([]bulkOfficialPauseResult, 0)
	for _, gid := range gameIDs {
		rec, ok := a.Store.GetAuthoritative(gid)
		wasPaused := ok && rec.State != nil && rec.State.Paused
		_, err := a.OfficialResumeGameCore(ctx, gid, userID, note)
		if err != nil {
			key := "err_forbidden"
			msg := strings.TrimSpace(err.Error())
			if strings.HasPrefix(msg, "official_pause:") {
				key = strings.TrimPrefix(msg, "official_pause:")
			}
			failed = append(failed, bulkOfficialPauseResult{GameID: gid, ErrorKey: key})
			continue
		}
		if !wasPaused {
			skipped = append(skipped, gid)
			continue
		}
		resumed = append(resumed, gid)
	}

	return map[string]any{
		"resumed":       resumed,
		"skipped":       skipped,
		"failed":        failed,
		"ok":            len(resumed),
		"skipped_count": len(skipped),
		"failed_count":  len(failed),
	}, nil
}

func (a *API) userHasOfficialPausePerm(ctx context.Context, userID string) bool {
	if a == nil || a.RBAC == nil || a.Users == nil {
		return false
	}
	u, err := a.Users.GetByID(ctx, userID)
	if err != nil || u == nil {
		return false
	}
	ok, err := a.RBAC.RoleHasPermission(ctx, u.Role, "games.official_pause")
	return err == nil && ok
}

// ConsoleListOfficialPauseLive is GET /api/v1/console/official-pause/live.
// Admin live boards table: unfinished PvP (incl. private hosted) with pause fields.
func (a *API) ConsoleListOfficialPauseLive(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	if !a.userHasOfficialPausePerm(r.Context(), userID) {
		status, msg, key := a.mapOfficialPauseErr(r.Context(), errOfficialPause("err_forbidden"))
		writeJSON(w, status, map[string]string{"error": msg, "error_key": key})
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	officialOnly := strings.TrimSpace(r.URL.Query().Get("official_only")) == "1" ||
		strings.EqualFold(strings.TrimSpace(r.URL.Query().Get("official_only")), "true")
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	if a.Store == nil {
		meta := pagination.BuildMeta(params, 0, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{
			"games": []any{}, "meta": meta, "officially_paused_count": 0,
		})
		return
	}

	all := a.Store.AllListableLiveIDsNewestFirst()
	rows := make([]map[string]any, 0, len(all))
	officialCount := 0
	for _, id := range all {
		rec, ok := a.Store.GetAuthoritative(id)
		if !ok || rec.State == nil || engine.GameOutcome(rec.State) != nil {
			continue
		}
		if rec.State.Mode == "ai" || rec.State.Mode == "practice" {
			continue
		}
		kind := strings.TrimSpace(rec.State.PauseKind)
		isOfficial := rec.State.Paused && kind == engine.PauseKindOfficial
		if isOfficial {
			officialCount++
		}
		if officialOnly && !isOfficial {
			continue
		}
		p1 := ""
		p2 := ""
		if rec.State.Player1ID != nil && a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), *rec.State.Player1ID); err == nil && u != nil {
				p1 = u.Username
			}
		}
		if rec.State.Player2ID != nil && a.Users != nil {
			if u, err := a.Users.GetByID(r.Context(), *rec.State.Player2ID); err == nil && u != nil {
				p2 = u.Username
			}
		}
		if q != "" {
			hay := strings.ToLower(id + " " + p1 + " " + p2 + " " +
				strings.TrimSpace(rec.State.PauseActorDisplayName) + " " +
				strings.TrimSpace(rec.State.PauseReasonLabel))
			if !strings.Contains(hay, q) {
				continue
			}
		}
		clockP1 := rec.State.ClockP1RemainingMs
		clockP2 := rec.State.ClockP2RemainingMs
		// Live (unpaused) boards: display remaining at list time without mutating Redis.
		if !rec.State.Paused && rec.State.ClockActive {
			clockP1, clockP2 = engine.ClockSnapshot(rec.State, time.Now().UnixMilli())
		}
		row := map[string]any{
			"id":                       id,
			"paused":                   rec.State.Paused,
			"pause_kind":               kind,
			"pause_reason_key":         rec.State.PauseReasonKey,
			"pause_reason_label":       rec.State.PauseReasonLabel,
			"pause_note":               rec.State.PauseNote,
			"pause_actor_role":         rec.State.PauseActorRole,
			"pause_actor_display_name": rec.State.PauseActorDisplayName,
			"paused_at_unix_ms":        rec.State.PausedAtUnixMs,
			"pause_expires_at_unix_ms": rec.State.PauseExpiresAtUnixMs,
			"player1_username":         p1,
			"player2_username":         p2,
			"clock_p1_remaining_ms":    clockP1,
			"clock_p2_remaining_ms":    clockP2,
		}
		if a.Tournaments != nil {
			if tm, err := a.Tournaments.GetBracketMatchByGameID(r.Context(), id); err == nil && tm != nil {
				row["tournament_id"] = tm.TournamentID
				row["round_index"] = tm.RoundIndex
				row["match_index"] = tm.MatchIndex
				row["source"] = "tournament"
			}
		}
		if a.HostedEvents != nil {
			if hm, err := a.HostedEvents.GetBracketMatchByGameID(r.Context(), id); err == nil && hm != nil {
				row["event_id"] = hm.EventID
				row["round_index"] = hm.RoundIndex
				row["match_index"] = hm.MatchIndex
				row["source"] = "hosted"
			}
		}
		if a.OfficialPause != nil {
			if evs, err := a.OfficialPause.ListByGame(r.Context(), id, 1); err == nil && len(evs) > 0 {
				row["last_action"] = evs[0].Action
				row["last_action_at"] = evs[0].CreatedAt
			}
		}
		rows = append(rows, row)
	}

	total := len(rows)
	page := []map[string]any{}
	if params.Skip < total {
		end := params.Skip + params.Limit
		if end > total {
			end = total
		}
		page = rows[params.Skip:end]
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{
		"games":                   page,
		"meta":                    meta,
		"officially_paused_count": officialCount,
	})
}
