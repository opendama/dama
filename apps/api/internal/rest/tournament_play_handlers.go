package rest

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/game/engine"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/pagination"
	"dama/apps/api/internal/payments"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func (a *TournamentAPI) requireTournamentEnums(w http.ResponseWriter, r *http.Request) (store.ClientEnumsConfig, store.EventsCatalogConfig, bool) {
	if a.Settings == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "tournaments_player_chrome_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	enums := a.Settings.ClientEnums()
	if enums.Source != "database" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "tournaments_player_chrome_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	cat := a.Settings.EventsCatalog()
	if cat.Source != "database" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "tournaments_player_chrome_unavailable")
		return store.ClientEnumsConfig{}, store.EventsCatalogConfig{}, false
	}
	return enums, cat, true
}

func (a *TournamentAPI) tournamentBracketStatuses(enums store.ClientEnumsConfig) store.HostedBracketStatuses {
	return store.HostedBracketStatuses{
		Pending: enums.TournamentBracketPending,
		Ready:   enums.TournamentBracketReady,
		Live:    enums.TournamentBracketLive,
		Done:    enums.TournamentBracketDone,
		Bye:     enums.TournamentBracketBye,
	}
}

func (a *TournamentAPI) labelTournamentBracket(bracket []store.TournamentBracketMatch, enums store.ClientEnumsConfig) {
	for i := range bracket {
		bracket[i].StatusLabel = store.StatusLabel(enums.TournamentBracketStatusLabels, bracket[i].Status)
	}
}

func (a *TournamentAPI) Get(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	enrolled := false
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID != "" && a.Entries != nil {
		if ex, _ := a.Entries.Exists(r.Context(), id, userID); ex {
			enrolled = true
		}
	}
	out := map[string]any{"tournament": a.publicTournament(r.Context(), t, enrolled)}
	if userID != "" && a.Tournaments != nil {
		if queued, qerr := a.Tournaments.ViewerArenaQueued(r.Context(), id, userID); qerr == nil && queued {
			if tm, ok := out["tournament"].(map[string]any); ok && tm != nil {
				tm["viewer_arena_queued"] = true
			}
		}
	}
	_ = enums
	writeJSON(w, http.StatusOK, out)
}

func (a *TournamentAPI) GetBracket(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := a.Tournaments.Get(r.Context(), id); err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	bracket, err := a.Tournaments.ListBracket(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	a.labelTournamentBracket(bracket, enums)
	writeJSON(w, http.StatusOK, map[string]any{"bracket": bracket})
}

func (a *TournamentAPI) GetStandings(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	phaseFilter := store.StandingsPhaseFilterForFormat(enums, t.FormatID)
	ppw, ppwErr := store.StandingsPointsPerWin(enums)
	if ppwErr != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppd, ppdErr := store.StandingsPointsPerDraw(enums)
	if ppdErr != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	rows, err := a.Tournaments.ListStandings(r.Context(), id, bst, phaseFilter, ppw, ppd)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"standings":    rows,
		"format_id":    t.FormatID,
		"phase_filter": phaseFilter,
	})
}

func (a *TournamentAPI) ListEntries(w http.ResponseWriter, r *http.Request) {
	_, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := a.Tournaments.Get(r.Context(), id); err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if a.Entries == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	entries, err := a.Entries.ListRosterForTournament(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_bracket_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

// ConsoleListEntries returns a paged official cup roster for admin detail.
func (a *TournamentAPI) ConsoleListEntries(w http.ResponseWriter, r *http.Request) {
	_, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	params, labels, skipCap, pageOK := parseListPagination(w, r, a.Settings)
	if !pageOK {
		return
	}
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if _, err := a.Tournaments.Get(r.Context(), id); err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if a.Entries == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	entries, total, err := a.Entries.ListRosterPageForTournament(r.Context(), id, params.Skip, params.Limit)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	meta := pagination.BuildMeta(params, total, skipCap, labels)
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "meta": meta})
}

