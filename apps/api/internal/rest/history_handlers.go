package rest

import (
	"context"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/domain"
	"dama/apps/api/internal/gamestore"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/presence"
	"dama/apps/api/internal/store"
	"github.com/go-chi/chi/v5"
)

type HistoryAPI struct {
	Matches  *store.MatchHistoryStore
	Users    *store.UserStore
	Settings *store.SettingsStore
	Presence *presence.Service
	Entries  *store.EntryStore
	Games    *gamestore.Store
	Friends  *store.FriendsStore
	Cash     *store.CashRmgStore
	Events   *store.HostedEventStore
}

func (a *HistoryAPI) MyMatches(w http.ResponseWriter, r *http.Request) {
	userID := auth.UserIDFromContext(r.Context())
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Matches.ListForUserPaged(r.Context(), userID, params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load matches")
		return
	}
	matches := make([]map[string]any, 0, len(list))
	for _, m := range list {
		row := map[string]any{
			"id":          m.ID,
			"mode":        m.Mode,
			"player1_id":  m.Player1ID,
			"player2_id":  m.Player2ID,
			"winner_id":   m.WinnerID,
			"is_draw":     m.IsDraw,
			"move_count":  m.MoveCount,
			"is_free":     m.IsFree,
			"rated":       m.Rated,
			"finished_at": m.FinishedAt,
		}
		if m.GameID != "" {
			row["game_id"] = m.GameID
		}
		matches = append(matches, row)
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"matches": matches, "meta": meta})
}

// ListPlayers returns searchable active players with online/playing flags.
func (a *HistoryAPI) ListPlayers(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	playerRole := ""
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			playerRole = enums.DefaultRole
		}
	}
	if playerRole == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "default role unavailable"})
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	list, total, err := a.Users.SearchPlayersPaged(r.Context(), q, params.Skip, params.Limit, playerRole)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load players")
		return
	}
	out := make([]map[string]any, 0, len(list))
	ids := make([]string, 0, len(list))
	for _, e := range list {
		online := false
		if a.Presence != nil {
			online = a.Presence.Online(r.Context(), e.ID)
		}
		playing := false
		playingGameID := ""
		if a.Games != nil {
			if gid, ok := a.Games.PlayingGameID(e.ID); ok {
				playing = true
				playingGameID = gid
			}
		}
		row := map[string]any{
			"id":               e.ID,
			"username":         e.Username,
			"rating":           e.Rating,
			"xp":               e.XP,
			"wins":             e.Wins,
			"losses":           e.Losses,
			"draws":            e.Draws,
			"region":           e.Region,
			"country_code":     e.CountryCode,
			"avatar_thumb_url": e.AvatarThumbURL,
			"avatar_full_url":  e.AvatarFullURL,
			"online":           online,
			"playing":          playing,
		}
		if playingGameID != "" {
			row["playing_game_id"] = playingGameID
		}
		if a.Settings != nil {
			if label := a.Settings.LevelLabelForXP(e.XP); label != "" {
				row["level_label"] = label
			}
		}
		out = append(out, row)
		ids = append(ids, e.ID)
	}
	a.stampRowsHostTrust(r.Context(), out, ids)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"players": out, "meta": meta})
}

func (a *HistoryAPI) Leaderboard(w http.ResponseWriter, r *http.Request) {
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	playerRole := ""
	if a.Settings != nil {
		enums := a.Settings.ClientEnums()
		if enums.Source == "database" {
			playerRole = enums.DefaultRole
		}
	}
	if playerRole == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "default role unavailable"})
		return
	}
	period, err := store.ParsePeriodKind(r.URL.Query().Get("period"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid period"})
		return
	}

	out := make([]map[string]any, 0)
	var total int

	if period == store.PeriodAll {
		list, t, err := a.Users.LeaderboardPaged(r.Context(), params.Skip, params.Limit, playerRole)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "leaderboard unavailable"})
			return
		}
		total = t
		for _, e := range list {
			// All-time score is rating (not career wins invent as "points").
			out = append(out, a.leaderboardRow(r, e.ID, e.Username, e.Rating, e.XP, e.Wins, e.Losses, e.Draws, e.Rating, e.Region, e.CountryCode, e.AvatarThumbURL, e.AvatarFullURL))
		}
	} else {
		if a.Matches == nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "hall of fame unavailable"})
			return
		}
		list, t, err := a.Matches.HallOfFamePaged(r.Context(), period, params.Skip, params.Limit, playerRole)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "hall of fame unavailable"})
			return
		}
		total = t
		for _, e := range list {
			out = append(out, a.leaderboardRow(r, e.ID, e.Username, e.Rating, e.XP, e.Wins, e.Losses, e.Draws, e.PeriodWins, e.Region, e.CountryCode, e.AvatarThumbURL, e.AvatarFullURL))
		}
	}

	ids := make([]string, 0, len(out))
	for _, row := range out {
		if id, _ := row["id"].(string); id != "" {
			ids = append(ids, id)
		}
	}
	a.stampRowsHostTrust(r.Context(), out, ids)
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	resp := map[string]any{"leaderboard": out, "meta": meta, "period": string(period)}
	viewerID := auth.UserIDFromContext(r.Context())
	if viewerID != "" {
		if period == store.PeriodAll {
			rank, rating, err := a.Users.LeaderboardRank(r.Context(), viewerID, playerRole)
			if err != nil {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "leaderboard unavailable"})
				return
			}
			resp["me"] = map[string]any{
				"rank":   rank,
				"points": rating,
				"rating": rating,
			}
		} else if a.Matches != nil {
			rank, periodWins, err := a.Matches.HallOfFameRank(r.Context(), period, viewerID, playerRole)
			if err != nil {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "hall of fame unavailable"})
				return
			}
			resp["me"] = map[string]any{
				"rank":        rank,
				"period_wins": periodWins,
				"points":      periodWins,
			}
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

