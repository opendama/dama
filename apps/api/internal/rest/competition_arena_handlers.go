package rest

import (
	"context"
	"net/http"
	"strings"

	"dama/apps/api/internal/auth"
	"dama/apps/api/internal/notifications"
	"dama/apps/api/internal/store"

	"github.com/go-chi/chi/v5"
)

func (a *TournamentAPI) ArenaJoinQueue(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_not_enrolled")
		return
	}
	id := chi.URLParam(r, "id")
	bst := a.tournamentBracketStatuses(enums)
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	err := a.Tournaments.JoinArenaQueue(r.Context(), id, userID, bst, phase)
	if err != nil {
		// Hosted Community parity: queue failures are not "start tournament".
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "toast_arena_queue_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *TournamentAPI) ArenaLeaveQueue(w http.ResponseWriter, r *http.Request) {
	_, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_not_enrolled")
		return
	}
	id := chi.URLParam(r, "id")
	err := a.Tournaments.LeaveArenaQueue(r.Context(), id, userID)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "toast_arena_queue_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *TournamentAPI) ArenaStandings(w http.ResponseWriter, r *http.Request) {
	_, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := a.Tournaments.Get(r.Context(), id); err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	rows, err := a.Tournaments.ListArenaStandings(r.Context(), id)
	if err != nil {
		writeTournamentsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_load_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"standings": rows})
}

func (a *HostedEventsAPI) ArenaJoinQueue(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		// Play-handler parity (hosted_events_play_handlers): sign-in, not feature_disabled.
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	bst := a.eventBracketStatuses(enums)
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	err := a.Events.JoinArenaQueue(r.Context(), id, userID, enums.HostedEventEntryApproved, bst, phase)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "toast_arena_queue_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *HostedEventsAPI) ArenaLeaveQueue(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	userID := strings.TrimSpace(auth.UserIDFromContext(r.Context()))
	if userID == "" {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusUnauthorized, "err_unauthorized")
		return
	}
	id := chi.URLParam(r, "id")
	err := a.Events.LeaveArenaQueue(r.Context(), id, userID, enums.HostedEventEntryApproved)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusConflict, "toast_arena_queue_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (a *TournamentAPI) ConsoleFinishArena(w http.ResponseWriter, r *http.Request) {
	enums, _, ok := a.requireTournamentEnums(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	t, err := a.Tournaments.Get(r.Context(), id)
	if err != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_tournament_not_found")
		return
	}
	isArenaFormat := strings.TrimSpace(t.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
	hasArenaClock := t.ArenaEndsAt != nil || (t.ArenaDurationMinutes != nil && *t.ArenaDurationMinutes > 0)
	if !isArenaFormat && !hasArenaClock {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	if t.FinishedAt != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	if t.StartedAt == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	// Freeze pot before FinishArena so a freeze failure never leaves finished_at stuck.
	if _, freezeErr := a.freezeTournamentPrizePoolAtFinishIfNeeded(r.Context(), t); freezeErr != nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	finishedBefore := false
	bst := a.tournamentBracketStatuses(enums)
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	tour, ferr := a.Tournaments.FinishArena(r.Context(), id, bst, phase)
	if ferr != nil || tour == nil {
		writeAdminTournamentErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	a.tournamentFinishAfterBracket(r.Context(), id, finishedBefore, enums)
	a.emitTournamentArenaFinished(r.Context(), tour, enums)
	writeJSON(w, http.StatusOK, map[string]any{"tournament": a.publicTournament(r.Context(), tour, false)})
}

func (a *TournamentAPI) emitTournamentArenaFinished(ctx context.Context, tour *store.Tournament, enums store.ClientEnumsConfig) {
	if a == nil || a.DB == nil || !a.DB.Ready() || tour == nil {
		return
	}
	if strings.TrimSpace(tour.FormatID) != strings.TrimSpace(enums.HostedEventArenaFormat) {
		return
	}
	ids, _ := tournamentEntrantIDs(ctx, a.DB, tour.ID)
	for _, uid := range ids {
		notifications.EmitPlayer(ctx, a.DB.Pool, uid, notifications.KindPlayerArenaFinished,
			"arena_finished:"+tour.ID+":"+uid, tour.ID, tour.Title)
	}
}

// OrganizerFinishArena force-ends a live hosted Arena (organizer parity with console tournament finish).
func (a *HostedEventsAPI) OrganizerFinishArena(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	enums, _, ok := a.requireEnumsCatalog(w, r)
	if !ok {
		return
	}
	id := chi.URLParam(r, "id")
	ev, err := a.Events.Get(r.Context(), id)
	if err != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	if !a.requireOrganizer(w, r, ev) {
		return
	}
	isArenaFormat := strings.TrimSpace(ev.FormatID) == strings.TrimSpace(enums.HostedEventArenaFormat)
	hasArenaClock := ev.ArenaEndsAt != nil || (ev.ArenaDurationMinutes != nil && *ev.ArenaDurationMinutes > 0)
	if !isArenaFormat && !hasArenaClock {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	if ev.FinishedAt != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	if ev.StartedAt == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	// Freeze+capture before FinishArena so guarantee/pot failure never leaves finished_at stuck.
	if _, freezeErr := a.freezeEventPrizePoolAtFinishIfNeeded(r.Context(), ev); freezeErr != nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusConflict, "err_start_failed")
		return
	}
	finishedBefore := false
	bst := a.eventBracketStatuses(enums)
	est := store.HostedEventStatuses{
		Open:      enums.HostedEventDefaultStatus,
		Full:      enums.HostedEventFullStatus,
		Live:      enums.HostedEventLiveStatus,
		Finished:  enums.HostedEventFinishedStatus,
		Cancelled: enums.HostedEventCancelledStatus,
	}
	phase := strings.TrimSpace(enums.HostedEventPhaseArena)
	finished, ferr := a.Events.FinishArena(r.Context(), id, bst, est, enums.HostedEventEntryApproved, phase)
	if ferr != nil || finished == nil {
		writeEventsOrgErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "err_start_failed")
		return
	}
	a.eventFinishAfterBracket(r.Context(), id, finishedBefore, enums)
	if a.DB != nil && a.DB.Ready() {
		players, _ := a.Events.ListApprovedUserIDs(r.Context(), id, enums.HostedEventEntryApproved, false)
		for _, uid := range players {
			notifications.EmitPlayer(r.Context(), a.DB.Pool, uid, notifications.KindPlayerArenaFinished,
				"arena_finished:"+id+":"+uid, id, finished.Title)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"event": finished})
}

func (a *HostedEventsAPI) ArenaStandings(w http.ResponseWriter, r *http.Request) {
	if !a.requireEventsEnabled(w, r) {
		return
	}
	if _, _, ok := a.requireEnumsCatalog(w, r); !ok {
		return
	}
	id := chi.URLParam(r, "id")
	if _, err := a.Events.Get(r.Context(), id); err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusNotFound, "err_event_not_found")
		return
	}
	rows, err := a.Events.ListArenaStandings(r.Context(), id)
	if err != nil {
		writeEventsPlayerErr(w, a.Settings, r.Context(), http.StatusInternalServerError, "load_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"standings": rows})
}