func (a *TournamentAPI) CheckIn(w http.ResponseWriter, r *http.Request) {
	_, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	if err := a.Tournaments.CheckIn(r.Context(), id, userID); err != nil {
		if errors.Is(err, store.ErrTournamentCheckIn) {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_check_in_not_open")
			return
		}
		if strings.Contains(err.Error(), "not enrolled") {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_not_enrolled")
			return
		}
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *TournamentAPI) MarkMatchReady(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	tournamentID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	t, err := a.Tournaments.Get(r.Context(), tournamentID)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	m, err := a.Tournaments.MarkPlayerReady(r.Context(), tournamentID, matchID, userID)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	if m.PlayerAReadyAt != nil && m.PlayerBReadyAt != nil && m.Status == bst.Ready {
		resp, startErr := a.startTournamentMatchGame(r.Context(), t, m, bst, enums, false)
		if startErr != nil {
			writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		writeJSON(w, http.StatusOK, resp)
		return
	}
	m.StatusLabel = store.StatusLabel(enums.TournamentBracketStatusLabels, m.Status)
	writeJSON(w, http.StatusOK, map[string]any{"match": m})
}

func (a *TournamentAPI) StartMatchGame(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeWalletChromeError(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	tournamentID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	t, err := a.Tournaments.Get(r.Context(), tournamentID)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt == nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	m, err := a.Tournaments.GetBracketMatch(r.Context(), tournamentID, matchID)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
		return
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || (*m.PlayerAID != userID && *m.PlayerBID != userID) {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusForbidden, "err_not_enrolled")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	resp, startErr := a.startTournamentMatchGame(r.Context(), t, m, bst, enums, false)
	if startErr != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (a *TournamentAPI) ConsoleStart(w http.ResponseWriter, r *http.Request) {
	enums, cat, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_cup_already_started")
		return
	}
	if a.Entries == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	now := time.Now().UTC()
	formatID := strings.TrimSpace(t.FormatID)
	if formatID == "" {
		formatID = strings.TrimSpace(enums.TournamentDefaultFormat)
	}
	// Arena does not seed a bracket from check-in; enrolled seats are enough to open the clock.
	// Classic formats still require checked-in seats when the check-in window applies.
	excludeUnchecked := store.SeedBracketCheckedInOnly(t, true, now)
	if strings.TrimSpace(formatID) == strings.TrimSpace(enums.HostedEventArenaFormat) {
		excludeUnchecked = false
	}
	players, err := a.Entries.ListUserIDsByTournament(r.Context(), id, excludeUnchecked)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	minStart := cat.MinPlayersToStart[formatID]
	if minStart < 2 {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_start_failed")
		return
	}
	if len(players) < minStart {
		// Always emit not_enough_players so admin SPA maps checked-in copy (mig 509/510).
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "not_enough_players")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	phases := store.HostedFormatPhases{
		Knockout:   enums.HostedEventPhaseKnockout,
		RoundRobin: enums.HostedEventPhaseRoundRobin,
		Swiss:      enums.HostedEventPhaseSwiss,
		Group:      enums.HostedEventPhaseGroup,
		Arena:      enums.HostedEventPhaseArena,
	}
	var bracket []store.TournamentBracketMatch
	var arenaStarted bool
	switch formatID {
	case enums.HostedEventArenaFormat:
		dur, derr := resolveArenaDurationMinutes(t.ArenaDurationMinutes, enums)
		if derr != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_arena_start_failed")
			return
		}
		t, err = a.Tournaments.StartArena(r.Context(), id, dur, phases.Arena)
		if err != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_arena_start_failed")
			return
		}
		arenaStarted = true
	case enums.HostedEventKnockoutFormat:
		bracket, err = a.Tournaments.GenerateKnockoutBracket(r.Context(), id, players, bst, phases.Knockout)
	case enums.HostedEventRoundRobinFormat:
		bracket, err = a.Tournaments.GenerateRoundRobinBracket(r.Context(), id, players, bst, phases.RoundRobin)
	case enums.HostedEventSwissFormat:
		bracket, err = a.Tournaments.GenerateSwissBracket(r.Context(), id, players, bst, phases.Swiss)
	case enums.HostedEventGroupsKnockoutFormat:
		bracket, err = a.Tournaments.GenerateGroupsKnockoutBracket(
			r.Context(), id, players, bst, phases,
			cat.GroupsKnockoutTargetGroupSize, cat.GroupsKnockoutAdvancePerGroup,
		)
	default:
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	if err != nil && !arenaStarted {
		if errors.Is(err, store.ErrTournamentAlreadyHasBracket) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_bracket_exists")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	if !arenaStarted && t.PrizePoolDisplayEnabled && !t.IsFree && a.Entries != nil {
		playersCount, countErr := a.Entries.CountByTournament(r.Context(), id)
		if countErr != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		guarantee := 0.0
		if t.PrizePool != nil {
			switch v := t.PrizePool["total"].(type) {
			case float64:
				guarantee = payments.RoundMoney2(v)
			case int:
				guarantee = payments.RoundMoney2(float64(v))
			}
		}
		amt := payments.RoundMoney2(float64(playersCount)*t.EntryFeeAmount + guarantee)
		frozen, freezeErr := a.Tournaments.FreezePrizePool(r.Context(), id, amt)
		if freezeErr != nil || frozen == nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
		t = frozen
	}
	if !arenaStarted {
		t, err = a.Tournaments.MarkStarted(r.Context(), id)
		if err != nil {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
			return
		}
	}
	checkInHours := optionalCheckInCloseHours(enums.CompetitionCheckInWindowHours)
	if refreshed, emitCheckIn, ensureErr := a.Tournaments.EnsureCheckInOpenForCupStart(
		r.Context(), id, checkInHours,
	); ensureErr == nil && refreshed != nil {
		t = refreshed
		if emitCheckIn {
			emitTournamentCheckInOpen(r.Context(), a.DB, t, players)
		}
	}
	if a.DB != nil && a.DB.Ready() {
		kind := notifications.KindPlayerTournamentStarted
		if arenaStarted {
			kind = notifications.KindPlayerArenaStarted
		}
		for _, uid := range players {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, uid, kind,
				"tournament_started:"+t.ID+":"+uid, t.ID, t.Title)
		}
	}
	a.labelTournamentBracket(bracket, enums)
	writeJSON(w, http.StatusOK, map[string]any{
		"tournament": a.publicTournament(r.Context(), t, false),
		"bracket":    bracket,
	})
}

func (a *TournamentAPI) ConsoleStartMatchGame(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	tournamentID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	t, err := a.Tournaments.Get(r.Context(), tournamentID)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	m, err := a.Tournaments.GetBracketMatch(r.Context(), tournamentID, matchID)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	resp, startErr := a.startTournamentMatchGame(r.Context(), t, m, bst, enums, true)
	if startErr != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_match_not_ready")
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (a *TournamentAPI) startTournamentMatchGame(
	ctx context.Context,
	t *store.Tournament,
	m *store.TournamentBracketMatch,
	bst store.HostedBracketStatuses,
	enums store.ClientEnumsConfig,
	force bool,
) (map[string]any, error) {
	if m == nil || t == nil {
		return nil, errors.New("match required")
	}
	if m.Status != bst.Ready {
		return nil, errors.New("not ready")
	}
	if m.PlayerAID == nil || m.PlayerBID == nil || *m.PlayerAID == "" || *m.PlayerBID == "" {
		return nil, errors.New("players missing")
	}
	if !force {
		if m.PlayerAReadyAt == nil || m.PlayerBReadyAt == nil {
			return nil, errors.New("not ready")
		}
	}
	if a.Games == nil || a.Settings == nil {
		return nil, errors.New("games unavailable")
	}
	rules := a.Settings.BoardRules()
	if rules.Source != "database" || rules.Size != engine.BoardSize || rules.SetupRows <= 0 || rules.Variant == "" {
		return nil, errors.New("board rules unavailable")
	}
	gameID := uuid.NewString()
	state, err := engine.InitialState("pvp", 0, rules.SetupRows, rules.Variant)
	if err != nil {
		return nil, err
	}
	p1, p2 := *m.PlayerAID, *m.PlayerBID
	state.Player1ID = &p1
	state.Player2ID = &p2
	state.Rated = a.Flags != nil && a.Flags.Get(ctx).PublicEventMatchesRated
	stampMatchClockFromSettings(a.Settings, state, 0)
	if _, err := a.Games.Create(gameID, state); err != nil {
		return nil, err
	}
	WarmJoinQRPNG(a.Settings, gameID)
	updated, err := a.Tournaments.AttachGame(ctx, m.ID, gameID, bst.Live)
	if err != nil {
		return nil, err
	}
	if a.DB != nil && a.DB.Ready() {
		notifications.EmitPlayer(ctx, a.DB.Pool, p1, notifications.KindPlayerTournamentMatchReady,
			"tournament_match_ready:"+m.ID+":"+p1, gameID, t.Title)
		notifications.EmitPlayer(ctx, a.DB.Pool, p2, notifications.KindPlayerTournamentMatchReady,
			"tournament_match_ready:"+m.ID+":"+p2, gameID, t.Title)
	}
	if a.Hub != nil {
		a.Hub.BroadcastToUsers([]string{p1, p2}, map[string]any{
			"type":          "match_found",
			"game_id":       gameID,
			"player1_id":    p1,
			"player2_id":    p2,
			"tournament_id": t.ID,
			"match_id":      m.ID,
		})
	}
	updated.StatusLabel = store.StatusLabel(enums.TournamentBracketStatusLabels, updated.Status)
	return map[string]any{
		"match":      updated,
		"game_id":    gameID,
		"player1_id": p1,
		"player2_id": p2,
	}, nil
}

func (a *TournamentAPI) tournamentFormatAdvanceParams(
	enums store.ClientEnumsConfig,
	cat store.EventsCatalogConfig,
) (store.HostedFormatIDs, store.HostedFormatPhases, map[string]int, int) {
	return store.HostedFormatIDs{
		Knockout:       enums.HostedEventKnockoutFormat,
		RoundRobin:     enums.HostedEventRoundRobinFormat,
		Swiss:          enums.HostedEventSwissFormat,
		GroupsKnockout: enums.HostedEventGroupsKnockoutFormat,
		Arena:          enums.HostedEventArenaFormat,
	}, store.HostedFormatPhases{
		Knockout:   enums.HostedEventPhaseKnockout,
		RoundRobin: enums.HostedEventPhaseRoundRobin,
		Swiss:      enums.HostedEventPhaseSwiss,
		Group:      enums.HostedEventPhaseGroup,
		Arena:      enums.HostedEventPhaseArena,
	}, cat.SwissRoundsByMaxPlayers, cat.GroupsKnockoutAdvancePerGroup
}

// freezeTournamentPrizePoolAtFinishIfNeeded locks the Arena pot before escrow.
// Fail-closed: returns an error when freeze is required but cannot be applied
// (never silently escrow against an unfrozen pot).
func (a *TournamentAPI) freezeTournamentPrizePoolAtFinishIfNeeded(ctx context.Context, tour *store.Tournament) (*store.Tournament, error) {
	if tour == nil || tour.IsFree || !tour.PrizePoolDisplayEnabled || tour.PrizePoolFrozenAmount != nil {
		return tour, nil
	}
	if a.Entries == nil || a.Tournaments == nil {
		return tour, errors.New("tournament stores unavailable")
	}
	playersCount, err := a.Entries.CountByTournament(ctx, tour.ID)
	if err != nil {
		return tour, err
	}
	guarantee := 0.0
	if tour.PrizePool != nil {
		switch v := tour.PrizePool["total"].(type) {
		case float64:
			guarantee = payments.RoundMoney2(v)
		case int:
			guarantee = payments.RoundMoney2(float64(v))
		}
	}
	amt := payments.RoundMoney2(float64(playersCount)*tour.EntryFeeAmount + guarantee)
	frozen, freezeErr := a.Tournaments.FreezePrizePool(ctx, tour.ID, amt)
	if freezeErr != nil {
		return tour, freezeErr
	}
	if frozen == nil {
		return tour, errors.New("prize pool freeze failed")
	}
	return frozen, nil
}

func (a *TournamentAPI) tournamentFinishAfterBracket(ctx context.Context, tourID string, finishedBefore bool, enums store.ClientEnumsConfig) {
	if finishedBefore || a.Tournaments == nil || a.DB == nil || !a.DB.Ready() {
		return
	}
	tour, err := a.Tournaments.Get(ctx, tourID)
	if err != nil || tour == nil || tour.FinishedAt == nil {
		return
	}
	isArena := strings.TrimSpace(tour.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
	if isArena {
		frozen, freezeErr := a.freezeTournamentPrizePoolAtFinishIfNeeded(ctx, tour)
		if freezeErr != nil {
			log.Printf("tournamentFinishAfterBracket: arena freeze failed tournament_id=%s: %v", tourID, freezeErr)
			return
		}
		tour = frozen
	}
	if a.CompetitionPrizes != nil {
		if err := a.CompetitionPrizes.EscrowTournamentFinish(ctx, tour); err != nil {
			log.Printf("tournamentFinishAfterBracket: escrow failed tournament_id=%s: %v", tourID, err)
			return
		}
		if refreshed, getErr := a.Tournaments.Get(ctx, tourID); getErr == nil && refreshed != nil {
			tour = refreshed
		}
		if tour.DisputeWindowEndsAt != nil {
			ids, _ := tournamentEntrantIDs(ctx, a.DB, tour.ID)
			for _, uid := range ids {
				notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerTournamentDisputeOpen,
					"tournament_dispute_open:"+tour.ID+":"+uid, tour.ID, tour.Title)
			}
		}
	}
	if isArena {
		return
	}
	ids, _ := tournamentEntrantIDs(ctx, a.DB, tour.ID)
	for _, uid := range ids {
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerTournamentFinished,
			"tournament_finished:"+tour.ID+":"+uid, tour.ID, tour.Title)
	}
}

func (a *TournamentAPI) ConsoleForfeitMatch(w http.ResponseWriter, r *http.Request) {
	enums, cat, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	tournamentID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	t, err := a.Tournaments.Get(r.Context(), tournamentID)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_forfeit_failed")
		return
	}
	finishedBefore := t.FinishedAt != nil
	var body struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.UserID) == "" {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusBadRequest, "err_forfeit_failed")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	formatIDs, phases, swissRounds, groupsAdvance := a.tournamentFormatAdvanceParams(enums, cat)
	arenaScore, arenaScoreErr := store.ParseArenaScoreConfig(enums)
	if arenaScoreErr != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppw, ppwErr := store.StandingsPointsPerWin(enums)
	if ppwErr != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	ppd, ppdErr := store.StandingsPointsPerDraw(enums)
	if ppdErr != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_bracket_failed")
		return
	}
	updated, awards, err := a.Tournaments.ForfeitTournamentMatch(
		r.Context(), tournamentID, matchID, body.UserID, bst, formatIDs, phases, swissRounds, groupsAdvance, arenaScore, ppw, ppd,
	)
	if err != nil {
		if errors.Is(err, store.ErrTournamentBracketNotFound) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
			return
		}
		if errors.Is(err, store.ErrTournamentMatchForfeit) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_forfeit_failed")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_forfeit_failed")
		return
	}
	if updated != nil {
		gid := ""
		if updated.GameID != nil {
			gid = strings.TrimSpace(*updated.GameID)
		}
		liveGID := gid
		if gid == "" {
			gid = "match:" + strings.TrimSpace(updated.ID)
		}
		preferArena := strings.TrimSpace(t.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
		emitCompetitionPointsAwarded(r.Context(), a.DB, gid, t.Title, tournamentID, awards, preferArena)
		// Bracket owns the result; still clear Redis official/player pause so seats leave the board.
		if liveGID != "" {
			winnerID := ""
			if updated.WinnerID != nil {
				winnerID = strings.TrimSpace(*updated.WinnerID)
			}
			forceFinishLiveBoardAfterBracketWin(a.Games, a.Hub, liveGID, winnerID, "forfeit", &bracketLiveClearAudit{
				Ctx:          r.Context(),
				Store:        a.OfficialPause,
				ActorUserID:  auth.UserIDFromContext(r.Context()),
				ActorRole:    "admin",
				TournamentID: tournamentID,
				Note:         "forfeit",
			})
		}
	}
	a.tournamentFinishAfterBracket(r.Context(), tournamentID, finishedBefore, enums)
	updated.StatusLabel = store.StatusLabel(enums.TournamentBracketStatusLabels, updated.Status)
	writeJSON(w, http.StatusOK, map[string]any{"match": updated})
}