// stampRowsHostTrust adds DB-driven host trust tier/badge onto player list/leaderboard rows.
func (a *HistoryAPI) stampRowsHostTrust(ctx context.Context, rows []map[string]any, ids []string) {
	if a == nil || a.Cash == nil || !a.Cash.Ready() || a.Users == nil || len(rows) == 0 {
		return
	}
	flags, err := a.Users.MapHostKycFlags(ctx, ids)
	if err != nil || len(flags) == 0 {
		return
	}
	for i := range rows {
		id, _ := rows[i]["id"].(string)
		f, ok := flags[id]
		if !ok {
			continue
		}
		stampHostTrustFields(a.Cash, f.PhoneVerified, f.DocumentVerified, rows[i])
	}
}

func (a *HistoryAPI) leaderboardRow(
	r *http.Request,
	id, username string,
	rating, xp, wins, losses, draws, points int,
	region, countryCode, avatarThumb, avatarFull *string,
) map[string]any {
	online := false
	if a.Presence != nil {
		online = a.Presence.Online(r.Context(), id)
	}
	playing := false
	playingGameID := ""
	if a.Games != nil {
		if gid, ok := a.Games.PlayingGameID(id); ok {
			playing = true
			playingGameID = gid
		}
	}
	row := map[string]any{
		"id":               id,
		"username":         username,
		"rating":           rating,
		"xp":               xp,
		"wins":             wins,
		"losses":           losses,
		"draws":            draws,
		"points":           points,
		"region":           region,
		"country_code":     countryCode,
		"avatar_thumb_url": avatarThumb,
		"avatar_full_url":  avatarFull,
		"online":           online,
		"playing":          playing,
	}
	if playingGameID != "" {
		row["playing_game_id"] = playingGameID
	}
	if a.Settings != nil {
		if label := a.Settings.LevelLabelForXP(xp); label != "" {
			row["level_label"] = label
		}
	}
	return row
}

func (a *HistoryAPI) publicPlayerOrNotFound(w http.ResponseWriter, r *http.Request) (*domain.User, bool) {
	id := chi.URLParam(r, "id")
	user, err := a.Users.GetByID(r.Context(), id)
	if err != nil || !user.IsActive {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "player not found"})
		return nil, false
	}
	if a.Settings != nil && a.Settings.IsConsoleRole(user.Role) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "player not found"})
		return nil, false
	}
	return user, true
}

func (a *HistoryAPI) mapPublicMatchRows(ctx context.Context, history []store.MatchHistory) []map[string]any {
	matches := make([]map[string]any, 0, len(history))
	for _, m := range history {
		row := map[string]any{
			"id":          m.ID,
			"mode":        m.Mode,
			"is_draw":     m.IsDraw,
			"winner_id":   m.WinnerID,
			"finished_at": m.FinishedAt,
			"move_count":  m.MoveCount,
			"player1_id":  m.Player1ID,
			"player2_id":  m.Player2ID,
		}
		if m.GameID != "" {
			row["game_id"] = m.GameID
		}
		if p1, err := a.Users.GetByID(ctx, m.Player1ID); err == nil && p1 != nil && p1.IsActive {
			card := p1.Public()
			if a.Settings != nil {
				if label := a.Settings.LevelLabelForXP(p1.XP); label != "" {
					card["level_label"] = label
				}
			}
			stampHostTrustFields(a.Cash, p1.PhoneKycVerifiedAt != nil, p1.DocumentKycVerifiedAt != nil, card)
			row["player1"] = card
		}
		if p2, err := a.Users.GetByID(ctx, m.Player2ID); err == nil && p2 != nil && p2.IsActive {
			card := p2.Public()
			if a.Settings != nil {
				if label := a.Settings.LevelLabelForXP(p2.XP); label != "" {
					card["level_label"] = label
				}
			}
			stampHostTrustFields(a.Cash, p2.PhoneKycVerifiedAt != nil, p2.DocumentKycVerifiedAt != nil, card)
			row["player2"] = card
		}
		matches = append(matches, row)
	}
	return matches
}

// PublicPlayerMatches returns paginated match history for a public player card.
func (a *HistoryAPI) PublicPlayerMatches(w http.ResponseWriter, r *http.Request) {
	user, ok := a.publicPlayerOrNotFound(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	history, total, err := a.Matches.ListForUserPaged(r.Context(), user.ID, params.Skip, params.Limit, q)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load matches")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{
		"matches": a.mapPublicMatchRows(r.Context(), history),
		"meta":    meta,
	})
}

// PublicPlayerPlacements returns paginated tournament placements for a public player card.
func (a *HistoryAPI) PublicPlayerPlacements(w http.ResponseWriter, r *http.Request) {
	user, ok := a.publicPlayerOrNotFound(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, ok := parseListPagination(w, r, a.Settings)
	if !ok {
		return
	}
	if a.Entries == nil {
		meta := pagination.BuildMeta(params, 0, skipCap, labels)
		writeJSON(w, http.StatusOK, map[string]any{
			"tournament_placements": []store.PlacementSummary{},
			"meta":                  meta,
		})
		return
	}
	list, total, err := a.Entries.ListPlacementsForUserPaged(r.Context(), user.ID, params.Skip, params.Limit)
	if err != nil {
		writeClientError(w, http.StatusInternalServerError, "unable to load placements")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{
		"tournament_placements": list,
		"meta":                  meta,
	})
}

func (a *HistoryAPI) PublicPlayer(w http.ResponseWriter, r *http.Request) {
	user, ok := a.publicPlayerOrNotFound(w, r)
	if !ok {
		return
	}
	id := user.ID
	history, _ := a.Matches.ListForUser(r.Context(), id, 20)
	rank, regionLabel, _ := a.Users.RegionalRank(r.Context(), id)
	matches := a.mapPublicMatchRows(r.Context(), history)
	player := user.Public()
	if a.Settings != nil {
		if label := a.Settings.LevelLabelForXP(user.XP); label != "" {
			player["level_label"] = label
		}
	}
	stampHostTrustFields(a.Cash, user.PhoneKycVerifiedAt != nil, user.DocumentKycVerifiedAt != nil, player)
	if a.Events != nil && a.Settings != nil {
		enums := a.Settings.ClientEnums()
		finishedSt := strings.TrimSpace(enums.HostedEventFinishedStatus)
		cancelledSt := strings.TrimSpace(enums.HostedEventCancelledStatus)
		openReportSt := strings.TrimSpace(enums.HostedEventReportOpenStatus)
		if finishedSt != "" && cancelledSt != "" && openReportSt != "" {
			if reps, repErr := a.Events.MapHostReputation(r.Context(), []string{id}, finishedSt, cancelledSt, openReportSt); repErr == nil {
				rep := reps[id]
				player["host_finished_paid_cups"] = rep.FinishedPaidCups
				player["host_cancelled_paid_cups"] = rep.CancelledPaidCups
				player["host_open_reports"] = rep.OpenReports
			}
		}
	}
	online := false
	if a.Presence != nil {
		online = a.Presence.Online(r.Context(), id)
	}
	player["online"] = online
	playing := false
	playingGameID := ""
	if a.Games != nil {
		if gid, ok := a.Games.PlayingGameID(id); ok {
			playing = true
			playingGameID = gid
		}
	}
	player["playing"] = playing
	if playingGameID != "" {
		player["playing_game_id"] = playingGameID
	}
	placements := []store.PlacementSummary{}
	if a.Entries != nil {
		if list, err := a.Entries.ListPlacementsForUser(r.Context(), id, 10); err == nil {
			placements = list
		}
	}
	friendsCount := 0
	friendsPreview := make([]map[string]any, 0, 24)
	if a.Friends != nil {
		if ids, err := a.Friends.ListFriendIDs(r.Context(), id); err == nil {
			friendsCount = len(ids)
			limit := 24
			if len(ids) < limit {
				limit = len(ids)
			}
			for i := 0; i < limit; i++ {
				fid := ids[i]
				fu, err := a.Users.GetByID(r.Context(), fid)
				if err != nil || fu == nil || !fu.IsActive {
					continue
				}
				if a.Settings != nil && a.Settings.IsConsoleRole(fu.Role) {
					continue
				}
				card := fu.Public()
				if a.Settings != nil {
					if label := a.Settings.LevelLabelForXP(fu.XP); label != "" {
						card["level_label"] = label
					}
				}
				if a.Presence != nil {
					card["online"] = a.Presence.Online(r.Context(), fid)
				}
				if a.Games != nil {
					if gid, ok := a.Games.PlayingGameID(fid); ok {
						card["playing"] = true
						card["playing_game_id"] = gid
					} else {
						card["playing"] = false
					}
				}
				stampHostTrustFields(a.Cash, fu.PhoneKycVerifiedAt != nil, fu.DocumentKycVerifiedAt != nil, card)
				friendsPreview = append(friendsPreview, card)
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"player":                player,
		"matches":               matches,
		"tournament_placements": placements,
		"regional_rank":         rank,
		"region_label":          regionLabel,
		"online":                online,
		"playing":               playing,
		"playing_game_id":       playingGameID,
		"friends_count":         friendsCount,
		"friends_preview":       friendsPreview,
	})
}