// ConsoleRematchMatch resets a ready/live unfinished match so seats can Ready again (ops rematch).
func (a *TournamentAPI) ConsoleRematchMatch(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	tournamentID := chi.URLParam(r, "id")
	matchID := chi.URLParam(r, "matchId")
	t, err := a.Tournaments.Get(r.Context(), tournamentID)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	if t.StartedAt == nil || t.FinishedAt != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_rematch_failed")
		return
	}
	bst := a.tournamentBracketStatuses(enums)
	liveGID := ""
	if before, berr := a.Tournaments.GetBracketMatch(r.Context(), tournamentID, matchID); berr == nil && before != nil && before.GameID != nil {
		liveGID = strings.TrimSpace(*before.GameID)
	}
	// End Redis first so rematch cannot clear game_id while an official pause stays live.
	if err := abandonLiveBoardForRematch(a.Games, a.Hub, liveGID, &bracketLiveClearAudit{
		Ctx:          r.Context(),
		Store:        a.OfficialPause,
		ActorUserID:  auth.UserIDFromContext(r.Context()),
		ActorRole:    "admin",
		TournamentID: tournamentID,
		Note:         "rematch",
	}); err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusServiceUnavailable, "err_rematch_failed")
		return
	}
	updated, err := a.Tournaments.RematchTournamentMatch(r.Context(), tournamentID, matchID, bst)
	if err != nil {
		if errors.Is(err, store.ErrTournamentBracketNotFound) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_match_not_found")
			return
		}
		if errors.Is(err, store.ErrTournamentMatchRematch) {
			writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_rematch_failed")
			return
		}
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_rematch_failed")
		return
	}
	updated.StatusLabel = store.StatusLabel(enums.TournamentBracketStatusLabels, updated.Status)
	writeJSON(w, http.StatusOK, map[string]any{"match": updated})
}
